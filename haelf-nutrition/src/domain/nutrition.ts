import type { Nutrients, NutritionBasis } from './types';

/** Decimal half-up: midpoint rounds toward larger absolute value. */
export function decimalHalfUp(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const sign = scaled < 0 ? -1 : 1;
  const abs = Math.abs(scaled);
  const floored = Math.floor(abs);
  const fraction = abs - floored;
  const roundedAbs = fraction >= 0.5 ? floored + 1 : floored;
  return (sign * roundedAbs) / factor;
}

export function displayKcal(value: number): number {
  return decimalHalfUp(value, 0);
}

export function displayMacroG(value: number): number {
  return decimalHalfUp(value, 1);
}

export function displayWeightKg(value: number): number {
  return decimalHalfUp(value, 1);
}

export function computeSnapshot(
  basis: NutritionBasis,
  source: Nutrients,
  quantity: number
): Nutrients {
  if (basis === 'PER_100_G') {
    return {
      kcal: (source.kcal * quantity) / 100,
      protein_g: (source.protein_g * quantity) / 100,
      fat_g: (source.fat_g * quantity) / 100,
      carbs_g: (source.carbs_g * quantity) / 100,
    };
  }
  return {
    kcal: source.kcal * quantity,
    protein_g: source.protein_g * quantity,
    fat_g: source.fat_g * quantity,
    carbs_g: source.carbs_g * quantity,
  };
}

export function sumNutrients(items: Nutrients[]): Nutrients {
  return items.reduce(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      protein_g: acc.protein_g + n.protein_g,
      fat_g: acc.fat_g + n.fat_g,
      carbs_g: acc.carbs_g + n.carbs_g,
    }),
    { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }
  );
}

export function displayNutrients(n: Nutrients): Nutrients {
  return {
    kcal: displayKcal(n.kcal),
    protein_g: displayMacroG(n.protein_g),
    fat_g: displayMacroG(n.fat_g),
    carbs_g: displayMacroG(n.carbs_g),
  };
}

/** Estimated kcal from macros: P×4 + F×9 + C×4 */
export function macroEstimatedKcal(p: number, f: number, c: number): number {
  return p * 4 + f * 9 + c * 4;
}
