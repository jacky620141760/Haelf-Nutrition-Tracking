import type { AiEndpointConfig } from '../../domain/types';
import { assertWritable, getDb } from '../database';
import { BUILTIN_AI, isAiSettingsFrozen } from '../../services/ai/builtinConfig';

type Row = {
  endpoint_url: string;
  model: string;
  vision_supported: number | null;
  consent_given: number;
};

export async function getAiSettings(): Promise<AiEndpointConfig> {
  const row = await getDb().getFirstAsync<Row>(`SELECT * FROM ai_settings WHERE id = 1`);
  if (isAiSettingsFrozen()) {
    return {
      endpointUrl: BUILTIN_AI.endpointUrl,
      model: BUILTIN_AI.model,
      visionSupported: true,
      consentGiven: !!row?.consent_given,
    };
  }
  return {
    endpointUrl: row?.endpoint_url ?? '',
    model: row?.model ?? '',
    visionSupported:
      row?.vision_supported === null || row?.vision_supported === undefined
        ? null
        : !!row.vision_supported,
    consentGiven: !!row?.consent_given,
  };
}

export async function saveAiSettings(input: {
  endpointUrl: string;
  model: string;
  resetCapability?: boolean;
}): Promise<void> {
  if (isAiSettingsFrozen()) return;
  assertWritable();
  const now = new Date().toISOString();
  if (input.resetCapability) {
    await getDb().runAsync(
      `UPDATE ai_settings SET endpoint_url=?, model=?, vision_supported=NULL, updated_at=? WHERE id=1`,
      [input.endpointUrl, input.model, now]
    );
  } else {
    await getDb().runAsync(
      `UPDATE ai_settings SET endpoint_url=?, model=?, updated_at=? WHERE id=1`,
      [input.endpointUrl, input.model, now]
    );
  }
}

export async function setVisionCapability(supported: boolean | null): Promise<void> {
  assertWritable();
  const now = new Date().toISOString();
  await getDb().runAsync(
    `UPDATE ai_settings SET vision_supported=?, updated_at=? WHERE id=1`,
    [supported === null ? null : supported ? 1 : 0, now]
  );
}

export async function setAiConsent(given: boolean): Promise<void> {
  assertWritable();
  const now = new Date().toISOString();
  await getDb().runAsync(
    `UPDATE ai_settings SET consent_given=?, updated_at=? WHERE id=1`,
    [given ? 1 : 0, now]
  );
}
