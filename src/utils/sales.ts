import type { Product, ProductVariant } from '../types/erp'
import { getBasePrice } from './pricing'

type CustomLengthLike = { customLength?: number } | undefined

export const resolveLinearLength = (product: Product, customLength?: number) => {
  const length =
    customLength && customLength > 0 ? customLength : product.length ?? 1
  return length > 0 ? length : 1
}

export const resolveVariantPrice = (product: Product | null, variantId: string) => {
  if (!product) {
    return 0
  }
  const variant = product.variants?.find((item) => item.id === variantId)
  if (product.hasVariants) {
    return variant?.priceOverride ?? 0
  }
  return getBasePrice(product, variant)
}

export const resolveUnitPrice = (
  product: Product | null,
  variant?: ProductVariant,
  item?: CustomLengthLike,
) => {
  if (!product) {
    return 0
  }
  const basePrice = getBasePrice(product, variant)
  if (product.unit === 'metro_linear') {
    const length = resolveLinearLength(product, item?.customLength)
    return basePrice * length
  }
  return basePrice
}
