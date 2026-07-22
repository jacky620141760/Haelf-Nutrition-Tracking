/**
 * Lightweight domain verification (no test runner dependency).
 * Run: npx tsx scripts/verify-domain.ts
 */
import {
  computeSnapshot,
  decimalHalfUp,
  displayKcal,
  displayMacroG,
  estimateKcalFromMacroInputs,
  nextKcalInput,
  sumNutrients,
  displayNutrients,
} from '../src/domain/nutrition';
import { diffVsGoal, resolveGoalForDate } from '../src/domain/goals';
import { validateFoodDraft, validateQuantity, validateWeightKg } from '../src/domain/validation';
import { collectDataQualityWarnings } from '../src/domain/quality';
import {
  localDateRangeEnding,
  addLocalDays,
  resolveEntryTimeForSave,
} from '../src/domain/dates';
import {
  calorieRingSemantic,
  clampProgress,
  nutrientProgress,
  remainingKcal,
  splitContinuousSegments,
} from '../src/domain/progress';
import { pendingMigrations } from '../src/db/schema';
import { parseAiResponse, serializeAiSuggestion } from '../src/services/ai/parser';
import { mapOffToDraft } from '../src/services/off';
import type {
  DailyGoalVersion,
  DailyStepTotal,
  ExerciseEntry,
  FoodEntry,
  RecipeIngredient,
  WaterEntry,
} from '../src/domain/types';
import { buildDailySummary, foodLoggingStreak } from '../src/domain/dailySummary';
import { mlToWater, waterToMl } from '../src/domain/water';
import { recipePerServing } from '../src/domain/recipes';
import { normalizeSteps, preferManualSteps } from '../src/domain/steps';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertClose(actual: number | null, expected: number, msg: string) {
  assert(actual !== null && Math.abs(actual - expected) < 1e-9, msg);
}

