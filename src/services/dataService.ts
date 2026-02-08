import type {
  ERPData,
  FinanceEntry,
  Order,
  PdvCashMovement,
  PdvCashSession,
  Product,
  ProductMaterialUsage,
  ProductUnit,
  Quote,
  Receipt,
  MaterialKind,
  MaterialUnit,
} from '../types/erp'
import { appendAuditEvent, type AuditInput } from './audit'
import { deriveUsagesFromBatch } from '../utils/batch'
import { getDefaultUsageUnit } from '../utils/materialUsage'
import {
  createEmptyState,
  DEFAULT_CASHBOXES,
  DEFAULT_COMPANY,
  DEFAULT_INTEGRATIONS,
  DEFAULT_LEVELS,
  DEFAULT_ROLES,
  DEFAULT_TABLES,
  getStorage,
  saveStorage,
} from './storage'
import { createId } from '../utils/ids'

type RemoteSync = (data: ERPData) => void | Promise<void>
type SaveOptions = {
  touchMeta?: boolean
  skipSync?: boolean
  emitEvent?: boolean
  auditEvent?: AuditInput
}

let remoteSync: RemoteSync | null = null

const stripAvatarUrls = (data: ERPData) => {
  if (!Array.isArray(data.usuarios)) {
    return data
  }
  let changed = false
  const usuarios = data.usuarios.map((user) => {
    const { avatarUrl, ...rest } = user
    if (typeof avatarUrl !== 'undefined') {
      changed = true
      return rest
    }
    return user
  })
  return changed ? { ...data, usuarios } : data
}

const dispatchDataEvent = () => {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new Event('umoya:data'))
}

const saveAndSync = (data: ERPData, options?: SaveOptions) => {
  const shouldTouchMeta = options?.touchMeta !== false
  const shouldEmitEvent = options?.emitEvent !== false
  const sanitized = stripAvatarUrls(data)
  const next: ERPData = shouldTouchMeta
    ? {
        ...sanitized,
        meta: {
          ...sanitized.meta,
          updatedAt: new Date().toISOString(),
        },
      }
    : sanitized
  saveStorage(next)
  if (shouldEmitEvent) {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(dispatchDataEvent)
    } else {
      setTimeout(dispatchDataEvent, 0)
    }
  }
  if (remoteSync && !options?.skipSync) {
    void remoteSync(next)
  }
}

const applyAudit = (data: ERPData, options?: SaveOptions) => {
  if (options?.auditEvent) {
    return appendAuditEvent(data, options.auditEvent)
  }
  return data
}

export type DataService = {
  getAll: () => ERPData
  replaceAll: (data: ERPData, options?: SaveOptions) => void
  exportJson: () => string
  importJson: (payload: string) => void
  upsertQuote: (quote: Quote, options?: SaveOptions) => void
  upsertOrder: (order: Order, options?: SaveOptions) => void
  addReceipt: (receipt: Receipt, options?: SaveOptions) => void
  addFinanceEntry: (entry: FinanceEntry, options?: SaveOptions) => void
  upsertPdvCashSession: (session: PdvCashSession, options?: SaveOptions) => void
  addPdvCashMovement: (movement: PdvCashMovement, options?: SaveOptions) => void
}

const upsert = <T extends { id: string }>(items: T[], next: T) => {
  const index = items.findIndex((item) => item.id === next.id)
  if (index >= 0) {
    items[index] = next
    return items
  }
  return [...items, next]
}

