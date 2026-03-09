import { useEffect, useMemo, useState, type FormEvent } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import DimensionInput from '../../components/DimensionInput'
import Modal from '../../components/Modal'
import QuickNotice from '../../components/QuickNotice'
import logotipo from '../../assets/brand/logotipo.svg'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type {
  MaterialConsumption,
  ProductionLot,
  ProductionOrder,
  ProductMaterialUsage,
} from '../../types/erp'
import type { PageIntentAction } from '../../types/ui'
import { formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'
import { resolveOrderInternalCode } from '../../utils/orderCode'
import { getUnitFactor } from '../../utils/pricing'
import { convertUsageToPurchaseQuantity, getDefaultUsageUnit } from '../../utils/materialUsage'
import { findStockItemIndex } from '../../utils/stockItems'

const statusLabels: Record<ProductionOrder['status'], string> = {
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Em andamento',
  PARCIAL: 'Parcial',
  CONCLUIDA: 'Concluida',
  CANCELADA: 'Cancelada',
}

const toCentimeters = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value * 100) : 0

const buildDimensionLabel = (values: number[]) => {
  const filtered = values.filter((value) => Number.isFinite(value) && value > 0)
  if (filtered.length === 0) {
    return ''
  }
  const label = filtered.map((value) => Math.round(toCentimeters(value))).join(' x ')
  return `${label} cm`
}

type ProducaoProps = {
  pageIntent?: PageIntentAction
  onConsumeIntent?: () => void
}

type ProductionEntryForm = {
  productionOrderId: string
  employeeId: string
  date: string
  quantity: number
  lengthM: number
  scrapQuantity: number
  scrapLengthM: number
  notes: string
}

