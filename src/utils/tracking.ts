type ItemKeyInput = {
  productId: string
  variantId?: string
  customLength?: number
  customWidth?: number
  customHeight?: number
  unitPrice?: number
}

const formatKeyNumber = (value?: number) => {
  if (!Number.isFinite(value)) {
    return ''
  }
  return (value ?? 0).toFixed(4)
}

export const buildItemKey = (item: ItemKeyInput) => {
  const lengthKey = formatKeyNumber(item.customLength)
  const widthKey = formatKeyNumber(item.customWidth)
  const heightKey = formatKeyNumber(item.customHeight)
  const priceKey = formatKeyNumber(item.unitPrice)
  return `${item.productId}:${item.variantId ?? ''}:${lengthKey}:${widthKey}:${heightKey}:${priceKey}`
}

export const formatItemDimensions = (item: ItemKeyInput) => {
  const dimensions: string[] = []
  if (Number.isFinite(item.customLength) && (item.customLength ?? 0) > 0) {
    dimensions.push(`${item.customLength?.toFixed(2)} m`)
  }
  if (Number.isFinite(item.customWidth) && (item.customWidth ?? 0) > 0) {
    dimensions.push(`${item.customWidth?.toFixed(2)} m`)
  }
  if (Number.isFinite(item.customHeight) && (item.customHeight ?? 0) > 0) {
    dimensions.push(`${item.customHeight?.toFixed(2)} m`)
  }
  return dimensions.join(' x ')
}

export const formatItemLabel = (
  productName: string | undefined,
  variantName: string | undefined,
  item: ItemKeyInput,
) => {
  const parts = [productName ?? 'Produto']
  if (variantName) {
    parts.push(variantName)
  }
  const dimensions = formatItemDimensions(item)
  if (dimensions) {
    parts.push(`(${dimensions})`)
  }
  return parts.join(' - ')
}

export type { ItemKeyInput }