const normalizeVariants = (
  product: Product,
  materialKindById: Map<string, MaterialKind>,
  markChanged: () => void,
) => {
  const rawVariants = Array.isArray(product.variants) ? product.variants : []
  if (rawVariants !== product.variants) {
    markChanged()
  }
  return rawVariants.map((variant) => {
    let next = variant
    if (!variant.id) {
      markChanged()
      next = { ...next, id: createId() }
    }
    if (variant.stock === undefined || variant.stock === null) {
      markChanged()
      next = { ...next, stock: 0 }
    }
    if (variant.active === undefined || variant.active === null) {
      markChanged()
      next = { ...next, active: true }
    }
    if (variant.locked === undefined || variant.locked === null) {
      markChanged()
      next = { ...next, locked: false }
    }
    const rawUsages = Array.isArray(variant.materialUsages) ? variant.materialUsages : []
    if (rawUsages !== variant.materialUsages) {
      markChanged()
    }
    let materialUsages: ProductMaterialUsage[] = rawUsages.map((usage) => {
      const nextId = usage.id || createId()
      if (nextId !== usage.id) {
        markChanged()
      }
      const quantity = Number.isFinite(usage.quantity) ? usage.quantity : 0
      if (quantity !== usage.quantity) {
        markChanged()
      }
      const materialKind = materialKindById.get(usage.materialId) ?? 'outro'
      const fallbackUnit =
        usage.unitMode === 'metro'
          ? 'metro'
          : getDefaultUsageUnit(materialKind)
      const usageUnit = usage.usageUnit ?? fallbackUnit
      if (usageUnit !== usage.usageUnit) {
        markChanged()
      }
      return { ...usage, id: nextId, quantity, usageUnit }
    })
    const rawBatch =
      variant.batchRecipe && typeof variant.batchRecipe === 'object'
        ? variant.batchRecipe
        : undefined
    let batchRecipe = rawBatch
    if (rawBatch) {
      const batchItems = Array.isArray(rawBatch.items) ? rawBatch.items : []
      if (batchItems !== rawBatch.items) {
        markChanged()
      }
      const normalizedItems = batchItems.map((item) => {
        const nextId = item.id || createId()
        if (nextId !== item.id) {
          markChanged()
        }
        const quantity = Number.isFinite(item.quantity) ? item.quantity : 0
        if (quantity !== item.quantity) {
          markChanged()
        }
        const materialKind = materialKindById.get(item.materialId) ?? 'outro'
        const usageUnit = item.usageUnit ?? getDefaultUsageUnit(materialKind)
        if (usageUnit !== item.usageUnit) {
          markChanged()
        }
        return { ...item, id: nextId, quantity, usageUnit }
      })
      const yieldQuantity = Number.isFinite(rawBatch.yieldQuantity)
        ? rawBatch.yieldQuantity
        : 0
      if (yieldQuantity !== rawBatch.yieldQuantity) {
        markChanged()
      }
      const id = rawBatch.id || createId()
      if (id !== rawBatch.id) {
        markChanged()
      }
      const productId = rawBatch.productId || product.id
      if (productId !== rawBatch.productId) {
        markChanged()
      }
      const variantId = rawBatch.variantId || variant.id
      if (variantId !== rawBatch.variantId) {
        markChanged()
      }
      batchRecipe = {
        ...rawBatch,
        id,
        productId,
        variantId,
        yieldQuantity,
        items: normalizedItems,
      }
    }
    if (
      batchRecipe &&
      batchRecipe.items.length > 0 &&
      batchRecipe.yieldQuantity > 0 &&
      (materialUsages.length === 0 || materialUsages.every((usage) => usage.source === 'batch'))
    ) {
      materialUsages = deriveUsagesFromBatch(batchRecipe)
      markChanged()
    }
    return { ...next, materialUsages, batchRecipe }
  })
}

const normalizeMaterialUnit = (unit?: string): MaterialUnit | undefined => {
  if (!unit) {
    return undefined
  }
  const normalized = unit.toLowerCase().trim()
  if (
    normalized === 'saco_50kg' ||
    normalized === 'saco50kg' ||
    normalized === 'saco_50' ||
    normalized === 'saco 50kg' ||
    normalized === 'saco50' ||
    normalized === 'saco'
  ) {
    return 'saco_50kg'
  }
  if (
    normalized === 'm3' ||
    normalized === 'm³' ||
    normalized === 'metro cubico' ||
    normalized === 'metro_cubico' ||
    normalized === 'm^3'
  ) {
    return 'm3'
  }
  if (
    normalized === 'unidade' ||
    normalized === 'unid' ||
    normalized === 'un' ||
    normalized === 'und'
  ) {
    return 'unidade'
  }
  return undefined
}

