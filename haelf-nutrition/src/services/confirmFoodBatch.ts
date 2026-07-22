import type { FoodDraft, MealType } from '../domain/types';
import { validateFoodDraft } from '../domain/validation';
import { resolveEntryTimeForSave } from '../domain/dates';
import { createLogGroupId } from '../domain/logGroup';
import { runInTransaction } from '../db/database';
import {
  createFoodEntry,
  touchCatalogUsed,
  upsertCatalogFromConfirmed,
} from '../db/repositories/food';
import { upsertBarcodeCache } from '../db/repositories/barcode';

export async function confirmFoodDrafts(
  drafts: FoodDraft[],
  options: {
    localDate: string;
    mealType?: MealType;
    logGroupId?: string;
    updateCatalog?: boolean;
  }
): Promise<
  | { ok: true; ids: number[]; logGroupId: string }
  | { ok: false; errors: string[] }
> {
  const errors = drafts.flatMap((draft, index) =>
    validateFoodDraft({
      name: draft.name,
      basis: draft.basis,
      sourceKcal: draft.sourceKcal,
      sourceProteinG: draft.sourceProteinG,
      sourceFatG: draft.sourceFatG,
      sourceCarbsG: draft.sourceCarbsG,
      quantity: draft.quantity,
    }).map((error) => `${index + 1}.${error.field}: ${error.message}`)
  );
  if (!drafts.length) errors.push('至少需要一項食物');
  if (errors.length) return { ok: false, errors };

  const logGroupId = options.logGroupId ?? createLogGroupId();
  const ids = await runInTransaction(async (txn) => {
    const created: number[] = [];
    const now = new Date();
    for (const draft of drafts) {
      const catalogId =
        options.updateCatalog === false
          ? draft.catalogId ?? null
          : await upsertCatalogFromConfirmed({
              name: draft.name.trim(),
              basis: draft.basis,
              sourceKcal: draft.sourceKcal!,
              sourceProteinG: draft.sourceProteinG!,
              sourceFatG: draft.sourceFatG!,
              sourceCarbsG: draft.sourceCarbsG!,
              barcode: draft.barcode,
              existingId: draft.catalogId,
            }, txn);
      const time = resolveEntryTimeForSave(
        {
          requestedLocalDate: options.localDate,
          draftUtcTimestamp: draft.utcTimestamp,
        },
        now
      );
      created.push(
        await createFoodEntry({
          name: draft.name.trim(),
          mealType: options.mealType ?? draft.mealType,
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
          ...time,
        }, txn)
      );
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
    }
    return created;
  });
  return { ok: true, ids, logGroupId };
}
