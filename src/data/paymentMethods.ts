export type PaymentMethod = {
  id: string
  label: string
  cashboxId: string
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'dinheiro', label: 'Dinheiro', cashboxId: 'caixa_fisico' },
  { id: 'pix', label: 'Pix', cashboxId: 'caixa_bancario' },
  { id: 'transferencia', label: 'Transferencia', cashboxId: 'caixa_bancario' },
  { id: 'boleto', label: 'Boleto', cashboxId: 'caixa_bancario' },
  { id: 'cartao_credito', label: 'Cartao de credito', cashboxId: 'caixa_bancario' },
  { id: 'cartao_debito', label: 'Cartao de debito', cashboxId: 'caixa_bancario' },
  { id: 'cheque', label: 'Cheque', cashboxId: 'caixa_bancario' },
  { id: 'a_definir', label: 'A definir', cashboxId: 'caixa_operacional' },
]

const normalize = (value?: string) => value?.trim().toLowerCase() ?? ''

export const resolvePaymentMethod = (value?: string) => {
  const normalized = normalize(value)
  if (!normalized) {
    return null
  }
  return (
    PAYMENT_METHODS.find((method) => method.id === normalized) ??
    PAYMENT_METHODS.find((method) => normalize(method.label) === normalized)
  )
}

export const getPaymentMethodLabel = (value?: string) =>
  resolvePaymentMethod(value)?.label ?? value?.trim() ?? 'A definir'

export const getPaymentCashboxId = (value?: string) =>
  resolvePaymentMethod(value)?.cashboxId ?? 'caixa_operacional'

export const getPaymentMethodId = (value?: string) =>
  resolvePaymentMethod(value)?.id ?? ''
