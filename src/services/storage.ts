import type { Cashbox, EmployeeLevel, EmployeeRole, ERPData, SystemTables } from '../types/erp'
import { PAYMENT_METHODS } from '../data/paymentMethods'

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
  { id: 'role-socio', name: 'Socio', multiplier: 1.6 },
  { id: 'role-diretor', name: 'Diretor geral', multiplier: 1.5 },
  { id: 'role-administrativo', name: 'Administrativo', multiplier: 1.15 },
  { id: 'role-financeiro', name: 'Financeiro', multiplier: 1.2 },
  { id: 'role-rh', name: 'Recursos humanos', multiplier: 1.2 },
  { id: 'role-comercial', name: 'Comercial', multiplier: 1.2 },
  { id: 'role-ti', name: 'TI e suporte', multiplier: 1.1 },
]

export const DEFAULT_LEVELS: EmployeeLevel[] = [
  { id: 'level-aprendiz', name: 'Aprendiz', multiplier: 0.8 },
  { id: 'level-junior', name: 'Junior', multiplier: 1.0 },
  { id: 'level-pleno', name: 'Pleno', multiplier: 1.15 },
  { id: 'level-senior', name: 'Senior', multiplier: 1.3 },
  { id: 'level-lider', name: 'Lider', multiplier: 1.5 },
]

export const DEFAULT_CASHBOXES: Cashbox[] = [
  { id: 'caixa_bancario', name: 'Caixa Bancario' },
  { id: 'caixa_fisico', name: 'Caixa Fisico' },
  { id: 'caixa_operacional', name: 'Caixa Operacional' },
  { id: 'caixa_impostos', name: 'Caixa Impostos' },
  { id: 'caixa_reserva', name: 'Caixa Reserva' },
  { id: 'caixa_socios', name: 'Caixa Retirada dos Socios' },
]

export const DEFAULT_COMPANY = {
  name: 'Umoya',
}

export const DEFAULT_TABLES: SystemTables = {
  units: [
    { id: 'unit-un', label: 'Unidade', symbol: 'un', active: true },
    { id: 'unit-ml', label: 'Metro linear', symbol: 'm', active: true },
    { id: 'unit-m2', label: 'Metro quadrado', symbol: 'm2', active: true },
    { id: 'unit-m3', label: 'Metro cubico', symbol: 'm3', active: true },
    { id: 'unit-saco', label: 'Saco 50kg', symbol: 'saco', active: true },
  ],
  categories: [
    { id: 'cat-pre', label: 'Pre-moldados', active: true },
    { id: 'cat-mat', label: 'Materia-prima', active: true },
    { id: 'cat-serv', label: 'Servicos', active: true },
    { id: 'cat-outro', label: 'Outros', active: true },
  ],
  paymentMethods: PAYMENT_METHODS.map((method) => ({
    id: method.id,
    label: method.label,
    cashboxId: method.cashboxId,
    active: true,
  })),
}

export const DEFAULT_INTEGRATIONS = [
  { id: 'integracao-nfe', name: 'Nota fiscal (NF-e)', status: 'inativo' as const },
  { id: 'integracao-nfse', name: 'Nota fiscal (NFS-e)', status: 'inativo' as const },
  { id: 'integracao-whatsapp', name: 'WhatsApp', status: 'inativo' as const },
  { id: 'integracao-email', name: 'Email transacional', status: 'inativo' as const },
  { id: 'integracao-drive', name: 'Google Drive', status: 'inativo' as const },
]

export const createEmptyState = (): ERPData => ({
  produtos: [],
  clientes: [],
  fornecedores: [],
  materiais: [],
  moldes: [],
  ordensProducao: [],
  lotesProducao: [],
  refugosProducao: [],
  consumosMateriais: [],
  orcamentos: [],
  pedidos: [],
  recibos: [],
  comprasHistorico: [],
  entregas: [],
  fiscalNotas: [],
  qualidadeChecks: [],
  manutencoes: [],
  financeiro: [],
  caixas: DEFAULT_CASHBOXES.map((cashbox) => ({ ...cashbox })),
  conferenciasCaixaFisico: [],
  tabelas: {
    units: DEFAULT_TABLES.units.map((item) => ({ ...item })),
    categories: DEFAULT_TABLES.categories.map((item) => ({ ...item })),
    paymentMethods: DEFAULT_TABLES.paymentMethods.map((item) => ({ ...item })),
  },
  empresa: { ...DEFAULT_COMPANY },
  integracoes: DEFAULT_INTEGRATIONS.map((item) => ({ ...item })),
  funcionarios: [],
  cargos: DEFAULT_ROLES.map((role) => ({ ...role })),
  niveis: DEFAULT_LEVELS.map((level) => ({ ...level })),
  apontamentos: [],
  presencas: [],
  pagamentosRH: [],
  ocorrenciasRH: [],
  usuarios: [],
  auditoria: [],
  meta: {
    updatedAt: new Date().toISOString(),
  },
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
