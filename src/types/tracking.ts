export type TrackingStage =
  | 'aguardando_producao'
  | 'moldagem'
  | 'cura'
  | 'aguardando_envio'
  | 'em_rota'
  | 'entregue'

export type TrackingSummaryStage =
  | 'aguardando_producao'
  | 'em_producao'
  | 'aguardando_envio'
  | 'em_rota'
  | 'entregue'

export type TrackingItem = {
  key: string
  productId: string
  label: string
  quantity: number
  deliveredQuantity: number
  stage: TrackingStage
  isPartial: boolean
}

export type TrackingOrderSummary = {
  stage: TrackingSummaryStage
  isPartial: boolean
  deliveredQuantity: number
  totalQuantity: number
}

export type TrackingOrderPayload = {
  orderId: string
  orderCode: string
  clientName?: string
  createdAt: string
  fulfillment: 'producao' | 'estoque'
  items: TrackingItem[]
  summary: TrackingOrderSummary
}
