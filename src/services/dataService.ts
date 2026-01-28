import type {
  ERPData,
  FinanceEntry,
  Order,
  Product,
  ProductVariant,
  Quote,
  Receipt,
} from '../types/erp'
import {
  createEmptyState,
  DEFAULT_COMPANY,
  DEFAULT_LEVELS,
  DEFAULT_ROLES,
  getStorage,
  saveStorage,
} from './storage'
import { createId } from '../utils/ids'

type RemoteSync = (data: ERPData) => void | Promise<void>

let remoteSync: RemoteSync | null = null

const saveAndSync = (data: ERPData) => {
  saveStorage(data)
  if (remoteSync) {
    void remoteSync(data)
  }
}

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
  const ensureArray = <T>(value: T[] | undefined, fallback: T[]) => {
    if (!Array.isArray(value)) {
      changed = true
      return fallback
    }
    return value
  }

  const produtos = ensureArray(data.produtos, []).map((product) => {
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

  const clientes = ensureArray(data.clientes, []).map((client) => ({
    ...client,
    obras: Array.isArray(client.obras) ? client.obras : [],
  }))
  const fornecedores = ensureArray(data.fornecedores, [])
  const materiais = ensureArray(data.materiais, [])
  const moldes = ensureArray(data.moldes, [])
  const ordensProducao = ensureArray(data.ordensProducao, [])
  const consumosMateriais = ensureArray(data.consumosMateriais, [])
  const orcamentos = ensureArray(data.orcamentos, []).map((quote) => ({
    ...quote,
    items: normalizeItems(quote.items),
  }))
  const pedidos = ensureArray(data.pedidos, []).map((order) => ({
    ...order,
    items: normalizeItems(order.items),
  }))
  const recibos = ensureArray(data.recibos, [])
  const comprasHistorico = ensureArray(data.comprasHistorico, []).map((purchase) => {
    if (!Array.isArray(purchase.items)) {
      changed = true
      return { ...purchase, items: [] }
    }
    return purchase
  })
  const entregas = ensureArray(data.entregas, [])
  const financeiro = ensureArray(data.financeiro, [])
  let empresa = data.empresa && typeof data.empresa === 'object' ? data.empresa : null
  if (!empresa) {
    changed = true
    empresa = { ...DEFAULT_COMPANY }
  }
  const funcionarios = ensureArray(data.funcionarios, [])
  const defaultRoles = DEFAULT_ROLES.map((role) => ({ ...role }))
  const defaultLevels = DEFAULT_LEVELS.map((level) => ({ ...level }))
  const cargos = ensureArray(data.cargos, defaultRoles)
  const niveis = ensureArray(data.niveis, defaultLevels)
  if (cargos.length === 0) {
    changed = true
    cargos.push(...defaultRoles)
  }
  if (niveis.length === 0) {
    changed = true
    niveis.push(...defaultLevels)
  }
  const apontamentos = ensureArray(data.apontamentos, [])
  const usuarios = ensureArray(data.usuarios, [])

  const normalizedProducao = ordensProducao.map((order) => {
    if (!order.variantId) {
      const fallbackVariant = primaryVariantByProduct.get(order.productId)
      if (fallbackVariant) {
        changed = true
        return { ...order, variantId: fallbackVariant }
      }
    }
    return order
  })

  const normalized = {
    ...data,
    produtos,
    clientes,
    fornecedores,
    materiais,
    moldes,
    ordensProducao: normalizedProducao,
    consumosMateriais,
    orcamentos,
    pedidos,
    recibos,
    comprasHistorico,
    entregas,
    financeiro,
    empresa: { ...DEFAULT_COMPANY, ...empresa },
    funcionarios,
    cargos,
    niveis,
    apontamentos,
    usuarios,
  }

  if (changed) {
    saveAndSync(normalized)
  }

  return normalized
}

export const dataService: DataService = {
  getAll: () => normalizeData(getStorage() ?? createEmptyState()),
  replaceAll: (data) => saveAndSync(data),
  exportJson: () => JSON.stringify(normalizeData(getStorage() ?? createEmptyState()), null, 2),
  importJson: (payload) => {
    const parsed = JSON.parse(payload) as ERPData
    saveAndSync(parsed)
  },
  upsertQuote: (quote) => {
    const data = getStorage() ?? createEmptyState()
    data.orcamentos = upsert(data.orcamentos, quote)
    saveAndSync(data)
  },
  upsertOrder: (order) => {
    const data = getStorage() ?? createEmptyState()
    data.pedidos = upsert(data.pedidos, order)
    saveAndSync(data)
  },
  addReceipt: (receipt) => {
    const data = getStorage() ?? createEmptyState()
    data.recibos = [...data.recibos, receipt]
    saveAndSync(data)
  },
  addFinanceEntry: (entry) => {
    const data = getStorage() ?? createEmptyState()
    data.financeiro = [...data.financeiro, entry]
    saveAndSync(data)
  },
}

export const ensureStorageSeed = () => {
  const current = getStorage()
  if (!current) {
    saveAndSync(createEmptyState())
  }
}

export const setRemoteSync = (handler: RemoteSync | null) => {
  remoteSync = handler
}
