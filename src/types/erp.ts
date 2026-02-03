export type UUID = string

export type MaterialUnit = 'saco_50kg' | 'm3' | 'unidade'
export type ProductUnit = 'm2' | 'metro_linear' | 'unidade'

export type PermissionLevel = 'none' | 'view' | 'edit'
export type PermissionKey =
  | 'dashboard'
  | 'clientes'
  | 'produtos'
  | 'cadastros-materiais'
  | 'fornecedores'
  | 'cadastros-tabelas'
  | 'orcamentos'
  | 'pedidos'
  | 'producao'
  | 'producao-lotes'
  | 'producao-refugo'
  | 'producao-consumo'
  | 'estoque'
  | 'estoque-formas'
  | 'estoque-materiais'
  | 'compras'
  | 'entregas'
  | 'financeiro'
  | 'fiscal'
  | 'funcionarios'
  | 'rh-presenca'
  | 'rh-pagamentos'
  | 'rh-historico'
  | 'rh-ocorrencias'
  | 'qualidade'
  | 'indicadores'
  | 'bi'
  | 'relatorios-producao'
  | 'relatorios-vendas'
  | 'relatorios-consumo'
  | 'config-usuarios'
  | 'perfil'
  | 'config-empresa'
  | 'configuracoes'
  | 'config-integracoes'
  | 'dados'
  | 'auditoria-log'
  | 'auditoria-historico'
  | 'auditoria-backup'
  | 'auditoria-acesso'

export type RolePermissions = Partial<Record<PermissionKey, PermissionLevel>>
export type MaterialKind =
  | 'areia'
  | 'brita'
  | 'cimento'
  | 'trelica'
  | 'aco'
  | 'aditivo'
  | 'agua'
  | 'outro'

export type MaterialUsageUnit =
  | 'm3'
  | 'balde'
  | 'carrinho_rente'
  | 'carrinho_cheio'
  | 'saco'
  | 'metro'
  | 'unidade'

export type FulfillmentMode = 'producao' | 'estoque'

export type ProductMaterialUsage = {
  id: UUID
  materialId: UUID
  quantity: number
  usageUnit?: MaterialUsageUnit
  unitMode?: 'material' | 'metro'
  source?: 'manual' | 'batch'
}

export type BatchRecipeItem = {
  id: UUID
  materialId: UUID
  quantity: number
  usageUnit: MaterialUsageUnit
}

export type BatchRecipe = {
  id: UUID
  productId: UUID
  variantId?: UUID
  yieldQuantity: number
  items: BatchRecipeItem[]
  updatedAt?: string
}

export type ProductVariant = {
  id: UUID
  productId: UUID
  name: string
  length?: number
  width?: number
  height?: number
  stock: number
  sku?: string
  priceOverride?: number
  costOverride?: number
  active?: boolean
  locked?: boolean
  isCustom?: boolean
  materialUsages?: ProductMaterialUsage[]
  batchRecipe?: BatchRecipe
}

export type Product = {
  id: UUID
  name: string
  price: number
  priceMin?: number
  maxDiscountPercent?: number
  costPrice?: number
  laborCost?: number
  laborBasis?: 'unidade' | 'metro'
  sku?: string
  stock?: number
  unit?: ProductUnit
  length?: number
  width?: number
  height?: number
  dimensions?: string
  active?: boolean
  producedInternally?: boolean
  hasVariants?: boolean
  variants?: ProductVariant[]
  materialUsages?: ProductMaterialUsage[]
  batchRecipe?: BatchRecipe
}

export type Client = {
  id: UUID
  name: string
  document?: string
  email?: string
  phone?: string
  city?: string
  notes?: string
  active?: boolean
  obras?: ClientObra[]
}

export type ClientObra = {
  id: UUID
  name: string
  address: string
  city?: string
  notes?: string
  active?: boolean
}

export type Supplier = {
  id: UUID
  name: string
  contact?: string
  document?: string
  email?: string
  phone?: string
  city?: string
  notes?: string
  active?: boolean
}

export type Material = {
  id: UUID
  name: string
  unit?: MaterialUnit
  kind?: MaterialKind
  metersPerUnit?: number
  cost?: number
  marketUnitPrice?: number
  marketLotPrice?: number
  lotSize?: number
  stock?: number
  minStock?: number
  notes?: string
  active?: boolean
}

export type Mold = {
  id: UUID
  name: string
  code?: string
  length?: number
  width?: number
  height?: number
  stock?: number
  notes?: string
}

export type QuoteItem = {
  productId: UUID
  variantId?: UUID
  quantity: number
  unitPrice: number
  customLength?: number
  customWidth?: number
  customHeight?: number
}

