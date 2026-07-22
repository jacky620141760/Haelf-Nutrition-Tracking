import { getSyncMeta, setSyncMeta } from '../db/repositories/sync';

const AI_KEY = 'onboarding_ai_pending';
const STEPS_KEY = 'onboarding_steps_pending';

export async function startPostSignupOnboarding(): Promise<void> {
  await setSyncMeta(AI_KEY, '1');
  await setSyncMeta(STEPS_KEY, '1');
}

export async function isAiOnboardingPending(): Promise<boolean> {
  return (await getSyncMeta(AI_KEY)) === '1';
}

export async function isStepsOnboardingPending(): Promise<boolean> {
  return (await getSyncMeta(STEPS_KEY)) === '1';
}

export async function completeAiOnboarding(): Promise<void> {
  await setSyncMeta(AI_KEY, '0');
}

export async function completeStepsOnboarding(): Promise<void> {
  await setSyncMeta(STEPS_KEY, '0');
}

export async function clearOnboardingFlags(): Promise<void> {
  await setSyncMeta(AI_KEY, '0');
  await setSyncMeta(STEPS_KEY, '0');
}
