import type { UUID } from './erp'

export type PtcDirection = 'horizontal' | 'vertical'
export type PtcProjectOriginType = 'standalone' | 'orcamento' | 'pedido'

export type PtcProjectOrigin = {
  type: PtcProjectOriginType
  id: UUID
}

export type PtcProject = {
  id: UUID
  name: string
  clientId?: UUID
  clientName?: string
  origin?: PtcProjectOrigin
  notes?: string
  createdAt: string
  updatedAt?: string
}

export type PtcRoom = {
  id: UUID
  projectId: UUID
  name: string
  widthCm: number
  lengthCm: number
  direction: PtcDirection
  createdAt: string
  updatedAt?: string
}

export type PtcCalculation = {
  id: UUID
  projectId: UUID
  kind: 'laje'
  createdAt: string
  updatedAt?: string
}

export type PtcCalculationItem = {
  id: UUID
  calculationId: UUID
  lengthM: number
  quantity: number
  status?: 'pending' | 'done'
}

export type PtcProductionList = {
  id: UUID
  projectId: UUID
  calculationId?: UUID
  items: PtcCalculationItem[]
  createdAt: string
  updatedAt?: string
}

export type PtcSettings = {
  vigotaSpacingCm: number
  epsProductId?: UUID
  capacityPerDayM: number
}

export type PtcMeta = {
  updatedAt: string
  workspaceId?: string
}

export type PtcState = {
  projects: PtcProject[]
  rooms: PtcRoom[]
  calculations: PtcCalculation[]
  calculationItems: PtcCalculationItem[]
  productionLists: PtcProductionList[]
  settings: PtcSettings
  meta: PtcMeta
}