export type Quote = {
  id: UUID
  clientId: UUID
  obraId?: UUID
  items: QuoteItem[]
  total: number
  fulfillment?: FulfillmentMode
  discountType?: 'percent' | 'value'
  discountValue?: number
  discountPercent?: number
  paymentMethod?: string
  validUntil: string
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado'
  createdAt: string
  convertedOrderId?: UUID
}

export type OrderItem = {
  productId: UUID
  variantId?: UUID
  quantity: number
  unitPrice: number
  customLength?: number
  customWidth?: number
  customHeight?: number
}

export type Order = {
  id: UUID
  clientId: UUID
  obraId?: UUID
  items: OrderItem[]
  total: number
  paymentMethod: string
  fulfillment?: FulfillmentMode
  discountType?: 'percent' | 'value'
  discountValue?: number
  discountPercent?: number
  status: 'aguardando_pagamento' | 'pago' | 'em_producao' | 'entregue'
  createdAt: string
  sourceQuoteId?: UUID
}

export type Receipt = {
  id: UUID
  orderId: UUID
  amount: number
  paymentMethod: string
  issuedAt: string
}

export type PurchaseItem = {
  id: UUID
  type: 'material' | 'extra'
  materialId?: UUID
  description: string
  quantity?: number
  unitPrice?: number
  pricingMode?: 'unit' | 'lot'
  total: number
}

export type PurchaseRecord = {
  id: UUID
  supplierId?: UUID
  purchaseDate?: string
  notes?: string
  items: PurchaseItem[]
  total: number
  createdAt: string
}

export type Delivery = {
  id: UUID
  orderId: UUID
  productionOrderId: UUID
  clientId: UUID
  obraId?: UUID
  address?: string
  status: 'pendente' | 'em_rota' | 'entregue'
  createdAt: string
  scheduledAt?: string
  vehicle?: string
  driver?: string
  isPartial?: boolean
  proofType?: 'foto' | 'assinatura'
  proofNote?: string
  occurrence?: string
}

export type ProductionOrder = {
  id: UUID
  orderId: UUID
  productId: UUID
  variantId?: UUID
  quantity: number
  customLength?: number
  moldId?: UUID
  status: 'aberta' | 'em_producao' | 'finalizada'
  plannedAt?: string
  finishedAt?: string
  source?: 'pedido' | 'estoque'
}

export type ProductionLotStatus = 'aguardando' | 'produzindo' | 'curando' | 'pronto'

export type ProductionLot = {
  id: UUID
  productId: UUID
  variantId?: UUID
  quantity: number
  customLength?: number
  status: ProductionLotStatus
  moldedAt?: string
  demoldedAt?: string
  curingUntil?: string
  notes?: string
  createdAt: string
}

export type ProductionScrapStatus = 'aberto' | 'resolvido'
export type ProductionScrapType = 'refugo' | 'retrabalho'

export type ProductionScrap = {
  id: UUID
  productId: UUID
  variantId?: UUID
  productionOrderId?: UUID
  quantity: number
  type: ProductionScrapType
  reason: string
  estimatedCost?: number
  status: ProductionScrapStatus
  createdAt: string
  notes?: string
}

export type FiscalNoteStatus = 'pendente' | 'autorizada' | 'cancelada'
export type FiscalNoteType = 'nfe' | 'nfse'

export type FiscalNote = {
  id: UUID
  type: FiscalNoteType
  orderId?: UUID
  clientId?: UUID
  number?: string
  series?: string
  issueDate?: string
  status: FiscalNoteStatus
  xmlStored?: boolean
  notes?: string
  createdAt: string
}

export type QualityCheckStatus = 'aberto' | 'resolvido'
export type QualityCheckType = 'checklist' | 'falha'
export type QualitySeverity = 'baixa' | 'media' | 'alta'

export type QualityCheck = {
  id: UUID
  type: QualityCheckType
  productId?: UUID
  productionOrderId?: UUID
  description: string
  severity?: QualitySeverity
  estimatedCost?: number
  status: QualityCheckStatus
  notes?: string
  createdAt: string
}

export type MaintenanceStatus = 'aberta' | 'finalizada'
export type MaintenanceType = 'preventiva' | 'corretiva'

export type MaintenanceLog = {
  id: UUID
  equipment: string
  type: MaintenanceType
  status: MaintenanceStatus
  scheduledAt?: string
  performedAt?: string
  cost?: number
  notes?: string
  createdAt: string
}

export type IntegrationStatus = 'ativo' | 'inativo'

export type IntegrationConfig = {
  id: UUID
  name: string
  provider?: string
  status: IntegrationStatus
  lastSync?: string
  notes?: string
}

