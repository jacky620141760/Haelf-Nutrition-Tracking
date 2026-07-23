import { parseAiResponse } from './parser';
import type { AiSuggestion } from '../../domain/types';
import { getApiKey } from '../secureStore';
import { analyzeFoodWithLogMeal, isLogMealEndpoint } from './logmeal';

const SCHEMA_INSTRUCTION = `你必須只輸出一個 JSON 物件，不要 markdown、不要程式碼區塊、不要解釋文字。

先判斷輸入（圖片與／或文字）是否為可食用的食物或餐點。
若不是食物（例如人、寵物、風景、文件、包裝空殼、無法辨識為食物），只輸出：
{"is_food":false,"reason":"簡短中文原因"}
此時不要猜測營養數字。

若是食物，必要欄位：
- is_food (true)
- name (字串)
- basis ("PER_100_G" 或 "PER_SERVING")
- quantity (數字；PER_100_G 時為克數，PER_SERVING 時為份數)
- kcal, protein_g, fat_g, carbs_g (數字；依 basis 的來源營養，不是已乘上食用量的結果)
- confidence (0 到 1 的數字)
範例：{"is_food":true,"name":"雞胸肉","basis":"PER_100_G","quantity":100,"kcal":165,"protein_g":31,"fat_g":3.6,"carbs_g":0,"confidence":0.85}`;

export type AiClientResult =
  | { ok: true; suggestion: AiSuggestion }
  | {
      ok: false;
      reason: 'timeout' | 'network' | 'parse' | 'http' | 'no_key' | 'cancelled' | 'not_food';
      message: string;
    };

type ChatFailureReason = 'timeout' | 'network' | 'http' | 'no_key' | 'cancelled';

async function chatCompletion(params: {
  endpointUrl: string;
  model: string;
  messages: unknown[];
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<{ ok: true; content: string } | { ok: false; reason: ChatFailureReason; message: string }> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'no_key', message: '未設定 API Key，請前往 AI 設定。' };
  }
  try {
    const endpoint = new URL(params.endpointUrl);
    if (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') {
      throw new Error('protocol');
    }
  } catch {
    return {
      ok: false,
      reason: 'http',
      message: 'AI 端點 URL 無效，請在 AI 設定中檢查完整網址。',
    };
  }
  const base = params.endpointUrl.replace(/\/$/, '');
  const url = base.includes('/chat/completions')
    ? base
    : `${base}/chat/completions`;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, params.timeoutMs);
  const cancel = () => controller.abort();
  if (params.signal?.aborted) cancel();
  params.signal?.addEventListener('abort', cancel, { once: true });
  try {
    const payload = {
      model: params.model,
      messages: params.messages,
      temperature: 0.2,
    };
    const post = (body: Record<string, unknown>) =>
      fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

    let res = await post({ ...payload, response_format: { type: 'json_object' } });
    if (res.status === 400) {
      // Some OpenAI-compatible hosts reject response_format.
      res = await post(payload);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const action =
        res.status === 401 || res.status === 403
          ? '端點拒絕授權，請檢查 API Key。'
          : res.status === 404
            ? '找不到 AI 端點，請檢查端點 URL。'
            : res.status === 429
              ? 'AI 服務已達速率或額度限制，請稍後再試。'
              : `AI 端點回傳 HTTP ${res.status}。`;
      return {
        ok: false,
        reason: 'http',
        message: `${action}${text ? `\n${text.slice(0, 200)}` : ''}`,
      };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | Array<{ type?: string; text?: string }> } }[];
    };
    const rawContent = data.choices?.[0]?.message?.content;
    const content =
      typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
          : '';
    if (!content) {
      return { ok: false, reason: 'http', message: '回應無內容' };
    }
    return { ok: true, content };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return timedOut
        ? { ok: false, reason: 'timeout', message: '逾時' }
        : { ok: false, reason: 'cancelled', message: '已取消' };
    }
    return {
      ok: false,
      reason: 'network',
      message: e instanceof Error ? e.message : '連線失敗',
    };
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', cancel);
  }
}