function assertThrows(fn: () => unknown, msg: string) {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(msg);
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
assert(estimateKcalFromMacroInputs('', '', '') === null, 'blank macros do not force kcal');
assertClose(estimateKcalFromMacroInputs('10', '', ''), 40, 'protein progressive kcal');
assertClose(estimateKcalFromMacroInputs('10', '5', ''), 85, 'fat progressive kcal');
assertClose(estimateKcalFromMacroInputs('10', '5', '20'), 165, 'carb progressive kcal');
assertClose(estimateKcalFromMacroInputs('0.5', '0.5', '0.5'), 8.5, 'decimal macro kcal');
assert(estimateKcalFromMacroInputs('-1', '5', '20') === null, 'negative pauses kcal');
assert(estimateKcalFromMacroInputs('abc', '5', '20') === null, 'invalid pauses kcal');
assert(nextKcalInput('linked', '85', '10', '5', '20') === '165', 'linked updates kcal');
assert(nextKcalInput('linked', '165', '', '', '') === '', 'linked clears kcal when macros blank');
assert(nextKcalInput('linked', '165', 'abc', '5', '20') === '165', 'linked pauses on invalid macro');
assert(nextKcalInput('manual', '123', '10', '5', '20') === '123', 'manual preserves kcal');

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
const goalDiff = diffVsGoal(
  { kcal: 1600, protein_g: 90, fat_g: 55, carbs_g: 180 },
  { kcal: 1800, protein_g: 100, fat_g: 60, carbs_g: 200 }
);
assert(goalDiff.kcal === -200 && goalDiff.protein_g === -10, 'daily goal diff');

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
const originalTime = {
  utcTimestamp: '2025-01-02T03:04:05.000Z',
  localDate: '2025-01-02',
  tzIana: 'Asia/Taipei',
  tzOffsetMinutes: 480,
};
assert(
  JSON.stringify(
    resolveEntryTimeForSave(
      { original: originalTime, requestedLocalDate: '2026-07-20' },
      new Date('2026-07-20T12:00:00.000Z')
    )
  ) === JSON.stringify(originalTime),
  'food edit preserves original time'
);

// Progress rings and chart gaps
assert(nutrientProgress(0, null) === 0, 'no goal progress');
assert(clampProgress(1.2) === 1, 'ring clamps visual progress');
assert(calorieRingSemantic(0.5, true) === 'under', 'ring under');
assert(calorieRingSemantic(0.6, true) === 'onTrack', 'ring on track');
assert(calorieRingSemantic(0.95, true) === 'approaching', 'ring approaching');
assert(calorieRingSemantic(1, true) === 'approaching', 'ring exactly goal');
assert(calorieRingSemantic(1.01, true) === 'over', 'ring over');
assert(remainingKcal(2100, 2000) === -100, 'ring remaining over');
const segments = splitContinuousSegments([1, 2, null, 3, null, null, 4, 5]);
assert(JSON.stringify(segments) === JSON.stringify([[1, 2], [3], [4, 5]]), 'weight gaps split lines');

// Migration registry
assert(
  JSON.stringify(pendingMigrations(0).map((migration) => migration.version)) === '[1,2]',
  'migration v0 to current'
);
assert(
  JSON.stringify(pendingMigrations(1).map((migration) => migration.version)) === '[2]',
  'migration v1 to v2'
);
assert(pendingMigrations(2).length === 0, 'current schema has no migration');
assertThrows(() => pendingMigrations(3, 2), 'newer database must be rejected');

// v2 daily summary, water, recipes, streak, and steps
const summary = buildDailySummary({
  localDate: '2026-07-20',
  foodEntries: [
    { snapKcal: 1500, snapProteinG: 100, snapFatG: 50, snapCarbsG: 180 },
  ] as FoodEntry[],
  exerciseEntries: [{ burnedKcal: 300, durationMinutes: 45 }] as ExerciseEntry[],
  waterEntries: [{ ml: 750 }, { ml: 500 }] as WaterEntry[],
  stepTotal: {
    localDate: '2026-07-20',
    steps: 8000,
    source: 'pedometer',
    syncedAt: '',
    updatedAt: '',
  },
  goal: versions[0],
  waterGoal: { id: 1, effectiveDate: '2026-01-01', ml: 2000, createdAt: '', updatedAt: '' },
  diaryStatus: null,
});
assert(summary.remainingKcal === 600, 'remaining = goal - food + exercise');
assert(summary.waterMl === 1250 && summary.steps === 8000, 'daily summary habits');
assertClose(waterToMl(1, 'cup'), 236.588, 'cup to ml');
assertClose(mlToWater(29.5735, 'oz'), 1, 'ml to ounce');
const ingredient = {
  basis: 'PER_SERVING',
  sourceKcal: 400,
  sourceProteinG: 20,
  sourceFatG: 10,
  sourceCarbsG: 50,
  quantity: 2,
} as RecipeIngredient;
const perServing = recipePerServing([ingredient], 4);
assert(perServing?.kcal === 200 && perServing.protein_g === 10, 'recipe per serving');
assert(
  foodLoggingStreak(['2026-07-18', '2026-07-19', '2026-07-20'], '2026-07-20') === 3,
  'food logging streak'
);
assert(normalizeSteps(1234.6) === 1235 && normalizeSteps(-1) === null, 'normalize steps');
const manualSteps: DailyStepTotal = {
  localDate: '2026-07-20',
  steps: 5000,
  source: 'manual',
  syncedAt: '',
  updatedAt: '',
};
assert(
  preferManualSteps(manualSteps, { ...manualSteps, source: 'pedometer', steps: 6000 }) ===
    manualSteps,
  'pedometer does not overwrite manual steps'
);

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

// Open Food Facts unit mapping
const offKj = mapOffToDraft(
  ' 123 ',
  {
    nutriments: {
      energy_100g: 418.4,
      energy_unit: 'kJ',
      proteins_100g: 10,
      proteins_unit: 'g',
    },
  },
  'snack'
);
assertClose(offKj.sourceKcal, 100, 'OFF kJ converts to kcal');
assert(offKj.sourceProteinG === 10 && offKj.barcode === '123', 'OFF gram and barcode');
const offKcal = mapOffToDraft(
  '456',
  { nutriments: { energy_100g: 100, energy_unit: 'kcal' } },
  'snack'
);
assert(offKcal.sourceKcal === 100, 'OFF kcal is not divided by 4.184');
const offUnknown = mapOffToDraft(
  '789',
  { nutriments: { energy_100g: 100, proteins_100g: 12 } },
  'snack'
);
assert(offUnknown.sourceKcal === null, 'OFF unknown energy unit stays unknown');
assert(offUnknown.sourceProteinG === null, 'OFF unknown macro unit stays unknown');
assert(offUnknown.dataQualityWarnings.length > 0, 'OFF unknown units warn');

console.log('verify-domain: all passed');
