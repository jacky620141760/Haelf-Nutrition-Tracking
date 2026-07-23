/**
 * Built-in AI provider for temporary shipping.
 * Set AI_SETTINGS_FROZEN=false later to re-enable user endpoint/key editing.
 */
export const AI_SETTINGS_FROZEN = true;

export const BUILTIN_AI = {
  /** Alibaba Cloud MaaS — OpenAI-compatible base (app appends /chat/completions). */
  endpointUrl:
    'https://ws-hzrqeirktd9or5xk.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
  /** Vision model for meal photos (Aliyun MaaS OpenAI-compatible). */
  model: 'qwen3-vl-plus',
  apiKey:
    'sk-ws-H.XLRIHY.hRpE.MEUCIQCgg0UonTq8QoFBh1RSe6v4pep-vlyKAAJMYCZEnwl4ZQIgN1McBfj6ms6jgdo7eRm5DZke1rhzqMv3Owfdlxhv8iE',
} as const;

export function isAiSettingsFrozen(): boolean {
  return AI_SETTINGS_FROZEN;
}