/** Models that are known to accept image_url — skip the flaky text-only probe. */
export function modelLikelySupportsVision(model: string): boolean {
  const lower = model.toLowerCase();
  return (
    lower.includes('vl') ||
    lower.includes('vision') ||
    lower.includes('gpt-4o') ||
    lower.includes('gpt-4.1') ||
    lower.includes('gemini') ||
    /qwen.*vl|vl.*qwen/.test(lower)
  );
}

/** Capability_Check: 10s. Returns true only if explicitly confirmed vision support. */
export async function checkVisionCapability(
  endpointUrl: string,
  model: string,
  signal?: AbortSignal
): Promise<'supported' | 'unsupported' | 'unknown' | 'cancelled'> {
  if (isLogMealEndpoint(endpointUrl)) return 'supported';
  if (modelLikelySupportsVision(model)) return 'supported';

  const probe = await chatCompletion({
    endpointUrl,
    model,
    timeoutMs: 10_000,
    signal,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Reply with exactly {"vision":true} if you can analyze images, otherwise {"vision":false}. JSON only.',
          },
        ],
      },
    ],
  });
  if (!probe.ok) {
    if (probe.reason === 'cancelled') return 'cancelled';
    if (probe.reason === 'no_key' || probe.reason === 'http') {
      throw new Error(probe.message);
    }
    return 'unknown';
  }
  try {
    const m = probe.content.match(/\{[\s\S]*\}/);
    if (!m) return 'unknown';
    const parsed = JSON.parse(m[0]) as { vision?: boolean };
    if (parsed.vision === true) return 'supported';
    if (parsed.vision === false) return 'unsupported';
  } catch {
    /* fallthrough */
  }
  return 'unknown';
}

export async function analyzeFoodWithAi(params: {
  endpointUrl: string;
  model: string;
  text?: string;
  imageBase64?: string;
  mimeType?: string;
  imageUri?: string;
  signal?: AbortSignal;
}): Promise<AiClientResult> {
  if (isLogMealEndpoint(params.endpointUrl)) {
    if (!params.imageBase64) {
      return {
        ok: false,
        reason: 'parse',
        message: 'LogMeal 需要上傳食物照片（不支援純文字分析）。',
      };
    }
    return analyzeFoodWithLogMeal({
      endpointUrl: params.endpointUrl,
      imageBase64: params.imageBase64,
      mimeType: params.mimeType,
      imageUri: params.imageUri,
      text: params.text,
      signal: params.signal,
    });
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'no_key', message: '未設定 API Key' };
  }

  const userText = params.text?.trim();
  const prompt = params.imageBase64
    ? `${SCHEMA_INSTRUCTION}

重要：請以圖片為主要依據估算營養與份量；使用者文字只是補充（例如品名、口味、份量提示），不可只根據文字忽略圖片。
使用者補充：${userText || '（無額外文字）'}`
    : `${SCHEMA_INSTRUCTION}

使用者描述：${userText ?? '請分析這份食物'}`;

  const content: unknown[] = [];
  // Qwen-VL: put image first so vision tokens are not ignored when text is long.
  if (params.imageBase64) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${params.mimeType ?? 'image/jpeg'};base64,${params.imageBase64}`,
      },
    });
  }
  content.push({ type: 'text', text: prompt });

  const result = await chatCompletion({
    endpointUrl: params.endpointUrl,
    model: params.model,
    timeoutMs: 45_000,
    signal: params.signal,
    messages: [
      {
        role: 'system',
        content:
          '你是營養標示助手。有圖片時必須根據圖片內容判斷；若非食物必須回傳 is_food=false。文字僅作補充。只輸出 JSON。',
      },
      { role: 'user', content },
    ],
  });
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      message:
        result.reason === 'timeout'
          ? '分析逾時（45 秒）'
          : result.message,
    };
  }
  const parsed = parseAiResponse(result.content);
  if (!parsed.ok) {
    if (parsed.code === 'not_food') {
      return {
        ok: false,
        reason: 'not_food',
        message: parsed.error,
      };
    }
    return {
      ok: false,
      reason: 'parse',
      message: `AI 回應格式無效，請重試或改用手動新增。\n${parsed.error}\n預覽：${result.content.slice(0, 180)}`,
    };
  }
  return { ok: true, suggestion: parsed.suggestion };
}
