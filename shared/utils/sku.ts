export const formatSkuWithVariant = (baseSku?: string, variantSku?: string) => {
  const baseRaw = baseSku?.trim() ?? ''
  const variantRaw = variantSku?.trim() ?? ''
  if (!baseRaw && !variantRaw) {
    return '-'
  }
  if (!variantRaw) {
    return baseRaw || '-'
  }
  if (!baseRaw) {
    return variantRaw
  }
  const base = baseRaw.replace(/^-+|-+$/g, '')
  const variant = variantRaw.replace(/^-+|-+$/g, '')
  if (!variant) {
    return base || '-'
  }
  if (variant.toUpperCase().startsWith(base.toUpperCase())) {
    return variantRaw
  }
  return `${base}-${variant}`
}
