import {
  createFoodEntry,
  getFoodEntry,
  touchCatalogUsed,
  updateFoodEntry,
  upsertCatalogFromConfirmed,
} from '../db/repositories/food';
import { upsertBarcodeCache } from '../db/repositories/barcode';
import { runInTransaction } from '../db/database';
import {
  resolveEntryTimeForSave,
  type EntryTimeMetadata,
} from '../domain/dates';
import type { FoodDraft } from '../domain/types';
import { validateFoodDraft } from '../domain/validation';

export async function confirmFoodDraft(
  draft: FoodDraft,
  options?: {
    localDate?: string;
    editId?: number;
    originalTime?: EntryTimeMetadata;
    logGroupId?: string | null;
    updateCatalog?: boolean;
  }
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

  const {
    localDate,
    utcTimestamp,
    tzIana,
    tzOffsetMinutes,
  } = resolveEntryTimeForSave({
    original: options?.originalTime,
    requestedLocalDate: options?.localDate,
    draftUtcTimestamp: draft.utcTimestamp,
  });
  const existingEntry = options?.editId
    ? await getFoodEntry(options.editId)
    : null;
  const logGroupId =
    options?.logGroupId !== undefined
      ? options.logGroupId
      : existingEntry?.logGroupId ?? null;

  const id = await runInTransaction(async (txn) => {
    const updateCatalog = options?.updateCatalog !== false;
    const catalogId = updateCatalog
      ? await upsertCatalogFromConfirmed({
          name: draft.name.trim(),
          basis: draft.basis,
          sourceKcal: draft.sourceKcal!,
          sourceProteinG: draft.sourceProteinG!,
          sourceFatG: draft.sourceFatG!,
          sourceCarbsG: draft.sourceCarbsG!,
          barcode: draft.barcode,
          existingId: draft.catalogId,
        }, txn)
      : draft.catalogId ?? null;

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
      logGroupId,
      utcTimestamp,
      localDate,
      tzIana,
      tzOffsetMinutes,
    };

    const entryId = options?.editId ?? (await createFoodEntry(payload, txn));
    if (options?.editId) await updateFoodEntry(options.editId, payload, txn);
    if (catalogId) await touchCatalogUsed(catalogId, txn);

    if (draft.barcode && (draft.source === 'off' || draft.source === 'cache')) {
      await upsertBarcodeCache({
        barcode: draft.barcode,
        name: draft.name.trim(),
        basis: draft.basis,
        sourceKcal: draft.sourceKcal!,
        sourceProteinG: draft.sourceProteinG!,
        sourceFatG: draft.sourceFatG!,
        sourceCarbsG: draft.sourceCarbsG!,
      }, txn);
    }
    return entryId;
  });

  return { ok: true, id };
}
