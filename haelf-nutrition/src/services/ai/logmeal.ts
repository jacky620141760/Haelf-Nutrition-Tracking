import type { AiSuggestion } from '../../domain/types';
import { getApiKey } from '../secureStore';

const SEGMENT_PATH = '/v2/image/segmentation/complete';
const NUTRITION_PATH = '/v2/nutrition/recipe/nutritionalInfo';

export function isLogMealEndpoint(endpointUrl: string): boolean {
  try {
    return new URL(endpointUrl).hostname.includes('logmeal.com');
  } catch {
    return /logmeal\.com/i.test(endpointUrl);
  }
}

function logMealBaseUrl(endpointUrl: string): string {
  try {
    const u = new URL(endpointUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'https://api.logmeal.com';
  }
}

type SegmentResponse = {
  imageId?: number;
  segmentation_results?: Array<{
    recognition_results?: Array<{ name?: string; prob?: number }>;
  }>;
};

type NutrientQty = { quantity?: number; unit?: string; label?: string };

type NutritionResponse = {
  foodName?: string[];
  hasNutritionalInfo?: boolean;
  nutritional_info?: {
    calories?: number;
    totalNutrients?: Record<string, NutrientQty>;
  };
};

function pickTopDishNames(data: SegmentResponse): { name: string; confidence: number } {
  const names: string[] = [];
  let bestProb = 0;
  for (const region of data.segmentation_results ?? []) {
    const top = region.recognition_results?.[0];
    if (top?.name?.trim()) {
      names.push(top.name.trim());
      if (typeof top.prob === 'number' && top.prob > bestProb) bestProb = top.prob;
    }
  }
  return {
    name: names.length ? names.join(' + ') : 'LogMeal dish',
    confidence: bestProb > 0 ? Math.min(1, bestProb) : 0.5,
  };
}

function nutrientGrams(info: NutritionResponse['nutritional_info'], code: string): number {
  const qty = info?.totalNutrients?.[code]?.quantity;
  return typeof qty === 'number' && Number.isFinite(qty) ? qty : 0;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary =
    typeof atob === 'function'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function appendImage(
  form: FormData,
  params: { imageBase64: string; mimeType: string; imageUri?: string }
): Promise<void> {
  const mime = params.mimeType || 'image/jpeg';
  const name = mime.includes('png') ? 'food.png' : 'food.jpg';

  if (params.imageUri && typeof document === 'undefined') {
    form.append('image', {
      uri: params.imageUri,
      type: mime,
      name,
    } as unknown as Blob);
    return;
  }

  const bytes = base64ToUint8Array(params.imageBase64);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime });
  form.append('image', blob, name);
}

export type LogMealResult =
  | { ok: true; suggestion: AiSuggestion }
  | { ok: false; reason: 'timeout' | 'network' | 'http' | 'no_key' | 'cancelled' | 'parse'; message: string };

export async function analyzeFoodWithLogMeal(params: {
  endpointUrl: string;
  imageBase64: string;
  mimeType?: string;
  imageUri?: string;
  /** Optional user note — LogMeal vision ignores text; we apply it as the dish name. */
  text?: string;
  signal?: AbortSignal;
}): Promise<LogMealResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'no_key', message: '未設定 API Key' };
  }

  const base = logMealBaseUrl(params.endpointUrl);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 45_000);
  const cancel = () => controller.abort();
  if (params.signal?.aborted) cancel();
  params.signal?.addEventListener('abort', cancel, { once: true });

  try {
    const form = new FormData();
    await appendImage(form, {
      imageBase64: params.imageBase64,
      mimeType: params.mimeType ?? 'image/jpeg',
      imageUri: params.imageUri,
    });

    const segmentRes = await fetch(`${base}${SEGMENT_PATH}?language=eng`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!segmentRes.ok) {
      const text = await segmentRes.text().catch(() => '');
      const action =
        segmentRes.status === 401 || segmentRes.status === 403
          ? 'LogMeal 拒絕授權，請確認用的是 APIUser token（不是 Company token）。'
          : segmentRes.status === 404
            ? '找不到 LogMeal 端點。'
            : segmentRes.status === 429
              ? 'LogMeal 已達速率或額度限制。'
              : `LogMeal 辨識失敗 HTTP ${segmentRes.status}。`;
      return {
        ok: false,
        reason: 'http',
        message: `${action}${text ? `\n${text.slice(0, 240)}` : ''}`,
      };
    }

    const segment = (await segmentRes.json()) as SegmentResponse;
    if (segment.imageId == null) {
      return { ok: false, reason: 'parse', message: 'LogMeal 未回傳 imageId' };
    }

    const { name, confidence } = pickTopDishNames(segment);

    const nutritionRes = await fetch(`${base}${NUTRITION_PATH}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageId: segment.imageId }),
    });

    if (!nutritionRes.ok) {
      const text = await nutritionRes.text().catch(() => '');
      return {
        ok: false,
        reason: 'http',
        message: `LogMeal 營養資訊失敗 HTTP ${nutritionRes.status}${text ? `\n${text.slice(0, 240)}` : ''}`,
      };
    }

    const nutrition = (await nutritionRes.json()) as NutritionResponse;
    const info = nutrition.nutritional_info;
    const kcal = info?.calories;
    if (kcal == null || !Number.isFinite(kcal)) {
      return {
        ok: false,
        reason: 'parse',
        message:
          'LogMeal 未回傳營養素。請確認方案含 Nutritional Information，並先成功辨識到食物。',
      };
    }

    const foodNames = (nutrition.foodName ?? []).filter(Boolean);
    const recognizedName = foodNames.length ? foodNames.join(' + ') : name;
    const userNote = params.text?.trim();
    return {
      ok: true,
      suggestion: {
        // LogMeal only sees the photo; prefer the user's text as the display name when provided.
        name: userNote || recognizedName,
        basis: 'PER_SERVING',
        quantity: 1,
        kcal,
        protein_g: nutrientGrams(info, 'PROCNT'),
        fat_g: nutrientGrams(info, 'FAT'),
        carbs_g: nutrientGrams(info, 'CHOCDF'),
        confidence,
      },
    };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return timedOut
        ? { ok: false, reason: 'timeout', message: 'LogMeal 分析逾時（45 秒）' }
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
