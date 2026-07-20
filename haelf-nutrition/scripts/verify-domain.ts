/**
 * Lightweight domain verification (no test runner dependency).
 * Run: npx tsx scripts/verify-domain.ts
 */
import {
  computeSnapshot,
  decimalHalfUp,
  displayKcal,
  displayMacroG,
  sumNutrients,
  displayNutrients,
} from '../src/domain/nutrition';
import { resolveGoalForDate } from '../src/domain/goals';
import { validateFoodDraft, validateQuantity, validateWeightKg } from '../src/domain/validation';
import { collectDataQualityWarnings } from '../src/domain/quality';
import { localDateRangeEnding, addLocalDays } from '../src/domain/dates';
import { parseAiResponse, serializeAiSuggestion } from '../src/services/ai/parser';
import type { DailyGoalVersion } from '../src/domain/types';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Nutrition
assert(computeSnapshot('PER_100_G', { kcal: 100, protein_g: 10, fat_g: 5, carbs_g: 8 }, 50).kcal === 50, 'per100');
assert(computeSnapshot('PER_SERVING', { kcal: 200, protein_g: 10, fat_g: 5, carbs_g: 8 }, 2).kcal === 400, 'serving');
assert(decimalHalfUp(1.25, 1) === 1.3, 'half-up 1.25->1.3');
assert(decimalHalfUp(1.15, 1) === 1.2, 'half-up 1.15');
assert(displayKcal(1.5) === 2, 'kcal half-up');
assert(displayMacroG(1.25) === 1.3, 'macro half-up');
const summed = sumNutrients([
  { kcal: 1.4, protein_g: 0.14, fat_g: 0, carbs_g: 0 },
  { kcal: 1.4, protein_g: 0.14, fat_g: 0, carbs_g: 0 },
]);
assert(displayNutrients(summed).kcal === 3, 'sum then display');

// Goals
const versions: DailyGoalVersion[] = [
  {
    id: 1,
    effectiveDate: '2026-01-01',
    kcal: 1800,
    proteinG: 100,
    fatG: 60,
    carbsG: 200,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    effectiveDate: '2026-07-01',
    kcal: 2000,
    proteinG: 120,
    fatG: 70,
    carbsG: 220,
    createdAt: '',
    updatedAt: '',
  },
];
assert(resolveGoalForDate(versions, '2026-06-30')?.kcal === 1800, 'goal past');
assert(resolveGoalForDate(versions, '2026-07-01')?.kcal === 2000, 'goal new');
assert(resolveGoalForDate(versions, '2025-12-31') === null, 'goal none');

// Validation
assert(validateQuantity(0, 'PER_100_G') !== null, 'qty>0');
assert(validateQuantity(10001, 'PER_100_G') !== null, 'qty max');
assert(validateWeightKg(0) !== null, 'weight');
assert(
  validateFoodDraft({
    name: '',
    basis: 'PER_100_G',
    sourceKcal: 100,
    sourceProteinG: 10,
    sourceFatG: 5,
    sourceCarbsG: 8,
    quantity: 100,
  }).some((e) => e.field === 'name'),
  'name required'
);

// Quality
const warns = collectDataQualityWarnings({
  basis: 'PER_100_G',
  sourceKcal: 500,
  sourceProteinG: 10,
  sourceFatG: 10,
  sourceCarbsG: 10,
});
assert(warns.length >= 1, 'kcal vs macro warning');

// Dates
assert(localDateRangeEnding('2026-07-20', 7).length === 7, '7 days');
assert(addLocalDays('2026-07-20', -1) === '2026-07-19', 'add days');

// AI roundtrip
const suggestion = {
  name: '飯',
  basis: 'PER_100_G' as const,
  quantity: 100,
  kcal: 130,
  protein_g: 2.5,
  fat_g: 0.3,
  carbs_g: 28,
  confidence: 0.8,
};
const json = serializeAiSuggestion(suggestion);
const parsed = parseAiResponse(json);
assert(parsed.ok, 'parse ok');
if (parsed.ok) {
  assert(parsed.suggestion.name === suggestion.name, 'roundtrip name');
  assert(parsed.suggestion.kcal === suggestion.kcal, 'roundtrip kcal');
}
assert(!parseAiResponse('```json\n' + json + '\n```').ok, 'reject fence');
assert(!parseAiResponse(json + '\nextra').ok, 'reject extra');

console.log('verify-domain: all passed');
