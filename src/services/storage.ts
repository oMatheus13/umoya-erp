import type { ERPData } from '../types/erp'

const STORAGE_KEY = 'umoya_erp_data'

export const createEmptyState = (): ERPData => ({
  produtos: [],
  clientes: [],
  fornecedores: [],
  materiais: [],
  moldes: [],
  ordensProducao: [],
  consumosMateriais: [],
  orcamentos: [],
  pedidos: [],
  recibos: [],
  financeiro: [],
  funcionarios: [],
  cargos: [],
  niveis: [],
  apontamentos: [],
})

export const getStorage = (): ERPData | null => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as ERPData
  } catch {
    return null
  }
}

export const saveStorage = (data: ERPData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const clearStorage = () => {
  localStorage.removeItem(STORAGE_KEY)
}
