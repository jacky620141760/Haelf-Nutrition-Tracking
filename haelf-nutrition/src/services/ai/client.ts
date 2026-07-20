import { parseAiResponse } from './parser';
import type { AiSuggestion } from '../../domain/types';
import { getApiKey } from '../secureStore';

const SCHEMA_INSTRUCTION = `以單一 JSON 物件回覆，勿包含 markdown 或額外文字。欄位：name (字串), basis (PER_100_G 或 PER_SERVING), quantity (數字), kcal, protein_g, fat_g, carbs_g, confidence (0 到 1)。數值須為有限十進位數。basis 為 PER_100_G 時 quantity 為克數；PER_SERVING 時為份數。kcal/protein_g/fat_g/carbs_g 為依 basis 的來源營養值（非已乘上食用量的結果）。`;

export type AiClientResult =
  | { ok: true; suggestion: AiSuggestion }
  | { ok: false; reason: 'timeout' | 'network' | 'parse' | 'http' | 'no_key'; message: string };

async function chatCompletion(params: {
  endpointUrl: string;
  model: string;
  messages: unknown[];
  timeoutMs: number;
}): Promise<{ ok: true; content: string } | { ok: false; reason: 'timeout' | 'network' | 'http'; message: string }> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'network', message: '未設定 API Key' };
  }
  const base = params.endpointUrl.replace(/\/$/, '');
  const url = base.includes('/chat/completions')
    ? base
    : `${base}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
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
      return { ok: false, reason: 'http', message: `HTTP ${res.status} ${text.slice(0, 200)}` };
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
      return { ok: false, reason: 'timeout', message: '逾時' };
    }
    return {
      ok: false,
      reason: 'network',
      message: e instanceof Error ? e.message : '連線失敗',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Capability_Check: 10s. Returns true only if explicitly confirmed vision support. */
export async function checkVisionCapability(
  endpointUrl: string,
  model: string
): Promise<'supported' | 'unsupported' | 'unknown'> {
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
    if (nameHint) return 'unknown';
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
    messages: [
      { role: 'system', content: '你是營養標示助手。' },
      { role: 'user', content },
    ],
  });
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason === 'timeout' ? 'timeout' : result.reason === 'http' ? 'http' : 'network',
      message:
        result.reason === 'timeout'
          ? '分析逾時（30 秒）'
          : result.message,
    };
  }
  const parsed = parseAiResponse(result.content);
  if (!parsed.ok) {
    return { ok: false, reason: 'parse', message: parsed.error };
  }
  return { ok: true, suggestion: parsed.suggestion };
}
