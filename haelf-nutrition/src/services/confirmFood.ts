import {
  createFoodEntry,
  touchCatalogUsed,
  upsertCatalogFromConfirmed,
} from '../db/repositories/food';
import { upsertBarcodeCache } from '../db/repositories/barcode';
import { getTimeZoneMetadata, toLocalDateString, utcNowIso } from '../domain/dates';
import type { FoodDraft } from '../domain/types';
import { validateFoodDraft } from '../domain/validation';

export async function confirmFoodDraft(
  draft: FoodDraft,
  options?: { localDate?: string; editId?: number }
): Promise<{ ok: true; id: number } | { ok: false; errors: string[] }> {
  const errors = validateFoodDraft({
    name: draft.name,
    basis: draft.basis,
    sourceKcal: draft.sourceKcal,
    sourceProteinG: draft.sourceProteinG,
    sourceFatG: draft.sourceFatG,
    sourceCarbsG: draft.sourceCarbsG,
    quantity: draft.quantity,
  });
  if (errors.length) {
    return { ok: false, errors: errors.map((e) => `${e.field}: ${e.message}`) };
  }

  const now = new Date();
  const tz = getTimeZoneMetadata(now);
  const localDate = options?.localDate ?? toLocalDateString(now);
  const utcTimestamp = draft.utcTimestamp ?? utcNowIso(now);

  const catalogId = await upsertCatalogFromConfirmed({
    name: draft.name.trim(),
    basis: draft.basis,
    sourceKcal: draft.sourceKcal!,
    sourceProteinG: draft.sourceProteinG!,
    sourceFatG: draft.sourceFatG!,
    sourceCarbsG: draft.sourceCarbsG!,
    barcode: draft.barcode,
    existingId: draft.catalogId,
  });

  const payload = {
    name: draft.name.trim(),
    mealType: draft.mealType,
    basis: draft.basis,
    sourceKcal: draft.sourceKcal!,
    sourceProteinG: draft.sourceProteinG!,
    sourceFatG: draft.sourceFatG!,
    sourceCarbsG: draft.sourceCarbsG!,
    quantity: draft.quantity!,
    source: draft.source,
    catalogId,
    barcode: draft.barcode ?? null,
    utcTimestamp,
    localDate,
    tzIana: tz.iana,
    tzOffsetMinutes: tz.utcOffsetMinutes,
  };

  let id: number;
  if (options?.editId) {
    const { updateFoodEntry } = await import('../db/repositories/food');
    await updateFoodEntry(options.editId, payload);
    id = options.editId;
  } else {
    id = await createFoodEntry(payload);
  }

  await touchCatalogUsed(catalogId);

  if (draft.barcode && (draft.source === 'off' || draft.source === 'cache')) {
    await upsertBarcodeCache({
      barcode: draft.barcode,
      name: draft.name.trim(),
      basis: draft.basis,
      sourceKcal: draft.sourceKcal!,
      sourceProteinG: draft.sourceProteinG!,
      sourceFatG: draft.sourceFatG!,
      sourceCarbsG: draft.sourceCarbsG!,
    });
  }

  return { ok: true, id };
}
