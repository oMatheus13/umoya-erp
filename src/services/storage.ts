import type { EmployeeLevel, EmployeeRole, ERPData } from '../types/erp'

const STORAGE_KEY = 'umoya_erp_data'

export const DEFAULT_ROLES: EmployeeRole[] = [
  { id: 'role-ajudante', name: 'Ajudante de producao', multiplier: 0.9 },
  { id: 'role-armador', name: 'Armador', multiplier: 1.1 },
  { id: 'role-operador', name: 'Operador de forma', multiplier: 1.1 },
  { id: 'role-acabador', name: 'Acabador', multiplier: 1.0 },
  { id: 'role-qualidade', name: 'Controle de qualidade', multiplier: 1.15 },
  { id: 'role-almoxarife', name: 'Almoxarife', multiplier: 1.0 },
  { id: 'role-manutencao', name: 'Manutencao', multiplier: 1.2 },
  { id: 'role-supervisor', name: 'Supervisor de producao', multiplier: 1.35 },
  { id: 'role-motorista', name: 'Motorista/Entrega', multiplier: 1.0 },
]

export const DEFAULT_LEVELS: EmployeeLevel[] = [
  { id: 'level-aprendiz', name: 'Aprendiz', multiplier: 0.8 },
  { id: 'level-junior', name: 'Junior', multiplier: 1.0 },
  { id: 'level-pleno', name: 'Pleno', multiplier: 1.15 },
  { id: 'level-senior', name: 'Senior', multiplier: 1.3 },
  { id: 'level-lider', name: 'Lider', multiplier: 1.5 },
]

export const DEFAULT_COMPANY = {
  name: 'Umoya',
}

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
  comprasHistorico: [],
  entregas: [],
  financeiro: [],
  empresa: { ...DEFAULT_COMPANY },
  funcionarios: [],
  cargos: DEFAULT_ROLES.map((role) => ({ ...role })),
  niveis: DEFAULT_LEVELS.map((level) => ({ ...level })),
  apontamentos: [],
  usuarios: [],
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
