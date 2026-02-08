type FormatDimensionsOptions = {
  emptyLabel?: string
  separator?: string
  unitSuffix?: string
  compact?: boolean
}

const toMillimeters = (value?: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }
  return Math.round(value * 1000)
}

export const formatDimensionsMm = (
  values: Array<number | undefined>,
  options: FormatDimensionsOptions = {},
) => {
  const { emptyLabel = '-', separator = ' x ', unitSuffix = '', compact = false } = options
  const normalized = values.map(toMillimeters)
  const items = compact ? normalized.filter((value) => value > 0) : normalized
  if (items.length === 0 || items.every((value) => value === 0)) {
    return emptyLabel
  }
  const label = items.map((value) => value || 0).join(separator)
  return unitSuffix ? `${label}${unitSuffix}` : label
}
