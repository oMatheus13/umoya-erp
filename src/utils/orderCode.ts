import type { Order } from '../types/erp'

const CODE_LENGTHS = [6, 8, 10, 12]

const normalizeCode = (code?: string) => code?.trim().toLowerCase() ?? ''

const baseFromOrderId = (orderId: string) => orderId.replace(/-/g, '').toLowerCase()

export const buildOrderCode = (orderId: string, length = CODE_LENGTHS[0]) => {
  const base = baseFromOrderId(orderId)
  if (!base) {
    return ''
  }
  if (base.length >= length) {
    return base.slice(0, length)
  }
  return base.padEnd(length, '0')
}

export const resolveOrderCode = (order: Pick<Order, 'id' | 'trackingCode'>) => {
  const normalized = normalizeCode(order.trackingCode)
  if (normalized) {
    return normalized
  }
  return buildOrderCode(order.id)
}

export const ensureOrderCodes = (orders: Order[]) => {
  const used = new Map<string, string>()
  let changed = false
  const normalizedOrders = orders.map((order) => {
    let code = normalizeCode(order.trackingCode)
    if (code && used.has(code) && used.get(code) !== order.id) {
      code = ''
    }
    if (!code) {
      for (const length of CODE_LENGTHS) {
        const candidate = buildOrderCode(order.id, length)
        if (!candidate) {
          continue
        }
        if (!used.has(candidate)) {
          code = candidate
          break
        }
      }
    }
    if (!code) {
      code = buildOrderCode(order.id, CODE_LENGTHS[CODE_LENGTHS.length - 1])
    }
    used.set(code, order.id)
    if (code !== order.trackingCode) {
      changed = true
      return { ...order, trackingCode: code }
    }
    return order
  })
  return { orders: normalizedOrders, changed }
}
