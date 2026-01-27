export type UUID = string

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
  isCustom?: boolean
}

export type Product = {
  id: UUID
  name: string
  price: number
  costPrice?: number
  laborCost?: number
  laborBasis?: 'unidade' | 'metro'
  sku?: string
  stock?: number
  unit?: string
  length?: number
  width?: number
  height?: number
  dimensions?: string
  active?: boolean
  variants?: ProductVariant[]
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
  unit?: string
  cost?: number
}

export type Mold = {
  id: UUID
  name: string
  code?: string
}

export type QuoteItem = {
  productId: UUID
  variantId?: UUID
  quantity: number
  unitPrice: number
}

export type Quote = {
  id: UUID
  clientId: UUID
  items: QuoteItem[]
  total: number
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
}

export type Order = {
  id: UUID
  clientId: UUID
  items: OrderItem[]
  total: number
  paymentMethod: string
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

export type ProductionOrder = {
  id: UUID
  orderId: UUID
  productId: UUID
  variantId?: UUID
  quantity: number
  moldId?: UUID
  status: 'aberta' | 'em_producao' | 'finalizada'
  plannedAt?: string
  finishedAt?: string
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
  type: 'entrada' | 'saida'
  description: string
  amount: number
  category?: string
  createdAt: string
}

export type EmployeeRole = {
  id: UUID
  name: string
  multiplier: number
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
  email: string
  cpf?: string
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
  consumosMateriais: MaterialConsumption[]
  orcamentos: Quote[]
  pedidos: Order[]
  recibos: Receipt[]
  financeiro: FinanceEntry[]
  funcionarios: Employee[]
  cargos: EmployeeRole[]
  niveis: EmployeeLevel[]
  apontamentos: WorkLog[]
  usuarios: UserAccount[]
}