const normalizeProductUnit = (unit?: string): ProductUnit | undefined => {
  if (!unit) {
    return undefined
  }
  const normalized = unit.toLowerCase().trim()
  if (
    normalized === 'm2' ||
    normalized === 'm²' ||
    normalized === 'metro quadrado' ||
    normalized === 'metro_quadrado' ||
    normalized === 'm^2'
  ) {
    return 'm2'
  }
  if (
    normalized === 'metro_linear' ||
    normalized === 'metro linear' ||
    normalized === 'metro' ||
    normalized === 'm linear' ||
    normalized === 'm'
  ) {
    return 'metro_linear'
  }
  if (
    normalized === 'unidade' ||
    normalized === 'unid' ||
    normalized === 'un' ||
    normalized === 'und'
  ) {
    return 'unidade'
  }
  return undefined
}

const normalizeMaterialKind = (kind?: string): MaterialKind | undefined => {
  if (!kind) {
    return undefined
  }
  const normalized = kind.toLowerCase().trim()
  if (normalized === 'areia') return 'areia'
  if (normalized === 'brita') return 'brita'
  if (normalized === 'cimento') return 'cimento'
  if (normalized === 'trelica') return 'trelica'
  if (normalized === 'aco') return 'aco'
  if (normalized === 'aditivo') return 'aditivo'
  if (normalized === 'agua') return 'agua'
  if (normalized === 'outro') return 'outro'
  return undefined
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

  const rawMaterials = ensureArray(data.materiais, [])
  const materialKindById = new Map<string, MaterialKind>()
  rawMaterials.forEach((material) => {
    const kind = normalizeMaterialKind(material.kind) ?? 'outro'
    materialKindById.set(material.id, kind)
  })

  const produtos = ensureArray(data.produtos, []).map((product) => {
    const variants = normalizeVariants(product, materialKindById, () => {
      changed = true
    })
    const priceMin = product.priceMin ?? undefined
    const maxDiscountPercent = product.maxDiscountPercent ?? undefined
    if (product.priceMin === null || product.maxDiscountPercent === null) {
      changed = true
    }
    const unit = normalizeProductUnit(product.unit)
    if (unit !== product.unit) {
      changed = true
    }
    const rawUsages = ensureArray<ProductMaterialUsage>(product.materialUsages, [])
    if (rawUsages !== product.materialUsages) {
      changed = true
    }
    let materialUsages: ProductMaterialUsage[] = rawUsages.map((usage) => {
      const nextId = usage.id || createId()
      if (nextId !== usage.id) {
        changed = true
      }
      const quantity = Number.isFinite(usage.quantity) ? usage.quantity : 0
      if (quantity !== usage.quantity) {
        changed = true
      }
      const materialKind = materialKindById.get(usage.materialId) ?? 'outro'
      const fallbackUnit =
        usage.unitMode === 'metro'
          ? 'metro'
          : getDefaultUsageUnit(materialKind)
      const usageUnit = usage.usageUnit ?? fallbackUnit
      if (usageUnit !== usage.usageUnit) {
        changed = true
      }
      return { ...usage, id: nextId, quantity, usageUnit }
    })
    const rawBatch =
      product.batchRecipe && typeof product.batchRecipe === 'object'
        ? product.batchRecipe
        : undefined
    let batchRecipe = rawBatch
    if (rawBatch) {
      const batchItems = ensureArray(rawBatch.items, [])
      if (batchItems !== rawBatch.items) {
        changed = true
      }
      const normalizedItems = batchItems.map((item) => {
        const nextId = item.id || createId()
        if (nextId !== item.id) {
          changed = true
        }
        const quantity = Number.isFinite(item.quantity) ? item.quantity : 0
        if (quantity !== item.quantity) {
          changed = true
        }
        const materialKind = materialKindById.get(item.materialId) ?? 'outro'
        const usageUnit = item.usageUnit ?? getDefaultUsageUnit(materialKind)
        if (usageUnit !== item.usageUnit) {
          changed = true
        }
        return { ...item, id: nextId, quantity, usageUnit }
      })
      const yieldQuantity = Number.isFinite(rawBatch.yieldQuantity)
        ? rawBatch.yieldQuantity
        : 0
      if (yieldQuantity !== rawBatch.yieldQuantity) {
        changed = true
      }
      const id = rawBatch.id || createId()
      if (id !== rawBatch.id) {
        changed = true
      }
      const productId = rawBatch.productId || product.id
      if (productId !== rawBatch.productId) {
        changed = true
      }
      batchRecipe = {
        ...rawBatch,
        id,
        productId,
        yieldQuantity,
        items: normalizedItems,
      }
    }
    if (
      batchRecipe &&
      batchRecipe.items.length > 0 &&
      batchRecipe.yieldQuantity > 0 &&
      (materialUsages.length === 0 || materialUsages.every((usage) => usage.source === 'batch'))
    ) {
      materialUsages = deriveUsagesFromBatch(batchRecipe)
      changed = true
    }
    const hasVariants =
      typeof product.hasVariants === 'boolean'
        ? product.hasVariants
        : variants.length > 0
    if (hasVariants !== product.hasVariants) {
      changed = true
    }
    const producedInternally =
      typeof product.producedInternally === 'boolean'
        ? product.producedInternally
        : true
    if (producedInternally !== product.producedInternally) {
      changed = true
    }
    return {
      ...product,
      priceMin,
      maxDiscountPercent,
      variants,
      unit,
      producedInternally,
      hasVariants,
      materialUsages,
      batchRecipe,
    }
  })

  const primaryVariantByProduct = new Map<string, string>()
  const productUnitById = new Map<string, ProductUnit | undefined>()
  const productHasVariantsById = new Map<string, boolean>()
  produtos.forEach((product) => {
    if (product.variants && product.variants.length > 0) {
      primaryVariantByProduct.set(product.id, product.variants[0].id)
    }
    productUnitById.set(product.id, product.unit)
    productHasVariantsById.set(product.id, product.hasVariants ?? false)
  })

  const normalizeItems = <
    T extends {
      productId: string
      variantId?: string
      customLength?: number
      customWidth?: number
      customHeight?: number
    },
  >(
    items: T[],
  ) =>
    items.map((item) => {
      const next = { ...item }
      const unit = productUnitById.get(item.productId)
      const hasVariants = productHasVariantsById.get(item.productId) ?? false
      if (!item.variantId && unit !== 'metro_linear' && hasVariants) {
        const fallbackVariant = primaryVariantByProduct.get(item.productId)
        if (fallbackVariant) {
          changed = true
          next.variantId = fallbackVariant
        }
      }
      const length =
        typeof item.customLength === 'number' && Number.isFinite(item.customLength)
          ? item.customLength
          : 0
      const width =
        typeof item.customWidth === 'number' && Number.isFinite(item.customWidth)
          ? item.customWidth
          : 0
      const height =
        typeof item.customHeight === 'number' && Number.isFinite(item.customHeight)
          ? item.customHeight
          : 0
      if (
        length !== item.customLength ||
        width !== item.customWidth ||
        height !== item.customHeight
      ) {
        changed = true
        return { ...next, customLength: length, customWidth: width, customHeight: height }
      }
      return next
    })

  const clientes = ensureArray(data.clientes, []).map((client) => ({
    ...client,
    obras: Array.isArray(client.obras) ? client.obras : [],
  }))
  const meta = data.meta && typeof data.meta === 'object' ? data.meta : undefined
  const fornecedores = ensureArray(data.fornecedores, [])
  const materiais = rawMaterials.map((material) => {
    const unit = normalizeMaterialUnit(material.unit)
    if (unit !== material.unit) {
      changed = true
    }
    const kind = normalizeMaterialKind(material.kind) ?? 'outro'
    if (kind !== material.kind) {
      changed = true
    }
    const metersPerUnit =
      material.metersPerUnit && material.metersPerUnit > 0
        ? material.metersPerUnit
        : undefined
    if (metersPerUnit !== material.metersPerUnit) {
      changed = true
    }
    if (material.stock === undefined || material.stock === null) {
      changed = true
      return { ...material, stock: 0, unit, kind, metersPerUnit }
    }
    return { ...material, unit, kind, metersPerUnit }
  })
  const moldes = ensureArray(data.moldes, []).map((mold) => {
    if (mold.stock === undefined || mold.stock === null) {
      changed = true
      return { ...mold, stock: 0 }
    }
    return mold
  })
  const ordensProducao = ensureArray(data.ordensProducao, [])
  const lotesProducao = ensureArray(data.lotesProducao, [])
  const refugosProducao = ensureArray(data.refugosProducao, [])
  const consumosMateriais = ensureArray(data.consumosMateriais, [])
  const orcamentos = ensureArray(data.orcamentos, []).map((quote) => ({
    ...quote,
    items: normalizeItems(quote.items),
  }))
  const pedidos = ensureArray(data.pedidos, []).map((order) => ({
    ...order,
    paymentMethod: order.paymentMethod?.trim() || 'a_definir',
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
  const fiscalNotas = ensureArray(data.fiscalNotas, [])
  const qualidadeChecks = ensureArray(data.qualidadeChecks, [])
  const manutencoes = ensureArray(data.manutencoes, [])
  const financeiro = ensureArray(data.financeiro, []).map((entry) => {
    if (!entry.cashboxId) {
      changed = true
      return { ...entry, cashboxId: 'caixa_operacional' }
    }
    return entry
  })
  const caixas = ensureArray(data.caixas, DEFAULT_CASHBOXES.map((cashbox) => ({ ...cashbox })))
  const conferenciasCaixaFisico = ensureArray(data.conferenciasCaixaFisico, [])
  const pdvCaixas = ensureArray(data.pdvCaixas, [])
  const pdvMovimentacoes = ensureArray(data.pdvMovimentacoes, [])
  const tabelasRaw =
    data.tabelas && typeof data.tabelas === 'object' ? data.tabelas : undefined
  if (!tabelasRaw) {
    changed = true
  }
  const tabelas = {
    units: ensureArray(tabelasRaw?.units, DEFAULT_TABLES.units.map((item) => ({ ...item }))),
    categories: ensureArray(
      tabelasRaw?.categories,
      DEFAULT_TABLES.categories.map((item) => ({ ...item })),
    ),
    paymentMethods: ensureArray(
      tabelasRaw?.paymentMethods,
      DEFAULT_TABLES.paymentMethods.map((item) => ({ ...item })),
    ),
  }
  const auditoria = ensureArray(data.auditoria, [])
  const integracoes = ensureArray(
    data.integracoes,
    DEFAULT_INTEGRATIONS.map((item) => ({ ...item })),
  )
  let empresa = data.empresa && typeof data.empresa === 'object' ? data.empresa : null
  if (!empresa) {
    changed = true
    empresa = { ...DEFAULT_COMPANY }
  }
  const funcionarios = ensureArray(data.funcionarios, [])
  const defaultRoles = DEFAULT_ROLES.map((role) => ({ ...role }))
  const defaultLevels = DEFAULT_LEVELS.map((level) => ({ ...level }))
  const cargos = ensureArray(data.cargos, defaultRoles).map((role) => {
    if (role.permissions && typeof role.permissions !== 'object') {
      changed = true
      return { ...role, permissions: undefined }
    }
    return role
  })
  const niveis = ensureArray(data.niveis, defaultLevels)
  if (cargos.length === 0) {
    changed = true
    cargos.push(...defaultRoles)
  }
  if (cargos.length > 0) {
    const roleIds = new Set(cargos.map((role) => role.id))
    defaultRoles.forEach((role) => {
      if (!roleIds.has(role.id)) {
        cargos.push(role)
        changed = true
      }
    })
  }
  if (niveis.length === 0) {
    changed = true
    niveis.push(...defaultLevels)
  }
  if (caixas.length === 0) {
    changed = true
    caixas.push(...DEFAULT_CASHBOXES.map((cashbox) => ({ ...cashbox })))
  }
  const apontamentos = ensureArray(data.apontamentos, [])
  const presencas = ensureArray(data.presencas, [])
  const pagamentosRH = ensureArray(data.pagamentosRH, [])
  const ocorrenciasRH = ensureArray(data.ocorrenciasRH, [])
  const usuariosRaw = ensureArray(data.usuarios, [])
  const usuarios = usuariosRaw.map((user) => {
    const { avatarUrl, ...rest } = user
    if (typeof avatarUrl !== 'undefined') {
      changed = true
      return rest
    }
    return user
  })

  const normalizedProducao = ordensProducao.map((order) => {
    if (
      !order.variantId &&
      productUnitById.get(order.productId) !== 'metro_linear' &&
      productHasVariantsById.get(order.productId)
    ) {
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
    lotesProducao,
    refugosProducao,
    consumosMateriais,
    orcamentos,
    pedidos,
    recibos,
    comprasHistorico,
    entregas,
    fiscalNotas,
    qualidadeChecks,
    manutencoes,
    financeiro,
    caixas,
    conferenciasCaixaFisico,
    pdvCaixas,
    pdvMovimentacoes,
    tabelas,
    empresa: { ...DEFAULT_COMPANY, ...empresa },
    integracoes,
    funcionarios,
    cargos,
    niveis,
    apontamentos,
    presencas,
    pagamentosRH,
    ocorrenciasRH,
    usuarios,
    auditoria,
    meta,
  }

  if (changed) {
    saveAndSync(normalized, { emitEvent: false })
  }

  return normalized
}

export const dataService: DataService = {
  getAll: () => normalizeData(getStorage() ?? createEmptyState()),
  replaceAll: (data, options) => saveAndSync(applyAudit(data, options), options),
  exportJson: () => JSON.stringify(normalizeData(getStorage() ?? createEmptyState()), null, 2),
  importJson: (payload) => {
    const parsed = JSON.parse(payload) as ERPData
    saveAndSync(parsed)
  },
  upsertQuote: (quote, options) => {
    const data = getStorage() ?? createEmptyState()
    data.orcamentos = upsert(data.orcamentos, quote)
    saveAndSync(applyAudit(data, options), options)
  },
  upsertOrder: (order, options) => {
    const data = getStorage() ?? createEmptyState()
    data.pedidos = upsert(data.pedidos, order)
    saveAndSync(applyAudit(data, options), options)
  },
  addReceipt: (receipt, options) => {
    const data = getStorage() ?? createEmptyState()
    data.recibos = [...data.recibos, receipt]
    saveAndSync(applyAudit(data, options), options)
  },
  addFinanceEntry: (entry, options) => {
    const data = getStorage() ?? createEmptyState()
    data.financeiro = [...data.financeiro, entry]
    saveAndSync(applyAudit(data, options), options)
  },
  upsertPdvCashSession: (session, options) => {
    const data = getStorage() ?? createEmptyState()
    data.pdvCaixas = upsert(data.pdvCaixas, session)
    saveAndSync(applyAudit(data, options), options)
  },
  addPdvCashMovement: (movement, options) => {
    const data = getStorage() ?? createEmptyState()
    data.pdvMovimentacoes = [...data.pdvMovimentacoes, movement]
    saveAndSync(applyAudit(data, options), options)
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
