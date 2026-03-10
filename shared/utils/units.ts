import type { MaterialUnit, ProductUnit, SystemTables, UnitTableEntry } from '../types/erp'

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

const normalize = (value?: string) => value?.toLowerCase().trim() ?? ''

const resolveProductUnit = (entry: UnitTableEntry): ProductUnit | null => {
  const token = normalize(entry.symbol || entry.label)
  if (
    token === 'm2' ||
    token === 'm²' ||
    token === 'metro quadrado' ||
    token === 'metro_quadrado' ||
    token === 'm^2'
  ) {
    return 'm2'
  }
  if (
    token === 'm' ||
    token === 'ml' ||
    token === 'metro' ||
    token === 'metro linear' ||
    token === 'metro_linear'
  ) {
    return 'metro_linear'
  }
  if (token === 'un' || token === 'unidade' || token === 'und') {
    return 'unidade'
  }
  return null
}

const resolveMaterialUnit = (entry: UnitTableEntry): MaterialUnit | null => {
  const token = normalize(entry.symbol || entry.label)
  if (
    token === 'm3' ||
    token === 'm³' ||
    token === 'metro cubico' ||
    token === 'metro_cubico' ||
    token === 'm^3'
  ) {
    return 'm3'
  }
  if (
    token === 'saco' ||
    token === 'saco 50kg' ||
    token === 'saco_50kg' ||
    token === '50kg'
  ) {
    return 'saco_50kg'
  }
  if (token === 'un' || token === 'unidade' || token === 'und') {
    return 'unidade'
  }
  return null
}

export const getProductUnitOptions = (tables?: SystemTables) => {
  if (tables?.units && tables.units.length > 0) {
    const options: { value: ProductUnit; label: string }[] = []
    tables.units.forEach((entry) => {
      if (entry.active === false) {
        return
      }
      const value = resolveProductUnit(entry)
      if (!value) {
        return
      }
      if (options.some((option) => option.value === value)) {
        return
      }
      options.push({ value, label: entry.label })
    })
    if (options.length > 0) {
      return options
    }
  }
  return PRODUCT_UNITS
}

export const getMaterialUnitOptions = (tables?: SystemTables) => {
  if (tables?.units && tables.units.length > 0) {
    const options: { value: MaterialUnit; label: string }[] = []
    tables.units.forEach((entry) => {
      if (entry.active === false) {
        return
      }
      const value = resolveMaterialUnit(entry)
      if (!value) {
        return
      }
      if (options.some((option) => option.value === value)) {
        return
      }
      options.push({ value, label: entry.label })
    })
    if (options.length > 0) {
      return options
    }
  }
  return MATERIAL_UNITS
}

export const getMaterialUnitLabel = (
  unit?: MaterialUnit | string,
  tables?: SystemTables,
) => {
  if (!unit) {
    return '-'
  }
  if (tables?.units) {
    const match = tables.units.find(
      (entry) => resolveMaterialUnit(entry) === unit,
    )
    if (match) {
      return match.label
    }
  }
  const match = MATERIAL_UNITS.find((item) => item.value === unit)
  return match ? match.label : unit
}

export const getProductUnitLabel = (
  unit?: ProductUnit | string,
  tables?: SystemTables,
) => {
  if (!unit) {
    return '-'
  }
  if (tables?.units) {
    const match = tables.units.find(
      (entry) => resolveProductUnit(entry) === unit,
    )
    if (match) {
      return match.label
    }
  }
  const match = PRODUCT_UNITS.find((item) => item.value === unit)
  return match ? match.label : unit
}
