import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { FoodDraft, Nutrients } from '@/src/domain/types';
import { computeSnapshot } from '@/src/domain/nutrition';
import { parseFiniteNumber, type FieldError } from '@/src/domain/validation';
import {
  useLinkedMacroKcal,
  type KcalInputMode,
} from '@/src/hooks/useLinkedMacroKcal';

export type { KcalInputMode };

type NutrientStrings = {
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
};

function initialMode(draft: FoodDraft): KcalInputMode {
  // Keep AI / OFF / cache kcal until the user explicitly relinks.
  // Manual foods (including catalog) stay linked so typing P/F/C updates kcal.
  return draft.source === 'manual' ? 'linked' : 'manual';
}

function nutrientStrings(draft: FoodDraft): NutrientStrings {
  return {
    kcal: draft.sourceKcal == null ? '' : String(draft.sourceKcal),
    protein: draft.sourceProteinG == null ? '' : String(draft.sourceProteinG),
    fat: draft.sourceFatG == null ? '' : String(draft.sourceFatG),
    carbs: draft.sourceCarbsG == null ? '' : String(draft.sourceCarbsG),
  };
}

function previewValue(raw: string): number | null {
  if (raw.trim() === '') return 0;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function useFoodNutrientForm(initialDraft: FoodDraft) {
  const [draft, setDraft] = useState(initialDraft);
  const [name, setName] = useState(initialDraft.name);
  const [quantity, setQuantity] = useState(
    initialDraft.quantity == null ? '' : String(initialDraft.quantity)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nutrients = useLinkedMacroKcal({
    ...nutrientStrings(initialDraft),
    mode: initialMode(initialDraft),
  });

  const applyDraft = (next: FoodDraft, mode: KcalInputMode = initialMode(next)) => {
    setDraft(next);
    setName(next.name);
    setQuantity(next.quantity == null ? '' : String(next.quantity));
    nutrients.setValues({
      ...nutrientStrings(next),
      mode,
    });
    setErrors({});
  };

  const buildDraft = (): FoodDraft => ({
    ...draft,
    name: name.trim(),
    sourceKcal: parseFiniteNumber(nutrients.kcal),
    sourceProteinG: parseFiniteNumber(nutrients.protein),
    sourceFatG: parseFiniteNumber(nutrients.fat),
    sourceCarbsG: parseFiniteNumber(nutrients.carbs),
    quantity: parseFiniteNumber(quantity),
  });

  const setValidationErrors = (validationErrors: FieldError[]) => {
    const nextErrors: Record<string, string> = {};
    for (const error of validationErrors) nextErrors[error.field] = error.message;
    setErrors(nextErrors);
  };

  const preview = useMemo<Nutrients | null>(() => {
    const parsedQuantity = Number(quantity);
    const parsedKcal = Number(nutrients.kcal);
    const parsedProtein = previewValue(nutrients.protein);
    const parsedFat = previewValue(nutrients.fat);
    const parsedCarbs = previewValue(nutrients.carbs);
    if (
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity <= 0 ||
      !Number.isFinite(parsedKcal) ||
      parsedKcal < 0 ||
      parsedProtein === null ||
      parsedFat === null ||
      parsedCarbs === null
    ) {
      return null;
    }

    try {
      return computeSnapshot(
        draft.basis,
        {
          kcal: parsedKcal,
          protein_g: parsedProtein,
          fat_g: parsedFat,
          carbs_g: parsedCarbs,
        },
        parsedQuantity
      );
    } catch {
      return null;
    }
  }, [
    draft.basis,
    nutrients.carbs,
    nutrients.fat,
    nutrients.kcal,
    nutrients.protein,
    quantity,
  ]);

  return {
    draft,
    setDraft: setDraft as Dispatch<SetStateAction<FoodDraft>>,
    name,
    setName,
    kcal: nutrients.kcal,
    protein: nutrients.protein,
    fat: nutrients.fat,
    carbs: nutrients.carbs,
    quantity,
    setQuantity,
    errors,
    kcalMode: nutrients.kcalMode,
    preview,
    onKcalChange: nutrients.onKcalChange,
    onProteinChange: nutrients.onProteinChange,
    onFatChange: nutrients.onFatChange,
    onCarbsChange: nutrients.onCarbsChange,
    relinkKcal: nutrients.relinkKcal,
    applyDraft,
    buildDraft,
    setValidationErrors,
  };
}
