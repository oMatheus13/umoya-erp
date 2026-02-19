import type { StockItem } from '../types/erp'

const normalizeLength = (lengthM?: number) => {
  if (!Number.isFinite(lengthM)) {
    return null
  }
  return Math.round((lengthM ?? 0) * 1000)
}

export const isSameLength = (a?: number, b?: number) =>
  normalizeLength(a) === normalizeLength(b)

export const findStockItem = (
  items: StockItem[],
  productId: string,
  lengthM?: number,
) =>
  items.find(
    (item) => item.productId === productId && isSameLength(item.lengthM, lengthM),
  )

export const findStockItemIndex = (
  items: StockItem[],
  productId: string,
  lengthM?: number,
) =>
  items.findIndex(
    (item) => item.productId === productId && isSameLength(item.lengthM, lengthM),
  )