const Producao = ({ pageIntent, onConsumeIntent }: ProducaoProps) => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [isManualOpen, setIsManualOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [printGroupId, setPrintGroupId] = useState<string | null>(null)
  const [manualForm, setManualForm] = useState({
    productId: '',
    variantId: '',
    quantity: 1,
    customLength: 0,
  })
  const createEntryForm = (): ProductionEntryForm => ({
    productionOrderId: '',
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    quantity: 1,
    lengthM: 0,
    scrapQuantity: 0,
    scrapLengthM: 0,
    notes: '',
  })
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  const [entryForm, setEntryForm] = useState<ProductionEntryForm>(createEntryForm())
  const entryFormId = 'producao-apontamento-form'

  const productionOrders = useMemo(
    () =>
      [...data.ordensProducao].sort((a, b) =>
        (b.plannedAt ?? '').localeCompare(a.plannedAt ?? ''),
      ),
    [data.ordensProducao],
  )
  const employees = useMemo(
    () => [...data.funcionarios].sort((a, b) => a.name.localeCompare(b.name)),
    [data.funcionarios],
  )
  const productionEntriesByOrder = useMemo(() => {
    const map = new Map<string, (typeof data.productionEntries)[number][]>()
    data.productionEntries.forEach((entry) => {
      if (!entry.productionOrderId) {
        return
      }
      const current = map.get(entry.productionOrderId) ?? []
      current.push(entry)
      map.set(entry.productionOrderId, current)
    })
    map.forEach((list) => {
      list.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    })
    return map
  }, [data.productionEntries])
  const productionSummary = useMemo(() => {
    return productionOrders.reduce(
      (acc, order) => {
        acc.total += 1
        if (order.status === 'ABERTA') {
          acc.open += 1
        }
        if (order.status === 'EM_ANDAMENTO' || order.status === 'PARCIAL') {
          acc.active += 1
        }
        if (order.status === 'CONCLUIDA') {
          acc.done += 1
        }
        return acc
      },
      { total: 0, open: 0, active: 0, done: 0 },
    )
  }, [productionOrders])

  const getOrder = (id: string) => data.pedidos.find((order) => order.id === id)
  const getClientName = (id: string) =>
    data.clientes.find((client) => client.id === id)?.name ?? 'Cliente'
  const productionGroups = useMemo(() => {
    const groups: {
      id: string
      title: string
      meta?: string
      orders: ProductionOrder[]
    }[] = []
    const indexById = new Map<string, number>()
    productionOrders.forEach((order) => {
      const groupId = order.linkedOrderId ?? order.orderId
      let index = indexById.get(groupId)
      if (index === undefined) {
        const linkedOrder = data.pedidos.find((item) => item.id === groupId)
        const orderCode = linkedOrder ? resolveOrderInternalCode(linkedOrder) : groupId.slice(0, 6)
        const clientName = linkedOrder ? getClientName(linkedOrder.clientId) : ''
        const title = linkedOrder
          ? `Pedido #${orderCode}`
          : order.source === 'estoque'
            ? 'Estoque interno'
            : `Pedido #${orderCode}`
        const meta = clientName
          ? `Cliente: ${clientName}`
          : order.source === 'estoque'
            ? 'Ordem de estoque'
            : undefined
        index = groups.length
        indexById.set(groupId, index)
        groups.push({ id: groupId, title, meta, orders: [] })
      }
      groups[index].orders.push(order)
    })
    return groups
  }, [data.clientes, data.pedidos, productionOrders])
  const getEmployeeName = (id?: string) =>
    employees.find((employee) => employee.id === id)?.name ?? 'Equipe'
  const getProductName = (id: string) =>
    data.produtos.find((product) => product.id === id)?.name ?? 'Produto'
  const getVariant = (productId: string, variantId?: string) =>
    data.produtos
      .find((product) => product.id === productId)
      ?.variants?.find((variant) => variant.id === variantId)
  const getOrderLabel = (order: ProductionOrder) => {
    const productName = getProductName(order.productId)
    const variantName = order.variantId
      ? getVariant(order.productId, order.variantId)?.name
      : ''
    const lengthLabel =
      order.customLength && order.customLength > 0
        ? `${Math.round(order.customLength * 100)} cm`
        : ''
    const parts = [productName, variantName, lengthLabel].filter(Boolean)
    return `${parts.join(' · ')} · ${order.quantity} un`
  }
  const getProductionCode = (order: ProductionOrder) =>
    order.code?.trim() || order.id.slice(0, 6)

  const printContext = useMemo(() => {
    if (!printGroupId) {
      return null
    }
    const group = productionGroups.find((entry) => entry.id === printGroupId)
    if (!group) {
      return null
    }
    const linkedOrder =
      data.pedidos.find((order) => order.id === group.id) ?? null
    const client = linkedOrder
      ? data.clientes.find((entry) => entry.id === linkedOrder.clientId) ?? null
      : null
    const obra =
      linkedOrder && client?.obras
        ? client.obras.find((entry) => entry.id === linkedOrder.obraId) ?? null
        : null
    const fallbackName = group.meta?.startsWith('Cliente:')
      ? group.meta.replace('Cliente:', '').trim()
      : 'Estoque interno'
    const plannedAt =
      linkedOrder?.createdAt ??
      group.orders.find((order) => order.plannedAt)?.plannedAt ??
      new Date().toISOString()
    return {
      group,
      linkedOrder,
      clientName: client?.name ?? fallbackName,
      clientDocument: client?.document?.trim() || '',
      clientContactLine: [client?.phone, client?.email].filter(Boolean).join(' • '),
      clientAddressLine: [obra?.address, obra?.city ?? client?.city]
        .filter(Boolean)
        .join(' - '),
      obraName: obra?.name ?? '',
      orderCode: linkedOrder ? resolveOrderInternalCode(linkedOrder) : '',
      plannedAt,
    }
  }, [data.clientes, data.pedidos, printGroupId, productionGroups])

  const printItems = useMemo(() => {
    if (!printContext) {
      return []
    }
    return printContext.group.orders
      .map((order) => {
        const product = data.produtos.find((entry) => entry.id === order.productId)
        if (!product?.producedInternally) {
          return null
        }
        const variant = product.variants?.find((entry) => entry.id === order.variantId)
        const isLinear = product.unit === 'metro_linear'
        const length =
          order.customLength ?? (isLinear ? product.length ?? 0 : undefined)
        const sizeLabel = isLinear
          ? buildDimensionLabel([length ?? 0])
          : buildDimensionLabel([
              variant?.length ?? product.length ?? 0,
              variant?.width ?? product.width ?? 0,
              variant?.height ?? product.height ?? 0,
            ])
        const plannedQty = Number.isFinite(order.plannedQty)
          ? order.plannedQty ?? 0
          : order.quantity
        const variantLabel = variant ? ` • ${variant.name}` : ''
        return {
          id: order.id,
          opCode: getProductionCode(order),
          name: `${product.name ?? 'Produto'}${variantLabel}`,
          sizeLabel,
          plannedQty,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }, [data.produtos, printContext])

  const availableProducts = data.produtos.filter((product) => product.active !== false)
  const manualProduct = data.produtos.find((product) => product.id === manualForm.productId)
  const manualIsLinear = manualProduct?.unit === 'metro_linear'
  const manualHasVariants = manualProduct?.hasVariants ?? false
  const entryOrder = useMemo(
    () =>
      data.ordensProducao.find((order) => order.id === entryForm.productionOrderId) ??
      null,
    [data.ordensProducao, entryForm.productionOrderId],
  )
  const entryProduct = entryOrder
    ? data.produtos.find((product) => product.id === entryOrder.productId) ?? null
    : null
  const entryIsLinear = entryProduct?.unit === 'metro_linear'
  const entryTotalLength = entryIsLinear ? entryForm.quantity * entryForm.lengthM : 0
  const entryOrderCode = entryOrder ? getProductionCode(entryOrder) : '-'

  const resetManualForm = () => {
    const firstProduct = availableProducts[0]
    const firstVariant = firstProduct?.variants?.[0]
    setManualForm({
      productId: firstProduct?.id ?? '',
      variantId:
        firstProduct?.unit === 'metro_linear' || !firstProduct?.hasVariants
          ? ''
          : firstVariant?.id ?? '',
      quantity: 1,
      customLength:
        firstProduct?.unit === 'metro_linear'
          ? firstProduct.length && firstProduct.length > 0
            ? firstProduct.length
            : 1
          : 0,
    })
  }

  const handleManualProductChange = (productId: string) => {
    const product = data.produtos.find((item) => item.id === productId)
    const firstVariant = product?.variants?.[0]
    setManualForm((prev) => ({
      ...prev,
      productId,
      variantId:
        product?.unit === 'metro_linear' || !product?.hasVariants
          ? ''
          : firstVariant?.id ?? '',
      customLength:
        product?.unit === 'metro_linear'
          ? product.length && product.length > 0
            ? product.length
            : 1
          : 0,
    }))
  }

  const handleManualVariantChange = (variantId: string) => {
    const product = data.produtos.find((item) => item.id === manualForm.productId)
    if (product?.unit === 'metro_linear' || !product?.hasVariants) {
      setManualForm((prev) => ({
        ...prev,
        variantId: '',
      }))
      return
    }
    setManualForm((prev) => ({
      ...prev,
      variantId,
    }))
  }

  const openEntryModal = (order: ProductionOrder) => {
    const product = data.produtos.find((item) => item.id === order.productId)
    const isLinear = product?.unit === 'metro_linear'
    const fallbackLength = Number.isFinite(product?.length) ? product?.length ?? 0 : 0
    const length = isLinear
      ? Number.isFinite(order.plannedLengthM)
        ? order.plannedLengthM ?? fallbackLength
        : Number.isFinite(order.customLength)
          ? order.customLength ?? fallbackLength
          : fallbackLength
      : 0
    setStatus(null)
    setEntryForm({
      productionOrderId: order.id,
      employeeId: '',
      date: new Date().toISOString().slice(0, 10),
      quantity: 1,
      lengthM: length,
      scrapQuantity: 0,
      scrapLengthM: 0,
      notes: '',
    })
    setIsEntryOpen(true)
  }

  const updateEntryForm = (patch: Partial<ProductionEntryForm>) => {
    setEntryForm((prev) => ({ ...prev, ...patch }))
  }

  const handleEntrySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!entryForm.productionOrderId) {
      setStatus('Selecione uma ordem para apontar.')
      return
    }
    if (!entryForm.employeeId) {
      setStatus('Selecione um funcionario.')
      return
    }
    if (entryForm.quantity <= 0) {
      setStatus('Informe uma quantidade valida.')
      return
    }
    if (entryIsLinear && entryForm.lengthM <= 0) {
      setStatus('Informe o comprimento.')
      return
    }
    if (entryForm.scrapQuantity < 0 || entryForm.scrapQuantity > entryForm.quantity) {
      setStatus('Refugo nao pode ser maior que a quantidade.')
      return
    }
    const payload = dataService.getAll()
    payload.productionEntries = [
      ...payload.productionEntries,
      {
        id: createId(),
        productionOrderId: entryForm.productionOrderId,
        employeeId: entryForm.employeeId,
        date: entryForm.date,
        quantity: entryForm.quantity,
        lengthM: entryIsLinear ? entryForm.lengthM : undefined,
        scrapQuantity: entryForm.scrapQuantity > 0 ? entryForm.scrapQuantity : undefined,
        scrapLengthM:
          entryIsLinear && entryForm.scrapLengthM > 0 ? entryForm.scrapLengthM : undefined,
        notes: entryForm.notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      },
    ]
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Apontamento registrado',
        description: entryOrder ? `OP ${getProductionCode(entryOrder)}` : undefined,
      },
    })
    refresh()
    setStatus('Apontamento registrado.')
    setIsEntryOpen(false)
    setEntryForm(createEntryForm())
  }

  const updateProduction = (
    next: ProductionOrder,
    audit?: { title: string; description?: string },
  ) => {
    const payload = dataService.getAll()
    payload.ordensProducao = payload.ordensProducao.map((item) =>
      item.id === next.id ? next : item,
    )
    dataService.replaceAll(payload, {
      auditEvent: audit
        ? { category: 'acao', title: audit.title, description: audit.description }
        : undefined,
    })
    refresh()
  }

  const toLengthCmLabel = (lengthMeters: number) => {
    const cm = Math.round(lengthMeters * 100)
    return cm > 0 ? cm : 0
  }

  const formatMeasurement = (value: number) =>
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)

  const toDateInputValue = (value?: string) =>
    value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10)

  const addDaysToDate = (value: string, days: number) => {
    if (!value) {
      return ''
    }
    const safeDays = Number.isFinite(days) ? days : 0
    if (safeDays <= 0) {
      return value
    }
    const base = new Date(`${value}T00:00:00Z`)
    const next = new Date(base.getTime() + safeDays * 24 * 60 * 60 * 1000)
    return next.toISOString().slice(0, 10)
  }

  const upsertLinearStockVariant = (
    product: (typeof data.produtos)[number],
    lengthMeters: number,
    quantityDelta: number,
  ) => {
    const length = Number.isFinite(lengthMeters) && lengthMeters > 0 ? lengthMeters : 1
    const lengthCm = toLengthCmLabel(length)
    const variantId = `auto-${product.id}-${lengthCm}`
    const baseSku = product.sku?.trim()
    const variantSku = baseSku ? `${baseSku}-${lengthCm}` : undefined
    const variants = product.variants ?? []
    const targetIndex = variants.findIndex(
      (variant) =>
        variant.id === variantId ||
        (variant.locked &&
          Number.isFinite(variant.length) &&
          Math.abs((variant.length ?? 0) - length) < 0.0001),
    )
    if (targetIndex >= 0) {
      const target = variants[targetIndex]
      const nextStock = (target.stock ?? 0) + quantityDelta
      const updated = {
        ...target,
        stock: nextStock,
        name: target.name || `${lengthCm}`,
        length,
        sku: variantSku ?? target.sku,
        active: target.active ?? true,
        locked: true,
      }
      return {
        ...product,
        variants: variants.map((variant, index) =>
          index === targetIndex ? updated : variant,
        ),
      }
    }
    const nextVariant = {
      id: variantId,
      productId: product.id,
      name: `${lengthCm}`,
      length,
      stock: quantityDelta,
      sku: variantSku,
      active: true,
      locked: true,
      isCustom: true,
    }
    return {
      ...product,
      variants: [...variants, nextVariant],
    }
  }

  const applyMaterialConsumption = (
    payload: ReturnType<typeof dataService.getAll>,
    order: ProductionOrder,
  ) => {
    const product = payload.produtos.find((item) => item.id === order.productId)
    const variant =
      product && product.hasVariants && product.unit !== 'metro_linear'
        ? product.variants?.find((item) => item.id === order.variantId)
        : undefined
    const usages =
      variant?.materialUsages && variant.materialUsages.length > 0
        ? variant.materialUsages
        : product?.materialUsages ?? []
    if (!product || usages.length === 0 || order.quantity <= 0) {
      return { applied: false, warnings: [] as string[] }
    }

    const warnings: string[] = []
    const consumptionRecords: MaterialConsumption[] = []
    const usageByMaterial = new Map<string, ProductMaterialUsage>()
    usages.forEach((usage) => {
      usageByMaterial.set(usage.materialId, usage)
    })
    const missingMaterials = usages.filter(
      (usage) => !payload.materiais.some((material) => material.id === usage.materialId),
    )
    if (missingMaterials.length > 0) {
      warnings.push('Ha materiais removidos na ficha de consumo.')
    }
    const unitFactor = getUnitFactor(product, variant, order.customLength)
    const safeFactor = Number.isFinite(unitFactor) && unitFactor > 0 ? unitFactor : 1

    payload.materiais = payload.materiais.map((material) => {
      const usage = usageByMaterial.get(material.id)
      if (!usage) {
        return material
      }
      const usageUnit =
        usage.usageUnit ??
        (usage.unitMode === 'metro' ? 'metro' : getDefaultUsageUnit(material.kind ?? 'outro'))
      const usageQuantity = Number.isFinite(usage.quantity) ? usage.quantity : 0
      const rawQuantity = usageQuantity * order.quantity * safeFactor
      const consumed = convertUsageToPurchaseQuantity(material, usageUnit, rawQuantity)
      if (usageUnit === 'metro' && material.kind === 'trelica' && !material.metersPerUnit) {
        warnings.push(`Trelica ${material.name} sem metros por unidade.`)
      }
      if (!Number.isFinite(consumed) || consumed <= 0) {
        return material
      }
      const currentStock = material.stock ?? 0
      const nextStock = currentStock - consumed
      if (nextStock < 0) {
        warnings.push(`Estoque negativo em ${material.name}.`)
      }
      consumptionRecords.push({
        id: createId(),
        productionOrderId: order.id,
        materialId: material.id,
        expected: consumed,
        actual: consumed,
      })
      return { ...material, stock: nextStock }
    })

    if (consumptionRecords.length > 0) {
      payload.consumosMateriais = [...payload.consumosMateriais, ...consumptionRecords]
      return { applied: true, warnings }
    }

    return { applied: false, warnings }
  }

  const handleStart = (order: ProductionOrder) => {
    if (order.status !== 'ABERTA') {
      return
    }
    updateProduction(
      {
        ...order,
        status: 'EM_ANDAMENTO',
        plannedAt: order.plannedAt ?? new Date().toISOString(),
      },
      {
        title: 'Producao iniciada',
        description: getOrderLabel(order),
      },
    )
    setStatus(`Ordem ${getProductionCode(order)} em andamento.`)
  }

  const handleFinish = (order: ProductionOrder) => {
    if (order.status !== 'EM_ANDAMENTO' && order.status !== 'PARCIAL') {
      return
    }
    const nextOrder: ProductionOrder = {
      ...order,
      status: 'CONCLUIDA',
      finishedAt: new Date().toISOString(),
    }
    const payload = dataService.getAll()
    const entries = payload.productionEntries.filter(
      (entry) => entry.productionOrderId === order.id,
    )
    let resolvedOrder = nextOrder
    let resolvedLength = 0
    let isLinear = false
    if (order.productId && order.quantity > 0) {
      const index = payload.produtos.findIndex((product) => product.id === order.productId)
      if (index >= 0) {
        const current = payload.produtos[index]
        if (current.unit === 'metro_linear') {
          isLinear = true
          resolvedLength =
            order.plannedLengthM ?? order.customLength ?? current.length ?? 0
          const stockIndex = findStockItemIndex(
            payload.stockItems,
            current.id,
            resolvedLength,
          )
          if (stockIndex >= 0) {
            const target = payload.stockItems[stockIndex]
            payload.stockItems[stockIndex] = {
              ...target,
              quantity: (target.quantity ?? 0) + order.quantity,
              updatedAt: new Date().toISOString(),
            }
          } else {
            payload.stockItems = [
              ...payload.stockItems,
              {
                id: createId(),
                productId: current.id,
                lengthM: resolvedLength,
                unit: 'un',
                quantity: order.quantity,
                createdAt: new Date().toISOString(),
              },
            ]
          }
        } else if (current.hasVariants) {
          const variants = current.variants ?? []
          const targetVariantId = order.variantId ?? variants[0]?.id
          const updatedVariants = variants.map((variant) =>
            variant.id === targetVariantId
              ? { ...variant, stock: (variant.stock ?? 0) + order.quantity }
              : variant,
          )
          payload.produtos[index] = {
            ...current,
            variants: updatedVariants,
          }
        } else {
          payload.produtos[index] = {
            ...current,
            stock: (current.stock ?? 0) + order.quantity,
          }
        }

        const alreadyTracked = payload.lotesProducao.some(
          (lot) => lot.productionOrderId === order.id,
        )
        if (!alreadyTracked) {
          const moldedAt = toDateInputValue(nextOrder.finishedAt)
          const demoldTimeDays = Number.isFinite(current.demoldTimeDays)
            ? current.demoldTimeDays ?? 0
            : 0
          const demoldedAt =
            demoldTimeDays > 0 ? addDaysToDate(moldedAt, demoldTimeDays) : undefined
          const lotStatus: ProductionLot['status'] =
            demoldTimeDays > 0 ? 'curando' : 'pronto'
          const shouldUseVariant =
            current.unit !== 'metro_linear' && (current.hasVariants ?? false)
          const fallbackVariantId = shouldUseVariant ? current.variants?.[0]?.id : undefined
          const lotVariantId = shouldUseVariant ? order.variantId ?? fallbackVariantId : undefined
          const lot: ProductionLot = {
            id: createId(),
            productId: order.productId,
            variantId: lotVariantId,
            productionOrderId: order.id,
            quantity: order.quantity,
            customLength:
              current.unit === 'metro_linear' ? order.customLength ?? current.length : undefined,
            status: lotStatus,
            moldedAt,
            demoldedAt,
            curingUntil: demoldedAt,
            createdAt: new Date().toISOString(),
          }
          payload.lotesProducao = [...payload.lotesProducao, lot]
        }
      }
    }
    if (entries.length === 0) {
      const plannedQty = order.plannedQty ?? order.quantity
      resolvedOrder = {
        ...resolvedOrder,
        producedQty: plannedQty,
        producedLengthM: isLinear ? plannedQty * resolvedLength : undefined,
      }
    }
    payload.ordensProducao = payload.ordensProducao.map((item) =>
      item.id === order.id ? resolvedOrder : item,
    )
    const consumptionResult = applyMaterialConsumption(payload, nextOrder)
    const linkedOrderId = order.linkedOrderId ?? order.orderId
    const linkedOrder = payload.pedidos.find((item) => item.id === linkedOrderId)
    const linkedClient = linkedOrder
      ? payload.clientes.find((client) => client.id === linkedOrder.clientId)
      : undefined
    const hasDelivery = payload.entregas.some(
      (delivery) => delivery.productionOrderId === order.id,
    )
    const linkedObra = linkedOrder?.obraId
      ? linkedClient?.obras?.find((obra) => obra.id === linkedOrder.obraId)
      : undefined
    if (linkedOrder && !hasDelivery) {
      const matchedItem = linkedOrder.items.find(
        (item) =>
          item.productId === order.productId &&
          (item.variantId ?? '') === (order.variantId ?? '') &&
          (item.customLength ?? 0) === (order.customLength ?? 0),
      )
      const deliveryItem = {
        productId: order.productId,
        variantId: order.variantId,
        customLength: order.customLength ?? matchedItem?.customLength,
        customWidth: matchedItem?.customWidth,
        customHeight: matchedItem?.customHeight,
        unitPrice: matchedItem?.unitPrice,
        quantity: order.quantity,
      }
      payload.entregas = [
        ...payload.entregas,
        {
          id: createId(),
          orderId: linkedOrder.id,
          productionOrderId: order.id,
          clientId: linkedOrder.clientId,
          obraId: linkedObra?.id,
          address: linkedObra?.address,
          status: 'pendente',
          items: [deliveryItem],
          createdAt: new Date().toISOString(),
          scheduledAt: new Date().toISOString().slice(0, 10),
        },
      ]
    }
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Producao finalizada',
        description: getOrderLabel(order),
      },
    })
    refresh()
    const warnings = consumptionResult.warnings.join(' ')
    const consumptionMessage = consumptionResult.applied
      ? 'Estoque de materia-prima atualizado.'
      : 'Sem consumo definido para este produto.'
    const warningSuffix = warnings ? ` ${warnings}` : ''
    setStatus(
      `Ordem ${getProductionCode(order)} concluida. ${consumptionMessage}${warningSuffix}`,
    )
  }

  const handleManualOrder = () => {
    if (availableProducts.length === 0) {
      setStatus('Cadastre produtos para criar ordens manuais.')
      return
    }
    setStatus(null)
    resetManualForm()
    setIsManualOpen(true)
  }

  useEffect(() => {
    if (pageIntent?.type !== 'new') {
      return
    }
    handleManualOrder()
    onConsumeIntent?.()
  }, [pageIntent, onConsumeIntent])

  useEffect(() => {
    if (!printGroupId || typeof window === 'undefined') {
      return
    }
    let cancelled = false
    const runPrint = async () => {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve())
        })
      })
      if (document.fonts?.ready) {
        await document.fonts.ready
      }
      if (!cancelled) {
        window.print()
      }
    }
    void runPrint()
    return () => {
      cancelled = true
    }
  }, [printGroupId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const handleAfterPrint = () => setPrintGroupId(null)
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  const handleManualSubmit = () => {
    if (!manualForm.productId) {
      setStatus('Selecione um produto.')
      return
    }
    const product = data.produtos.find((item) => item.id === manualForm.productId)
    if (product?.unit === 'metro_linear' && manualForm.customLength <= 0) {
      setStatus('Informe o comprimento em cm para o produto por metro linear.')
      return
    }
    if (manualForm.quantity <= 0) {
      setStatus('Informe uma quantidade valida.')
      return
    }
    const payload = dataService.getAll()
    const now = new Date().toISOString()
    const isLinear = product?.unit === 'metro_linear'
    const next: ProductionOrder = {
      id: createId(),
      orderId: `estoque_${createId()}`,
      productId: manualForm.productId,
      variantId: manualForm.variantId || undefined,
      quantity: manualForm.quantity,
      customLength: manualForm.customLength > 0 ? manualForm.customLength : undefined,
      plannedQty: manualForm.quantity,
      plannedLengthM: isLinear ? manualForm.customLength : undefined,
      status: 'ABERTA',
      createdAt: now,
      plannedAt: now,
      source: 'estoque',
    }
    payload.ordensProducao = [...payload.ordensProducao, next]
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Ordem manual criada',
        description: getOrderLabel(next),
      },
    })
    refresh()
    setStatus('Ordem de producao criada para estoque.')
    setIsManualOpen(false)
  }

  const company = data.empresa
  const companyName = company.name?.trim() || company.tradeName?.trim() || ''
  const companyDocument = company.document?.trim() || ''
  const companyAddressLine = [company.street, company.number, company.neighborhood]
    .filter(Boolean)
    .join(', ')
  const companyCityLine = [company.city, company.state, company.zip]
    .filter(Boolean)
    .join(' - ')
  const companyContactLine = [company.phone, company.email, company.website]
    .filter(Boolean)
    .join(' • ')
  const companyLines = [
    companyName,
    companyDocument,
    companyAddressLine,
    companyCityLine,
    companyContactLine,
  ].filter((value) => value && value.trim().length > 0)

  const orderToDelete = deleteId
    ? data.ordensProducao.find((order) => order.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    const target = payload.ordensProducao.find((order) => order.id === deleteId)
    if (target && target.status === 'CONCLUIDA') {
      const productIndex = payload.produtos.findIndex(
        (product) => product.id === target.productId,
      )
      if (productIndex >= 0) {
        const current = payload.produtos[productIndex]
        if (current.unit === 'metro_linear') {
          const length = target.customLength ?? current.length ?? 1
          const stockIndex = findStockItemIndex(payload.stockItems, current.id, length)
          if (stockIndex >= 0) {
            const stockItem = payload.stockItems[stockIndex]
            payload.stockItems[stockIndex] = {
              ...stockItem,
              quantity: (stockItem.quantity ?? 0) - target.quantity,
              updatedAt: new Date().toISOString(),
            }
          } else {
            payload.produtos[productIndex] = upsertLinearStockVariant(
              current,
              length,
              -target.quantity,
            )
          }
        } else if (current.hasVariants) {
          const variants = current.variants ?? []
          const targetVariantId = target.variantId ?? variants[0]?.id
          payload.produtos[productIndex] = {
            ...current,
            variants: variants.map((variant) =>
              variant.id === targetVariantId
                ? { ...variant, stock: (variant.stock ?? 0) - target.quantity }
                : variant,
            ),
          }
        } else {
          payload.produtos[productIndex] = {
            ...current,
            stock: (current.stock ?? 0) - target.quantity,
          }
        }
      }
      const consumptions = payload.consumosMateriais.filter(
        (item) => item.productionOrderId === target.id,
      )
      if (consumptions.length > 0) {
        payload.materiais = payload.materiais.map((material) => {
          const total = consumptions
            .filter((item) => item.materialId === material.id)
            .reduce((acc, item) => acc + (item.actual ?? item.expected), 0)
          if (total <= 0) {
            return material
          }
          return { ...material, stock: (material.stock ?? 0) + total }
        })
        payload.consumosMateriais = payload.consumosMateriais.filter(
          (item) => item.productionOrderId !== target.id,
        )
      }
    }
    if (target) {
      payload.lotesProducao = payload.lotesProducao.filter(
        (lot) => lot.productionOrderId !== target.id,
      )
    }
    payload.ordensProducao = payload.ordensProducao.filter((order) => order.id !== deleteId)
    payload.entregas = payload.entregas.filter(
      (delivery) => delivery.productionOrderId !== deleteId,
    )
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Ordem de producao excluida',
        description: target ? getOrderLabel(target) : undefined,
      },
    })
    refresh()
    setStatus('Ordem de producao excluida.')
    setDeleteId(null)
  }

  return (
    <Page className="producao">
      {printContext && (
        <div id="quote-print" className="quote-print">
          <section className="quote-print__copy">
            <header className="quote-print__header">
              <div className="quote-print__brand">
                <img className="quote-print__logo" src={logotipo} alt={companyName} />
                {companyLines.length > 0 && (
                  <div className="quote-print__company">
                    {companyLines.map((line, index) => {
                      const isNameLine = index === 0 && companyName && line === companyName
                      return isNameLine ? (
                        <strong key={`company-${index}`}>{line}</strong>
                      ) : (
                        <span key={`company-${index}`}>{line}</span>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="quote-print__meta">
                <span>Documento: Ordem de producao</span>
                <span>Emissao: {formatDateShort(printContext.plannedAt)}</span>
                {printContext.orderCode && (
                  <span>Pedido #{printContext.orderCode}</span>
                )}
                {!printContext.orderCode && <span>{printContext.group.title}</span>}
                <span className="quote-print__copy-tag">Chao de fabrica</span>
              </div>
            </header>

            <section className="quote-print__client">
              <div className="quote-print__client-block">
                <span>Cliente</span>
                <strong>{printContext.clientName}</strong>
                {printContext.clientDocument && (
                  <span>Documento: {printContext.clientDocument}</span>
                )}
                {printContext.clientContactLine && (
                  <span>{printContext.clientContactLine}</span>
                )}
              </div>
              <div className="quote-print__client-block">
                <span>Obra / Endereco</span>
                <strong>{printContext.obraName || '—'}</strong>
                <span>{printContext.clientAddressLine || '—'}</span>
              </div>
            </section>

            <table className="quote-print__table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Medidas</th>
                  <th>Qtd</th>
                  <th>Pronto</th>
                </tr>
              </thead>
              <tbody>
                {printItems.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      Nenhum item com linha de producao neste pedido.
                    </td>
                  </tr>
                ) : (
                  printItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.name}
                        <span className="quote-print__dimension">OP {item.opCode}</span>
                      </td>
                      <td>{item.sizeLabel || '-'}</td>
                      <td>{item.plannedQty}</td>
                      <td>
                        <span className="quote-print__checkbox" aria-hidden="true" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}
      <PageHeader
        actions={
          <button className="button button--ghost" type="button" onClick={handleManualOrder}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              playlist_add
            </span>
            <span className="page-header__action-label">Criar ordem manual</span>
          </button>
        }
      />

      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Total</span>
          <strong className="summary__value">{productionSummary.total}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Abertas</span>
          <strong className="summary__value">{productionSummary.open}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Em andamento</span>
          <strong className="summary__value">{productionSummary.active}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Concluidas</span>
          <strong className="summary__value">{productionSummary.done}</strong>
        </article>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Ordens recentes</h2>
            <p>Movimente as ordens para iniciar ou finalizar a producao.</p>
          </div>
          <span className="panel__meta">{productionOrders.length} registros</span>
        </div>
        <div className="list">
          {productionOrders.length === 0 && (
            <div className="list__empty">
              Nenhuma ordem criada. Marque pedidos como pagos para gerar producao.
            </div>
          )}
          {productionGroups.map((group) => (
            <div key={group.id} className="list__group">
              <div className="list__item list__item--group">
                <div>
                  <strong>{group.title}</strong>
                  {group.meta && <span className="list__meta">{group.meta}</span>}
                  <span className="list__meta">Itens: {group.orders.length}</span>
                </div>
                <div className="list__actions">
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => setPrintGroupId(group.id)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      print
                    </span>
                    <span>Imprimir OP</span>
                  </button>
                </div>
              </div>
              {group.orders.map((order) => {
                const orderLinkId = order.linkedOrderId ?? order.orderId
                const pedido = getOrder(orderLinkId)
                const item = pedido?.items[0]
                const productId = item?.productId ?? order.productId
                const product = productId
                  ? data.produtos.find((entry) => entry.id === productId)
                  : undefined
                const variant =
                  product && product.unit !== 'metro_linear' && product.hasVariants
                    ? getVariant(productId, item?.variantId ?? order.variantId)
                    : undefined
                const length =
                  order.customLength ??
                  item?.customLength ??
                  (product?.unit === 'metro_linear' ? product.length : undefined)
                const sizeLabel = product?.unit === 'metro_linear'
                  ? buildDimensionLabel([length ?? 0])
                  : buildDimensionLabel([
                      variant?.length ?? product?.length ?? 0,
                      variant?.width ?? product?.width ?? 0,
                      variant?.height ?? product?.height ?? 0,
                    ])
                const sourceLabel =
                  order.source === 'estoque'
                    ? 'Estoque interno'
                    : pedido
                      ? `Cliente: ${getClientName(pedido.clientId)}`
                      : 'Pedido'
                const originProduction = order.originProductionOrderId
                  ? data.ordensProducao.find(
                      (entry) => entry.id === order.originProductionOrderId,
                    )
                  : null
                const originLabel = originProduction
                  ? `Retrabalho de OP #${getProductionCode(originProduction)}`
                  : ''
                const statusKey = order.status.toLowerCase()
                const plannedQty = Number.isFinite(order.plannedQty)
                  ? order.plannedQty ?? 0
                  : order.quantity
                const producedQty = Number.isFinite(order.producedQty)
                  ? order.producedQty ?? 0
                  : 0
                const isLinear = product?.unit === 'metro_linear'
                const plannedLength = isLinear
                  ? Number.isFinite(order.plannedLengthM)
                    ? order.plannedLengthM ?? 0
                    : Number.isFinite(length)
                      ? length ?? 0
                      : 0
                  : 0
                const remainingQty = Math.max(0, plannedQty - producedQty)
                const entries = productionEntriesByOrder.get(order.id) ?? []
                const entryHistory = entries.slice(0, 3)
                return (
                  <div key={order.id} className="list__item">
                    <div>
                      <strong>Ordem #{getProductionCode(order)}</strong>
                      <span className="list__meta">{sourceLabel}</span>
                      {originLabel && <span className="list__meta">{originLabel}</span>}
                      <span className="list__meta">
                        {productId ? getProductName(productId) : 'Produto'}
                        {variant ? ` • ${variant.name}` : ''}
                        {sizeLabel ? ` • ${sizeLabel}` : ''}
                        {' • '}
                        {plannedQty} un
                      </span>
                      <span className="list__meta">
                        <span className={`badge badge--${statusKey}`}>
                          {statusLabels[order.status]}
                        </span>
                        {' · '}
                        <span>Inicio: {formatDateShort(order.plannedAt ?? '')}</span>
                        {' · '}
                        <span>Fim: {formatDateShort(order.finishedAt ?? '')}</span>
                      </span>
                      <span className="list__meta">
                        Planejado: {plannedQty} un · Produzido: {producedQty} un ·
                        Faltam: {remainingQty} un
                      </span>
                      {entryHistory.map((entry) => {
                        const entryLength = isLinear
                          ? Number.isFinite(entry.lengthM)
                            ? entry.lengthM ?? plannedLength
                            : plannedLength
                          : 0
                        const entryTotal = isLinear ? entry.quantity * entryLength : 0
                        const scrapLabel =
                          entry.scrapQuantity && entry.scrapQuantity > 0
                            ? ` · Refugo ${entry.scrapQuantity} un`
                            : ''
                        return (
                          <span key={entry.id} className="list__meta">
                            {formatDateShort(entry.date)} · {entry.quantity} un
                            {isLinear ? ` (${formatMeasurement(entryTotal)} m)` : ''}
                            {' · '}
                            {getEmployeeName(entry.employeeId)}
                            {scrapLabel}
                          </span>
                        )
                      })}
                      {entries.length > entryHistory.length && (
                        <span className="list__meta">
                          +{entries.length - entryHistory.length} apontamento(s)
                        </span>
                      )}
                    </div>
                    <div className="list__actions">
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => handleStart(order)}
                        disabled={order.status !== 'ABERTA'}
                      >
                        Iniciar
                      </button>
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => openEntryModal(order)}
                        disabled={
                          order.status === 'CONCLUIDA' || order.status === 'CANCELADA'
                        }
                      >
                        Apontar
                      </button>
                      <button
                        className="button button--primary"
                        type="button"
                        onClick={() => handleFinish(order)}
                        disabled={
                          order.status !== 'EM_ANDAMENTO' &&
                          order.status !== 'PARCIAL'
                        }
                      >
                        Concluir
                      </button>
                      <button
                        className="button button--danger"
                        type="button"
                        onClick={() => setDeleteId(order.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </section>
      <Modal
        open={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        title="Nova ordem para estoque"
        size="lg"
        actions={
          <button className="button button--primary" type="button" onClick={handleManualSubmit}>
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              save
            </span>
            <span className="modal__action-label">Criar ordem</span>
          </button>
        }
      >
        <div className="modal__form">
          <div className="modal__group">
            <label className="modal__label" htmlFor="manual-product">
              Produto
            </label>
            <select
              id="manual-product"
              className="modal__input"
              value={manualForm.productId}
              onChange={(event) => handleManualProductChange(event.target.value)}
            >
              <option value="">Selecionar produto</option>
              {availableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div className="modal__row">
            {manualIsLinear ? (
              <div className="modal__group">
                <label className="modal__label" htmlFor="manual-length">
                  Comprimento
                </label>
                <DimensionInput
                  id="manual-length"
                  className="modal__input"
                  min="0"
                  step={0.01}
                  value={manualForm.customLength}
                  onValueChange={(value) =>
                    setManualForm((prev) => ({
                      ...prev,
                      customLength: value,
                    }))
                  }
                  disabled={!manualForm.productId}
                />
              </div>
            ) : manualHasVariants ? (
              <div className="modal__group">
                <label className="modal__label" htmlFor="manual-variant">
                  Variacao
                </label>
                <select
                  id="manual-variant"
                  className="modal__input"
                  value={manualForm.variantId}
                  onChange={(event) => handleManualVariantChange(event.target.value)}
                  disabled={!manualForm.productId}
                >
                  <option value="">Selecionar variacao</option>
                  {data.produtos
                    .find((product) => product.id === manualForm.productId)
                    ?.variants?.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name}
                      </option>
                    )) ?? null}
                </select>
              </div>
            ) : (
              <div className="modal__group">
                <label className="modal__label">Variacao</label>
                <input
                  className="modal__input"
                  type="text"
                  value="Produto sem variacoes"
                  disabled
                />
              </div>
            )}
            <div className="modal__group">
              <label className="modal__label" htmlFor="manual-quantity">
                Quantidade
              </label>
              <input
                id="manual-quantity"
                className="modal__input"
                type="number"
                min="0"
                step="1"
                value={manualForm.quantity}
                onChange={(event) =>
                  setManualForm((prev) => ({
                    ...prev,
                    quantity: Number(event.target.value),
                  }))
                }
              />
            </div>
          </div>
        </div>
      </Modal>
      <Modal
        open={isEntryOpen}
        onClose={() => setIsEntryOpen(false)}
        title="Novo apontamento"
        size="lg"
        actions={
          <button className="button button--primary" type="submit" form={entryFormId}>
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              save
            </span>
            <span className="modal__action-label">Registrar apontamento</span>
          </button>
        }
      >
        <form id={entryFormId} className="modal__form" onSubmit={handleEntrySubmit}>
          <div className="modal__group">
            <label className="modal__label">Ordem</label>
            <input
              className="modal__input"
              type="text"
              value={entryOrderCode}
              disabled
            />
          </div>
          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="entry-employee">
                Responsavel
              </label>
              <select
                id="entry-employee"
                className="modal__input"
                value={entryForm.employeeId}
                onChange={(event) => updateEntryForm({ employeeId: event.target.value })}
              >
                <option value="">Selecionar funcionario</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="entry-date">
                Data
              </label>
              <input
                id="entry-date"
                className="modal__input"
                type="date"
                value={entryForm.date}
                onChange={(event) => updateEntryForm({ date: event.target.value })}
              />
            </div>
          </div>
          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="entry-quantity">
                Quantidade
              </label>
              <input
                id="entry-quantity"
                className="modal__input"
                type="number"
                min="0"
                step="1"
                value={entryForm.quantity}
                onChange={(event) =>
                  updateEntryForm({ quantity: Number(event.target.value) })
                }
              />
            </div>
            {entryIsLinear && (
              <div className="modal__group">
                <label className="modal__label" htmlFor="entry-length">
                  Comprimento (m)
                </label>
                <DimensionInput
                  id="entry-length"
                  className="modal__input"
                  min="0"
                  step={0.01}
                  value={entryForm.lengthM}
                  onValueChange={(value) => updateEntryForm({ lengthM: value })}
                />
              </div>
            )}
          </div>
          {entryIsLinear && (
            <div className="modal__group">
              <label className="modal__label">Total (m)</label>
              <input
                className="modal__input"
                type="text"
                value={formatMeasurement(entryTotalLength)}
                disabled
              />
            </div>
          )}
          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="entry-scrap">
                Refugo (un)
              </label>
              <input
                id="entry-scrap"
                className="modal__input"
                type="number"
                min="0"
                step="1"
                value={entryForm.scrapQuantity}
                onChange={(event) =>
                  updateEntryForm({ scrapQuantity: Number(event.target.value) })
                }
              />
            </div>
            {entryIsLinear && (
              <div className="modal__group">
                <label className="modal__label" htmlFor="entry-scrap-length">
                  Refugo (m)
                </label>
                <DimensionInput
                  id="entry-scrap-length"
                  className="modal__input"
                  min="0"
                  step={0.01}
                  value={entryForm.scrapLengthM}
                  onValueChange={(value) => updateEntryForm({ scrapLengthM: value })}
                />
              </div>
            )}
          </div>
          <div className="modal__group">
            <label className="modal__label" htmlFor="entry-notes">
              Observacoes
            </label>
            <textarea
              id="entry-notes"
              className="modal__input modal__textarea"
              value={entryForm.notes}
              onChange={(event) => updateEntryForm({ notes: event.target.value })}
            />
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteId}
        title="Excluir ordem de producao?"
        description={
          orderToDelete
            ? `A ordem #${getProductionCode(orderToDelete)} sera removida.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </Page>
  )
}

export default Producao
