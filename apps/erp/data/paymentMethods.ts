import type { PaymentTableEntry } from '@shared/types/erp'

export type PaymentMethod = {
  id: string
  label: string
  cashboxId: string
}

type PaymentMethodLike = PaymentMethod & { active?: boolean }

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

const toPaymentMethods = (entries?: PaymentTableEntry[]) => {
  if (entries && entries.length > 0) {
    return entries.map<PaymentMethodLike>((entry) => ({
      id: entry.id,
      label: entry.label,
      cashboxId: entry.cashboxId ?? 'caixa_operacional',
      active: entry.active,
    }))
  }
  return PAYMENT_METHODS.map((method) => ({ ...method, active: true }))
}

const resolveFromList = (value: string, list: PaymentMethodLike[]) => {
  const normalized = normalize(value)
  if (!normalized) {
    return null
  }
  return (
    list.find((method) => method.id === normalized) ??
    list.find((method) => normalize(method.label) === normalized) ??
    null
  )
}

export const resolvePaymentMethod = (value?: string, entries?: PaymentTableEntry[]) => {
  const normalized = normalize(value)
  if (!normalized) {
    return null
  }
  const list = toPaymentMethods(entries).filter((method) => method.active !== false)
  const fallback = PAYMENT_METHODS.map((method) => ({ ...method, active: true }))
  return resolveFromList(normalized, list) ?? resolveFromList(normalized, fallback)
}

export const getPaymentMethodLabel = (value?: string, entries?: PaymentTableEntry[]) =>
  resolvePaymentMethod(value, entries)?.label ?? value?.trim() ?? 'A definir'

export const getPaymentCashboxId = (value?: string, entries?: PaymentTableEntry[]) =>
  resolvePaymentMethod(value, entries)?.cashboxId ?? 'caixa_operacional'

export const getPaymentMethodId = (value?: string, entries?: PaymentTableEntry[]) =>
  resolvePaymentMethod(value, entries)?.id ?? value?.trim() ?? ''

export const getPaymentMethodOptions = (entries?: PaymentTableEntry[]) =>
  toPaymentMethods(entries).filter((method) => method.active !== false)
