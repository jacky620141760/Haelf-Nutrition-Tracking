import { parseAiResponse } from './parser';
import type { AiSuggestion } from '../../domain/types';
import { getApiKey } from '../secureStore';

const SCHEMA_INSTRUCTION = `以單一 JSON 物件回覆，勿包含 markdown 或額外文字。欄位：name (字串), basis (PER_100_G 或 PER_SERVING), quantity (數字), kcal, protein_g, fat_g, carbs_g, confidence (0 到 1)。數值須為有限十進位數。basis 為 PER_100_G 時 quantity 為克數；PER_SERVING 時為份數。kcal/protein_g/fat_g/carbs_g 為依 basis 的來源營養值（非已乘上食用量的結果）。`;

export type AiClientResult =
  | { ok: true; suggestion: AiSuggestion }
  | { ok: false; reason: 'timeout' | 'network' | 'parse' | 'http' | 'no_key' | 'cancelled'; message: string };

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
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: 0.2,
      }),
    });
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
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
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

/** Capability_Check: 10s. Returns true only if explicitly confirmed vision support. */
export async function checkVisionCapability(
  endpointUrl: string,
  model: string,
  signal?: AbortSignal
): Promise<'supported' | 'unsupported' | 'unknown' | 'cancelled'> {
  const lower = model.toLowerCase();
  // Heuristic + probe: models with vision/vl in name often support images
  const nameHint =
    lower.includes('vision') ||
    lower.includes('vl') ||
    lower.includes('gpt-4o') ||
    lower.includes('gemini');

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
    if (!m) return nameHint ? 'unknown' : 'unsupported';
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
  signal?: AbortSignal;
}): Promise<AiClientResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'no_key', message: '未設定 API Key' };
  }
  const content: unknown[] = [
    { type: 'text', text: `${SCHEMA_INSTRUCTION}\n\n使用者描述：${params.text ?? '請分析圖片中的食物'}` },
  ];
  if (params.imageBase64) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${params.mimeType ?? 'image/jpeg'};base64,${params.imageBase64}`,
      },
    });
  }
  const result = await chatCompletion({
    endpointUrl: params.endpointUrl,
    model: params.model,
    timeoutMs: 30_000,
    signal: params.signal,
    messages: [
      { role: 'system', content: '你是營養標示助手。' },
      { role: 'user', content },
    ],
  });
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      message:
        result.reason === 'timeout'
          ? '分析逾時（30 秒）'
          : result.message,
    };
  }
  const parsed = parseAiResponse(result.content);
  if (!parsed.ok) {
    return {
      ok: false,
      reason: 'parse',
      message: `AI 回應格式無效，請重試或改用手動新增。\n${parsed.error}`,
    };
  }
  return { ok: true, suggestion: parsed.suggestion };
}
