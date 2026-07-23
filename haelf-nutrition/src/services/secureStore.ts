import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { BUILTIN_AI, isAiSettingsFrozen } from './ai/builtinConfig';

const KEY = 'haelf_ai_api_key';

/** Web Preview: in-memory only (Req 10). */
let webMemoryKey: string | null = null;

export function isWebPreview(): boolean {
  return Platform.OS === 'web';
}

export async function saveApiKey(apiKey: string): Promise<void> {
  if (isAiSettingsFrozen()) return;
  if (isWebPreview()) {
    webMemoryKey = apiKey;
    return;
  }
  await SecureStore.setItemAsync(KEY, apiKey);
}

export async function getApiKey(): Promise<string | null> {
  if (isAiSettingsFrozen()) return BUILTIN_AI.apiKey;
  if (isWebPreview()) {
    return webMemoryKey;
  }
  return SecureStore.getItemAsync(KEY);
}

export async function clearApiKey(): Promise<void> {
  if (isAiSettingsFrozen()) return;
  if (isWebPreview()) {
    webMemoryKey = null;
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
