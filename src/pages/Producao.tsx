import { useMemo, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'
import type { MaterialConsumption, ProductionOrder, ProductMaterialUsage } from '../types/erp'
import { formatDateShort } from '../utils/format'
import { createId } from '../utils/ids'
import { getUnitFactor } from '../utils/pricing'
import { convertUsageToPurchaseQuantity, getDefaultUsageUnit } from '../utils/materialUsage'

const statusLabels: Record<ProductionOrder['status'], string> = {
  aberta: 'Aberta',
  em_producao: 'Em producao',
  finalizada: 'Finalizada',
}

const toMeters = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value / 100) : 0

const toCentimeters = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value * 100) : 0

const Producao = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [isManualOpen, setIsManualOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [manualForm, setManualForm] = useState({
    productId: '',
    variantId: '',
    quantity: 1,
    customLength: 0,
  })

  const productionOrders = useMemo(
    () =>
      [...data.ordensProducao].sort((a, b) =>
        (b.plannedAt ?? '').localeCompare(a.plannedAt ?? ''),
      ),
    [data.ordensProducao],
  )
  const productionSummary = useMemo(() => {
    return productionOrders.reduce(
      (acc, order) => {
        acc.total += 1
        if (order.status === 'aberta') {
          acc.open += 1
        }
        if (order.status === 'em_producao') {
          acc.active += 1
        }
        if (order.status === 'finalizada') {
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

  const availableProducts = data.produtos.filter((product) => product.active !== false)
  const manualProduct = data.produtos.find((product) => product.id === manualForm.productId)
  const manualIsLinear = manualProduct?.unit === 'metro_linear'
  const manualHasVariants = manualProduct?.hasVariants ?? false

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
    if (order.status !== 'aberta') {
      return
    }
    updateProduction(
      {
        ...order,
        status: 'em_producao',
        plannedAt: order.plannedAt ?? new Date().toISOString(),
      },
      {
        title: 'Producao iniciada',
        description: getOrderLabel(order),
      },
    )
    setStatus(`Ordem ${order.id.slice(0, 6)} em producao.`)
  }

  const handleFinish = (order: ProductionOrder) => {
    if (order.status !== 'em_producao') {
      return
    }
    const nextOrder: ProductionOrder = {
      ...order,
      status: 'finalizada',
      finishedAt: new Date().toISOString(),
    }
    const payload = dataService.getAll()
    payload.ordensProducao = payload.ordensProducao.map((item) =>
      item.id === order.id ? nextOrder : item,
    )
    if (order.productId && order.quantity > 0) {
      const index = payload.produtos.findIndex((product) => product.id === order.productId)
      if (index >= 0) {
        const current = payload.produtos[index]
        if (current.unit === 'metro_linear') {
          const length = order.customLength ?? current.length ?? 1
          payload.produtos[index] = upsertLinearStockVariant(current, length, order.quantity)
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
      }
    }
    const consumptionResult = applyMaterialConsumption(payload, nextOrder)
    const linkedOrder = payload.pedidos.find((item) => item.id === order.orderId)
    const linkedClient = linkedOrder
      ? payload.clientes.find((client) => client.id === linkedOrder.clientId)
      : undefined
    const linkedObra = linkedOrder?.obraId
      ? linkedClient?.obras?.find((obra) => obra.id === linkedOrder.obraId)
      : undefined
    const hasDelivery = payload.entregas.some(
      (delivery) => delivery.productionOrderId === order.id,
    )
    if (linkedOrder && linkedObra && !hasDelivery) {
      payload.entregas = [
        ...payload.entregas,
        {
          id: createId(),
          orderId: linkedOrder.id,
          productionOrderId: order.id,
          clientId: linkedOrder.clientId,
          obraId: linkedObra.id,
          address: linkedObra.address,
          status: 'pendente',
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
    setStatus(`Ordem ${order.id.slice(0, 6)} finalizada. ${consumptionMessage}${warningSuffix}`)
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
    const next: ProductionOrder = {
      id: createId(),
      orderId: `estoque_${createId()}`,
      productId: manualForm.productId,
      variantId: manualForm.variantId || undefined,
      quantity: manualForm.quantity,
      customLength: manualForm.customLength > 0 ? manualForm.customLength : undefined,
      status: 'aberta',
      plannedAt: new Date().toISOString(),
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

  const orderToDelete = deleteId
    ? data.ordensProducao.find((order) => order.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    const target = payload.ordensProducao.find((order) => order.id === deleteId)
    if (target && target.status === 'finalizada') {
      const productIndex = payload.produtos.findIndex(
        (product) => product.id === target.productId,
      )
      if (productIndex >= 0) {
        const current = payload.produtos[productIndex]
        if (current.unit === 'metro_linear') {
          const length = target.customLength ?? current.length ?? 1
          payload.produtos[productIndex] = upsertLinearStockVariant(
            current,
            length,
            -target.quantity,
          )
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
    <section className="producao">
      <header className="producao__header">
        <div className="producao__headline">
          <span className="producao__eyebrow">Operacao</span>
          <h1 className="producao__title">Producao</h1>
          <p className="producao__subtitle">
            Ordens sao criadas automaticamente quando um pedido e marcado como pago.
          </p>
        </div>
        <div className="producao__actions">
          <button className="button button--ghost" type="button" onClick={handleManualOrder}>
            Criar ordem manual
          </button>
        </div>
      </header>

      {status && <p className="producao__status">{status}</p>}

      <div className="producao__summary summary-card">
        <article className="producao__stat">
          <span className="producao__stat-label">Total</span>
          <strong className="producao__stat-value">{productionSummary.total}</strong>
        </article>
        <article className="producao__stat">
          <span className="producao__stat-label">Abertas</span>
          <strong className="producao__stat-value">{productionSummary.open}</strong>
        </article>
        <article className="producao__stat">
          <span className="producao__stat-label">Em producao</span>
          <strong className="producao__stat-value">{productionSummary.active}</strong>
        </article>
        <article className="producao__stat">
          <span className="producao__stat-label">Finalizadas</span>
          <strong className="producao__stat-value">{productionSummary.done}</strong>
        </article>
      </div>

      <div className="producao__layout">
        <section className="producao__panel">
          <div className="producao__panel-header">
            <div>
              <h2>Ordens recentes</h2>
              <p>Movimente as ordens para iniciar ou finalizar a producao.</p>
            </div>
            <span className="producao__panel-meta">{productionOrders.length} registros</span>
          </div>
          <div className="producao__list">
            {productionOrders.length === 0 && (
              <div className="producao__empty">
                Nenhuma ordem criada. Marque pedidos como pagos para gerar producao.
              </div>
            )}
            {productionOrders.map((order) => {
              const pedido = getOrder(order.orderId)
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
              const lengthLabel =
                product?.unit === 'metro_linear' && length
                  ? `${toCentimeters(length).toFixed(0)} cm`
                  : ''
              const sourceLabel =
                order.source === 'estoque'
                  ? 'Estoque interno'
                  : pedido
                    ? getClientName(pedido.clientId)
                    : 'Pedido'
              return (
                <div key={order.id} className="producao__card">
                  <div className="producao__info">
                    <strong>Ordem #{order.id.slice(0, 6)}</strong>
                    <span>{sourceLabel}</span>
                    <span>
                      {productId ? getProductName(productId) : 'Produto'}
                      {variant ? ` • ${variant.name}` : ''}
                      {lengthLabel ? ` • ${lengthLabel}` : ''}
                      {' • '}
                      {order.quantity}
                    </span>
                  </div>
                  <div className="producao__meta">
                    <span className={`badge badge--${order.status}`}>
                      {statusLabels[order.status]}
                    </span>
                    <span>Inicio: {formatDateShort(order.plannedAt ?? '')}</span>
                    <span>Fim: {formatDateShort(order.finishedAt ?? '')}</span>
                  </div>
                  <div className="producao__actions">
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => handleStart(order)}
                      disabled={order.status !== 'aberta'}
                    >
                      Iniciar
                    </button>
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={() => handleFinish(order)}
                      disabled={order.status !== 'em_producao'}
                    >
                      Finalizar
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
        </section>
      </div>
      <Modal
        open={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        title="Nova ordem para estoque"
        size="lg"
      >
        <div className="form">
          <div className="form__group">
            <label className="form__label" htmlFor="manual-product">
              Produto
            </label>
            <select
              id="manual-product"
              className="form__input"
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
          <div className="form__row">
            {manualIsLinear ? (
              <div className="form__group">
                <label className="form__label" htmlFor="manual-length">
                  Comprimento (cm)
                </label>
                <input
                  id="manual-length"
                  className="form__input"
                  type="number"
                  min="0"
                  step="1"
                  value={toCentimeters(manualForm.customLength)}
                  onChange={(event) =>
                    setManualForm((prev) => ({
                      ...prev,
                      customLength: toMeters(Number(event.target.value)),
                    }))
                  }
                  disabled={!manualForm.productId}
                />
              </div>
            ) : manualHasVariants ? (
              <div className="form__group">
                <label className="form__label" htmlFor="manual-variant">
                  Variacao
                </label>
                <select
                  id="manual-variant"
                  className="form__input"
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
              <div className="form__group">
                <label className="form__label">Variacao</label>
                <input
                  className="form__input"
                  type="text"
                  value="Produto sem variacoes"
                  disabled
                />
              </div>
            )}
            <div className="form__group">
              <label className="form__label" htmlFor="manual-quantity">
                Quantidade
              </label>
              <input
                id="manual-quantity"
                className="form__input"
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
          <div className="form__actions">
            <button className="button button--primary" type="button" onClick={handleManualSubmit}>
              Criar ordem
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => setIsManualOpen(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={!!deleteId}
        title="Excluir ordem de producao?"
        description={
          orderToDelete
            ? `A ordem #${orderToDelete.id.slice(0, 6)} sera removida.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </section>
  )
}

export default Producao
