import type { BatchRecipe, ProductMaterialUsage } from '../types/erp'
import { createId } from './ids'

export const deriveUsagesFromBatch = (batch: BatchRecipe): ProductMaterialUsage[] => {
  const yieldQuantity = Number.isFinite(batch.yieldQuantity) ? batch.yieldQuantity : 0
  if (yieldQuantity <= 0) {
    return []
  }

  return batch.items
    .filter((item) => item.materialId && Number.isFinite(item.quantity) && item.quantity > 0)
    .map((item) => ({
      id: item.id || createId(),
      materialId: item.materialId,
      quantity: item.quantity / yieldQuantity,
      usageUnit: item.usageUnit,
      source: 'batch',
    }))
}
