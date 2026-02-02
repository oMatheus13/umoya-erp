import type { MaterialKind } from '../types/erp'

export const MATERIAL_KINDS: { value: MaterialKind; label: string }[] = [
  { value: 'areia', label: 'Areia' },
  { value: 'brita', label: 'Brita' },
  { value: 'cimento', label: 'Cimento' },
  { value: 'trelica', label: 'Trelica' },
  { value: 'aco', label: 'Aco' },
  { value: 'aditivo', label: 'Aditivo' },
  { value: 'agua', label: 'Agua' },
  { value: 'outro', label: 'Outro' },
]

export const getMaterialKindLabel = (kind?: MaterialKind | string) => {
  if (!kind) {
    return '-'
  }
  const match = MATERIAL_KINDS.find((item) => item.value === kind)
  return match ? match.label : kind
}
