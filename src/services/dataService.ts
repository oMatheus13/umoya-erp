import type {
  ERPData,
  FinanceEntry,
  Order,
  Product,
  ProductVariant,
  Quote,
  Receipt,
} from '../types/erp'
import { createEmptyState, getStorage, saveStorage } from './storage'
import { createId } from '../utils/ids'

export type DataService = {
  getAll: () => ERPData
  replaceAll: (data: ERPData) => void
  exportJson: () => string
  importJson: (payload: string) => void
  upsertQuote: (quote: Quote) => void
  upsertOrder: (order: Order) => void
  addReceipt: (receipt: Receipt) => void
  addFinanceEntry: (entry: FinanceEntry) => void
}

const upsert = <T extends { id: string }>(items: T[], next: T) => {
  const index = items.findIndex((item) => item.id === next.id)
  if (index >= 0) {
    items[index] = next
    return items
  }
  return [...items, next]
}

const normalizeVariants = (product: Product, markChanged: () => void) => {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.map((variant) => {
      if (variant.stock === undefined || variant.stock === null) {
        markChanged()
        return { ...variant, stock: 0 }
      }
      return variant
    })
  }

  markChanged()
  const defaultVariant: ProductVariant = {
    id: createId(),
    productId: product.id,
    name: 'Padrao',
    stock: product.stock ?? 0,
  }

  return [defaultVariant]
}

const normalizeData = (data: ERPData) => {
  let changed = false

  const produtos = data.produtos.map((product) => {
    const variants = normalizeVariants(product, () => {
      changed = true
    })
    return { ...product, variants }
  })

  const primaryVariantByProduct = new Map<string, string>()
  produtos.forEach((product) => {
    if (product.variants && product.variants.length > 0) {
      primaryVariantByProduct.set(product.id, product.variants[0].id)
    }
  })

  const normalizeItems = <T extends { productId: string; variantId?: string }>(items: T[]) =>
    items.map((item) => {
      if (!item.variantId) {
        const fallbackVariant = primaryVariantByProduct.get(item.productId)
        if (fallbackVariant) {
          changed = true
          return { ...item, variantId: fallbackVariant }
        }
      }
      return item
    })

  const orcamentos = data.orcamentos.map((quote) => ({
    ...quote,
    items: normalizeItems(quote.items),
  }))

  const pedidos = data.pedidos.map((order) => ({
    ...order,
    items: normalizeItems(order.items),
  }))

  const ordensProducao = data.ordensProducao.map((order) => {
    if (!order.variantId) {
      const fallbackVariant = primaryVariantByProduct.get(order.productId)
      if (fallbackVariant) {
        changed = true
        return { ...order, variantId: fallbackVariant }
      }
    }
    return order
  })

  const normalized = { ...data, produtos, orcamentos, pedidos, ordensProducao }

  if (changed) {
    saveStorage(normalized)
  }

  return normalized
}

export const dataService: DataService = {
  getAll: () => normalizeData(getStorage() ?? createEmptyState()),
  replaceAll: (data) => saveStorage(data),
  exportJson: () => JSON.stringify(normalizeData(getStorage() ?? createEmptyState()), null, 2),
  importJson: (payload) => {
    const parsed = JSON.parse(payload) as ERPData
    saveStorage(parsed)
  },
  upsertQuote: (quote) => {
    const data = getStorage() ?? createEmptyState()
    data.orcamentos = upsert(data.orcamentos, quote)
    saveStorage(data)
  },
  upsertOrder: (order) => {
    const data = getStorage() ?? createEmptyState()
    data.pedidos = upsert(data.pedidos, order)
    saveStorage(data)
  },
  addReceipt: (receipt) => {
    const data = getStorage() ?? createEmptyState()
    data.recibos = [...data.recibos, receipt]
    saveStorage(data)
  },
  addFinanceEntry: (entry) => {
    const data = getStorage() ?? createEmptyState()
    data.financeiro = [...data.financeiro, entry]
    saveStorage(data)
  },
}

export const ensureStorageSeed = () => {
  const current = getStorage()
  if (!current) {
    saveStorage(createEmptyState())
  }
}
