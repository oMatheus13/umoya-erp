import type { MaterialUnit, ProductUnit } from '../types/erp'

export const MATERIAL_UNITS: { value: MaterialUnit; label: string }[] = [
  { value: 'saco_50kg', label: 'Saco 50kg' },
  { value: 'm3', label: 'm³' },
  { value: 'unidade', label: 'Unidade' },
]

export const PRODUCT_UNITS: { value: ProductUnit; label: string }[] = [
  { value: 'm2', label: 'm²' },
  { value: 'metro_linear', label: 'Metro linear' },
  { value: 'unidade', label: 'Unidade' },
]

export const getMaterialUnitLabel = (unit?: MaterialUnit | string) => {
  if (!unit) {
    return '-'
  }
  const match = MATERIAL_UNITS.find((item) => item.value === unit)
  return match ? match.label : unit
}

export const getProductUnitLabel = (unit?: ProductUnit | string) => {
  if (!unit) {
    return '-'
  }
  const match = PRODUCT_UNITS.find((item) => item.value === unit)
  return match ? match.label : unit
}