export type MaterialConsumption = {
  id: UUID
  productionOrderId: UUID
  materialId: UUID
  expected: number
  actual?: number
}

export type FinanceEntry = {
  id: UUID
  type: 'entrada' | 'saida' | 'transferencia'
  description: string
  amount: number
  category?: string
  createdAt: string
  cashboxId: UUID
  transferToId?: UUID
}

export type Cashbox = {
  id: UUID
  name: string
}

export type CashDailyCheck = {
  id: UUID
  date: string
  opening: number
  cashIn: number
  cashOut: number
  closing: number
  actual: number
  notes?: string
  createdAt: string
}

export type TableEntry = {
  id: UUID
  label: string
  active?: boolean
  description?: string
}

export type UnitTableEntry = TableEntry & {
  symbol?: string
}

export type PaymentTableEntry = TableEntry & {
  cashboxId?: UUID
}

export type SystemTables = {
  units: UnitTableEntry[]
  categories: TableEntry[]
  paymentMethods: PaymentTableEntry[]
}

export type AuditCategory = 'acao' | 'alteracao' | 'backup' | 'acesso'

export type AuditEvent = {
  id: UUID
  category: AuditCategory
  title: string
  description?: string
  actorName?: string
  createdAt: string
  metadata?: string
}

export type CompanyProfile = {
  name: string
  tradeName?: string
  document?: string
  stateRegistration?: string
  email?: string
  phone?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  zip?: string
  website?: string
  notes?: string
}

export type EmployeeRole = {
  id: UUID
  name: string
  multiplier: number
  permissions?: RolePermissions
}

export type EmployeeLevel = {
  id: UUID
  name: string
  multiplier: number
}

export type Employee = {
  id: UUID
  name: string
  roleId?: UUID
  levelId?: UUID
  cpf?: string
  active?: boolean
  hiredAt?: string
}

export type PresenceStatus = 'presente' | 'meio_periodo' | 'falta' | 'ferias'

export type PresenceEntry = {
  id: UUID
  employeeId: UUID
  date: string
  status: PresenceStatus
  notes?: string
  createdAt: string
}

export type EmployeePaymentStatus = 'aberto' | 'pago' | 'cancelado'

export type EmployeePayment = {
  id: UUID
  employeeId: UUID
  periodStart: string
  periodEnd: string
  baseValue: number
  extras: number
  discounts: number
  total: number
  status: EmployeePaymentStatus
  method?: string
  createdAt: string
  paidAt?: string
  notes?: string
}

export type EmployeeOccurrence = {
  id: UUID
  employeeId: UUID
  date: string
  type: string
  description: string
  createdAt: string
  resolved?: boolean
}

export type WorkLog = {
  id: UUID
  employeeId: UUID
  productId: UUID
  variantId?: UUID
  quantity: number
  workDate: string
  createdAt: string
  unitLaborCost: number
  roleMultiplier: number
  levelMultiplier: number
  totalPay: number
}

export type UserAccount = {
  id: UUID
  employeeId?: UUID
  name: string
  displayName?: string
  email: string
  cpf?: string
  phone?: string
  avatarColor?: string
  avatarUrl?: string
  passwordHash?: string
  role?: 'admin' | 'funcionario'
  createdAt: string
  lastLoginAt?: string
  active?: boolean
}

export type ERPData = {
  produtos: Product[]
  clientes: Client[]
  fornecedores: Supplier[]
  materiais: Material[]
  moldes: Mold[]
  ordensProducao: ProductionOrder[]
  lotesProducao: ProductionLot[]
  refugosProducao: ProductionScrap[]
  consumosMateriais: MaterialConsumption[]
  orcamentos: Quote[]
  pedidos: Order[]
  recibos: Receipt[]
  comprasHistorico: PurchaseRecord[]
  entregas: Delivery[]
  fiscalNotas: FiscalNote[]
  qualidadeChecks: QualityCheck[]
  manutencoes: MaintenanceLog[]
  financeiro: FinanceEntry[]
  caixas: Cashbox[]
  conferenciasCaixaFisico: CashDailyCheck[]
  tabelas: SystemTables
  empresa: CompanyProfile
  integracoes: IntegrationConfig[]
  funcionarios: Employee[]
  cargos: EmployeeRole[]
  niveis: EmployeeLevel[]
  apontamentos: WorkLog[]
  presencas: PresenceEntry[]
  pagamentosRH: EmployeePayment[]
  ocorrenciasRH: EmployeeOccurrence[]
  usuarios: UserAccount[]
  auditoria: AuditEvent[]
  meta?: {
    updatedAt?: string
  }
}
