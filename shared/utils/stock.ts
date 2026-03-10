import type { Product } from '../types/erp'

export const adjustProductStock = (
  product: Product,
  variantId: string | undefined,
  quantityDelta: number,
) => {
  if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
    return product
  }
  const variants = product.variants ?? []
  const shouldUseVariants =
    (product.hasVariants ?? false) ||
    (product.unit === 'metro_linear' && variants.length > 0)
  if (shouldUseVariants) {
    const targetId = variantId || variants[0]?.id
    if (targetId) {
      return {
        ...product,
        variants: variants.map((variant) =>
          variant.id === targetId
            ? { ...variant, stock: (variant.stock ?? 0) + quantityDelta }
            : variant,
        ),
      }
    }
  }
  return {
    ...product,
    stock: (product.stock ?? 0) + quantityDelta,
  }
}
