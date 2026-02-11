import type { Delivery, ERPData, ProductionLot, ProductionOrder } from '../types/erp'
import type {
  TrackingItem,
  TrackingOrderPayload,
  TrackingOrderSummary,
  TrackingStage,
  TrackingSummaryStage,
} from '../types/tracking'
import { buildItemKey, formatItemLabel, type ItemKeyInput } from '../utils/tracking'

type AggregatedItem = ItemKeyInput & {
  key: string
  productionKey: string
  quantity: number
  label: string
}

type DeliveryTotals = {
  delivered: number
  inRoute: number
}

const resolveProductionStage = (
  productions: ProductionOrder[],
  lotsByProduction: Map<string, ProductionLot[]>,
): TrackingStage => {
  if (productions.length === 0) {
    return 'aguardando_producao'
  }
  const hasStarted = productions.some(
    (production) => production.status === 'em_producao' || production.status === 'finalizada',
  )
  if (!hasStarted) {
    return 'aguardando_producao'
  }
  const lots = productions.flatMap(
    (production) => lotsByProduction.get(production.id) ?? [],
  )
  if (lots.some((lot) => lot.status === 'curando')) {
    return 'cura'
  }
  if (lots.some((lot) => lot.status === 'produzindo' || lot.status === 'aguardando')) {
    return 'moldagem'
  }
  if (lots.some((lot) => lot.status === 'pronto')) {
    return 'aguardando_envio'
  }
  if (productions.every((production) => production.status === 'finalizada')) {
    return 'aguardando_envio'
  }
  return 'moldagem'
}

const summarizeStage = (items: TrackingItem[]): TrackingSummaryStage => {
  if (items.length === 0) {
    return 'aguardando_producao'
  }
  const allDelivered = items.every((item) => item.stage === 'entregue')
  if (allDelivered) {
    return 'entregue'
  }
  if (items.some((item) => item.stage === 'em_rota')) {
    return 'em_rota'
  }
  if (items.some((item) => item.stage === 'aguardando_envio')) {
    return 'aguardando_envio'
  }
  if (items.some((item) => item.stage === 'moldagem' || item.stage === 'cura')) {
    return 'em_producao'
  }
  return 'aguardando_producao'
}

const buildDeliveryTotals = (deliveries: Delivery[]) => {
  const totals = new Map<string, DeliveryTotals>()
  deliveries.forEach((delivery) => {
    const items = Array.isArray(delivery.items) ? delivery.items : []
    items.forEach((item) => {
      const quantity = Number.isFinite(item.quantity) ? item.quantity : 0
      if (quantity <= 0) {
        return
      }
      const key = buildItemKey(item)
      const current = totals.get(key) ?? { delivered: 0, inRoute: 0 }
      if (delivery.status === 'entregue') {
        current.delivered += quantity
      } else if (delivery.status === 'em_rota') {
        current.inRoute += quantity
      }
      totals.set(key, current)
    })
  })
  return totals
}

const mergeOrderItems = (data: ERPData, orderId: string): AggregatedItem[] => {
  const order = data.pedidos.find((entry) => entry.id === orderId)
  if (!order) {
    return []
  }
  const productById = new Map(data.produtos.map((product) => [product.id, product]))
  const items = new Map<string, AggregatedItem>()
  order.items.forEach((item) => {
    const key = buildItemKey(item)
    const productionKey = buildItemKey({
      productId: item.productId,
      variantId: item.variantId,
      customLength: item.customLength,
      unitPrice: undefined,
    })
    const existing = items.get(key)
    if (existing) {
      existing.quantity += item.quantity
      items.set(key, existing)
      return
    }
    items.set(key, {
      productId: item.productId,
      variantId: item.variantId,
      customLength: item.customLength,
      customWidth: item.customWidth,
      customHeight: item.customHeight,
      unitPrice: item.unitPrice,
      key,
      productionKey,
      quantity: item.quantity,
    })
  })
  return Array.from(items.values()).map((item) => {
    const product = productById.get(item.productId)
    const variantName =
      product?.variants?.find((variant) => variant.id === item.variantId)?.name
    return {
      ...item,
      label: formatItemLabel(product?.name, variantName, item),
    }
  })
}

const buildSummary = (items: TrackingItem[]): TrackingOrderSummary => {
  const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0)
  const deliveredQuantity = items.reduce(
    (acc, item) => acc + Math.min(item.deliveredQuantity, item.quantity),
    0,
  )
  return {
    stage: summarizeStage(items),
    isPartial: items.some((item) => item.isPartial),
    deliveredQuantity,
    totalQuantity,
  }
}

export const buildTrackingPayloads = (data: ERPData): TrackingOrderPayload[] => {
  const deliveriesByOrder = new Map<string, Delivery[]>()
  data.entregas.forEach((delivery) => {
    const current = deliveriesByOrder.get(delivery.orderId) ?? []
    current.push(delivery)
    deliveriesByOrder.set(delivery.orderId, current)
  })

  const productionsByOrder = new Map<string, ProductionOrder[]>()
  data.ordensProducao.forEach((production) => {
    const current = productionsByOrder.get(production.orderId) ?? []
    current.push(production)
    productionsByOrder.set(production.orderId, current)
  })

  const lotsByProduction = new Map<string, ProductionLot[]>()
  data.lotesProducao.forEach((lot) => {
    if (!lot.productionOrderId) {
      return
    }
    const current = lotsByProduction.get(lot.productionOrderId) ?? []
    current.push(lot)
    lotsByProduction.set(lot.productionOrderId, current)
  })

  const clientById = new Map(data.clientes.map((client) => [client.id, client]))

  return data.pedidos.map((order) => {
    const mergedItems = mergeOrderItems(data, order.id)
    const deliveries = deliveriesByOrder.get(order.id) ?? []
    const deliveryTotalsByKey = buildDeliveryTotals(deliveries)
    const productions = productionsByOrder.get(order.id) ?? []
    const productionsByKey = new Map<string, ProductionOrder[]>()
    productions.forEach((production) => {
      const key = buildItemKey({ ...production, unitPrice: undefined })
      const current = productionsByKey.get(key) ?? []
      current.push(production)
      productionsByKey.set(key, current)
    })

    const items: TrackingItem[] = mergedItems.map((item) => {
      const totals =
        deliveryTotalsByKey.get(item.key) ??
        deliveryTotalsByKey.get(item.productionKey) ??
        { delivered: 0, inRoute: 0 }
      const deliveredQuantity = totals.delivered
      const inRouteQuantity = totals.inRoute
      const isPartial = deliveredQuantity > 0 && deliveredQuantity < item.quantity

      let stage: TrackingStage
      if (deliveredQuantity >= item.quantity && item.quantity > 0) {
        stage = 'entregue'
      } else if (inRouteQuantity > 0) {
        stage = 'em_rota'
      } else if (deliveredQuantity > 0) {
        stage = 'aguardando_envio'
      } else if ((order.fulfillment ?? 'producao') === 'estoque') {
        stage = 'aguardando_envio'
      } else {
        const itemProductions = productionsByKey.get(item.productionKey) ?? []
        stage = resolveProductionStage(itemProductions, lotsByProduction)
      }

      return {
        key: item.key,
        productId: item.productId,
        label: item.label,
        quantity: item.quantity,
        deliveredQuantity,
        stage,
        isPartial,
      }
    })

    const summary = buildSummary(items)
    return {
      orderId: order.id,
      clientName: clientById.get(order.clientId)?.name,
      createdAt: order.createdAt,
      fulfillment: order.fulfillment ?? 'producao',
      items,
      summary,
    }
  })
}
