import { useState } from 'react';
import {
  estimateKcalFromMacroInputs,
  formatEstimatedKcal,
  nextKcalInput,
  type KcalLinkMode,
} from '@/src/domain/nutrition';

export type KcalInputMode = KcalLinkMode;

type NutrientField = 'protein' | 'fat' | 'carbs';

type InitialValues = {
  kcal?: string;
  protein?: string;
  fat?: string;
  carbs?: string;
  mode?: KcalInputMode;
};

/** Shared P/F/C → kcal linking for any screen that edits those four fields. */
export function useLinkedMacroKcal(initial: InitialValues = {}) {
  const [kcal, setKcal] = useState(initial.kcal ?? '');
  const [protein, setProtein] = useState(initial.protein ?? '');
  const [fat, setFat] = useState(initial.fat ?? '');
  const [carbs, setCarbs] = useState(initial.carbs ?? '');
  const [kcalMode, setKcalMode] = useState<KcalInputMode>(initial.mode ?? 'linked');

  const updateLinkedKcal = (
    field: NutrientField,
    value: string,
    mode: KcalInputMode = kcalMode
  ) => {
    const next = {
      protein: field === 'protein' ? value : protein,
      fat: field === 'fat' ? value : fat,
      carbs: field === 'carbs' ? value : carbs,
    };
    setKcal(nextKcalInput(mode, kcal, next.protein, next.fat, next.carbs));
  };

  const setMacro = (field: NutrientField, value: string) => {
    if (field === 'protein') setProtein(value);
    if (field === 'fat') setFat(value);
    if (field === 'carbs') setCarbs(value);
    updateLinkedKcal(field, value);
  };

  const onKcalChange = (value: string) => {
    setKcalMode('manual');
    setKcal(value);
  };

  const relinkKcal = () => {
    const estimate = estimateKcalFromMacroInputs(protein, fat, carbs);
    setKcalMode('linked');
    setKcal(estimate === null ? '' : formatEstimatedKcal(estimate));
  };

  const setValues = (next: InitialValues) => {
    if (next.kcal != null) setKcal(next.kcal);
    if (next.protein != null) setProtein(next.protein);
    if (next.fat != null) setFat(next.fat);
    if (next.carbs != null) setCarbs(next.carbs);
    if (next.mode != null) setKcalMode(next.mode);
  };

  return {
    kcal,
    protein,
    fat,
    carbs,
    kcalMode,
    onKcalChange,
    onProteinChange: (value: string) => setMacro('protein', value),
    onFatChange: (value: string) => setMacro('fat', value),
    onCarbsChange: (value: string) => setMacro('carbs', value),
    relinkKcal,
    setValues,
    setKcal,
    setProtein,
    setFat,
    setCarbs,
    setKcalMode,
  };
}
