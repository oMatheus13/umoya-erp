export type ImportedNfceItem = {
  description: string
  code?: string
  quantity: number
  unit?: string
  unitPrice: number
  totalPrice: number
}

export type ImportedNfceData = {
  sourceUrl: string
  accessKey?: string
  supplierName: string
  supplierDocument?: string
  supplierAddress?: string
  noteNumber?: string
  noteSeries?: string
  issuedAt?: string
  authorizationProtocol?: string
  paymentMethod?: string
  paymentValue?: number
  totalItems?: number
  totalAmount: number
  items: ImportedNfceItem[]
}

export type NfceItemAlias = {
  id: string
  sourceLabel: string
  normalizedLabel: string
  targetType: 'material' | 'produto' | 'uso_interno'
  materialId?: string
  productId?: string
  variantId?: string
  lengthM?: number
  description?: string
  createdAt: string
}
