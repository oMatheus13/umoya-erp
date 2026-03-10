import type { Material, MaterialKind, MaterialUsageUnit } from '../types/erp'
import {
  toM3FromBaldes,
  toM3FromCarrinhoCheio,
  toM3FromCarrinhoRente,
  toSacoFromBaldes,
} from './conversions'

export const MATERIAL_USAGE_UNITS: Record<
  MaterialKind,
  { value: MaterialUsageUnit; label: string }[]
> = {
  areia: [
    { value: 'm3', label: 'm3' },
    { value: 'balde', label: 'Balde (10 L)' },
    { value: 'carrinho_rente', label: 'Carrinho rente' },
    { value: 'carrinho_cheio', label: 'Carrinho cheio' },
  ],
  brita: [
    { value: 'm3', label: 'm3' },
    { value: 'balde', label: 'Balde (10 L)' },
    { value: 'carrinho_rente', label: 'Carrinho rente' },
    { value: 'carrinho_cheio', label: 'Carrinho cheio' },
  ],
  cimento: [
    { value: 'saco', label: 'Saco (50 kg)' },
    { value: 'balde', label: 'Balde de cimento' },
  ],
  trelica: [
    { value: 'metro', label: 'Metro' },
    { value: 'unidade', label: 'Unidade' },
  ],
  aco: [{ value: 'unidade', label: 'Unidade' }],
  aditivo: [{ value: 'unidade', label: 'Unidade' }],
  agua: [{ value: 'unidade', label: 'Unidade' }],
  outro: [{ value: 'unidade', label: 'Unidade' }],
}

export const getDefaultUsageUnit = (kind: MaterialKind): MaterialUsageUnit => {
  if (kind === 'cimento') {
    return 'saco'
  }
  if (kind === 'trelica') {
    return 'metro'
  }
  if (kind === 'areia' || kind === 'brita') {
    return 'balde'
  }
  return 'unidade'
}

export const getUsageUnitLabel = (unit?: MaterialUsageUnit) => {
  if (!unit) {
    return '-'
  }
  return (
    Object.values(MATERIAL_USAGE_UNITS)
      .flat()
      .find((item) => item.value === unit)?.label ?? unit
  )
}

export const convertUsageToPurchaseQuantity = (
  material: Material,
  usageUnit: MaterialUsageUnit,
  quantity: number,
) => {
  const safeQuantity = Number.isFinite(quantity) ? quantity : 0
  if (safeQuantity <= 0) {
    return 0
  }
  switch (material.kind) {
    case 'areia':
    case 'brita': {
      if (usageUnit === 'm3') {
        return safeQuantity
      }
      if (usageUnit === 'balde') {
        return toM3FromBaldes(safeQuantity)
      }
      if (usageUnit === 'carrinho_rente') {
        return toM3FromCarrinhoRente(safeQuantity)
      }
      if (usageUnit === 'carrinho_cheio') {
        return toM3FromCarrinhoCheio(safeQuantity)
      }
      return safeQuantity
    }
    case 'cimento': {
      if (usageUnit === 'saco') {
        return safeQuantity
      }
      if (usageUnit === 'balde') {
        return toSacoFromBaldes(safeQuantity)
      }
      return safeQuantity
    }
    case 'trelica': {
      if (usageUnit === 'metro') {
        const metersPerUnit = material.metersPerUnit ?? 0
        if (metersPerUnit > 0) {
          return safeQuantity / metersPerUnit
        }
        return safeQuantity
      }
      return safeQuantity
    }
    default:
      return safeQuantity
  }
}
