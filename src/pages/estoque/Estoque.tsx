import { useMemo, useState, type FormEvent } from 'react'
import DimensionInput from '../../components/DimensionInput'
import Modal from '../../components/Modal'
import { Page, PageHeader } from '../../components/ui'
import QuickNotice from '../../components/QuickNotice'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { ProductStockAdjustmentType } from '../../types/erp'
import { formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'
import { adjustProductStock } from '../../utils/stock'
import { findStockItem, findStockItemIndex } from '../../utils/stockItems'

type StockAdjustForm = {
  productId: string
  variantId: string
  lengthM: number
  type: ProductStockAdjustmentType
  quantity: number
  producedAt: string
  lotId: string
  notes: string
}

type StockRow = {
  productId: string
  productName: string
  variantId: string
  variantName: string
  variantLocked: boolean
  stock: number
  lengthM?: number
  totalLengthM?: number
  source: 'stock_item' | 'variant' | 'product'
}

const Estoque = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [form, setForm] = useState<StockAdjustForm>({
    productId: '',
    variantId: '',
    lengthM: 0,
    type: 'entrada',
    quantity: 0,
    producedAt: '',
    lotId: '',
    notes: '',
  })
  const adjustFormId = 'ajuste-estoque-produtos'

  const products = useMemo(
    () => [...data.produtos].filter((item) => item.active !== false),
    [data.produtos],
  )

  const stockRows = useMemo<StockRow[]>(() => {
    const rows: StockRow[] = []
    const stockItemsByProduct = new Map<string, (typeof data.stockItems)[number][]>()
    data.stockItems.forEach((item) => {
      const current = stockItemsByProduct.get(item.productId) ?? []
      current.push(item)
      stockItemsByProduct.set(item.productId, current)
    })
    data.produtos.forEach((product) => {
      const isLinear = product.unit === 'metro_linear'
      const productStockItems = stockItemsByProduct.get(product.id) ?? []
      if (isLinear && productStockItems.length > 0) {
        productStockItems.forEach((item) => {
          const lengthM = Number.isFinite(item.lengthM) ? item.lengthM ?? 0 : 0
          const totalLengthM = lengthM > 0 ? (item.quantity ?? 0) * lengthM : undefined
          rows.push({
            productId: product.id,
            productName: product.name,
            variantId: item.id,
            variantName: lengthM > 0 ? `${lengthM.toFixed(2)} m` : '',
            variantLocked: true,
            stock: item.quantity ?? 0,
            lengthM: lengthM > 0 ? lengthM : undefined,
            totalLengthM,
            source: 'stock_item',
          })
        })
        return
      }

      const variants = product.variants ?? []
      const entries = variants.map((variant) => ({
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        variantName: variant.name,
        variantLocked: variant.locked ?? false,
        stock: variant.stock ?? 0,
        lengthM: Number.isFinite(variant.length) ? variant.length : undefined,
        totalLengthM:
          isLinear && Number.isFinite(variant.length)
            ? (variant.stock ?? 0) * (variant.length ?? 0)
            : undefined,
        source: 'variant' as const,
      }))
      const hasLinearVariants = isLinear && variants.length > 0
      if (product.hasVariants || hasLinearVariants) {
        rows.push(...entries)
        return
      }
      const baseLength =
        isLinear && Number.isFinite(product.length) ? product.length ?? 0 : undefined
      rows.push({
        productId: product.id,
        productName: product.name,
        variantId: `${product.id}-base`,
        variantName: '',
        variantLocked: false,
        stock: product.stock ?? 0,
        lengthM: baseLength,
        totalLengthM:
          baseLength && baseLength > 0 ? (product.stock ?? 0) * baseLength : undefined,
        source: 'product',
      })
    })
    return rows
  }, [data.produtos, data.stockItems])

  const totalSkus = stockRows.length
  const totalStock = stockRows.reduce((acc, item) => acc + item.stock, 0)
  const outOfStock = stockRows.filter((item) => item.stock <= 0)
  const lowStock = stockRows.filter((item) => item.stock > 0 && item.stock <= 5)

  const criticalItems = useMemo(() => {
    const list = [
      ...outOfStock.map((item) => ({ ...item, status: 'Sem estoque' })),
      ...lowStock.map((item) => ({ ...item, status: 'Baixo' })),
    ]
    return list.slice(0, 6)
  }, [lowStock, outOfStock])

  const topStock = useMemo(
    () => [...stockRows].sort((a, b) => b.stock - a.stock).slice(0, 6),
    [stockRows],
  )

  const formatMeasurement = (value: number) =>
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
  const getLabel = (item: StockRow) => {
    if (item.lengthM && item.lengthM > 0) {
      return `${item.productName} (${formatMeasurement(item.lengthM)} m)`
    }
    if (item.variantName) {
      return item.variantLocked
        ? `${item.productName} ${item.variantName}`
        : `${item.productName} • ${item.variantName}`
    }
    return item.productName
  }
  const getStockValue = (item: StockRow) => {
    if (item.totalLengthM && item.totalLengthM > 0) {
      return `${item.stock} un · ${formatMeasurement(item.totalLengthM)} m`
    }
    return `${item.stock}`
  }

  const selectedProduct = useMemo(
    () => data.produtos.find((product) => product.id === form.productId) ?? null,
    [data.produtos, form.productId],
  )

  const supportsVariantSelection = (product?: typeof data.produtos[number] | null) => {
    if (!product) {
      return false
    }
    if (product.unit === 'metro_linear') {
      return false
    }
    return product.hasVariants ?? false
  }

  const lotOptions = useMemo(() => {
    const lots = [...data.lotesProducao].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )
    if (!selectedProduct) {
      return lots
    }
    return lots.filter((lot) => lot.productId === selectedProduct.id)
  }, [data.lotesProducao, selectedProduct])

  const losses = useMemo(
    () =>
      [...data.refugosProducao]
        .filter((scrap) => scrap.type === 'refugo')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6),
    [data.refugosProducao],
  )

  const adjustments = useMemo(
    () =>
      [...data.ajustesEstoqueProdutos]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6),
    [data.ajustesEstoqueProdutos],
  )

  const getProductLabel = (productId: string, variantId?: string) => {
    const product = data.produtos.find((item) => item.id === productId)
    if (!product) {
      return 'Produto'
    }
    if (variantId) {
      const variant = product.variants?.find((item) => item.id === variantId)
      if (variant?.name) {
        return `${product.name} • ${variant.name}`
      }
    }
    return product.name
  }

  const getOrderLabel = (orderId?: string) => {
    if (!orderId) {
      return 'Perda avulsa'
    }
    const production = data.ordensProducao.find((order) => order.id === orderId)
    const code = production?.code?.trim() || orderId.slice(-5)
    return `OP #${code}`
  }
  const getLotCode = (lotId?: string) => {
    if (!lotId) {
      return '-'
    }
    const lot = data.lotesProducao.find((entry) => entry.id === lotId)
    return lot?.code?.trim() || lotId.slice(-5)
  }

  const updateForm = (patch: Partial<StockAdjustForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const openAdjust = () => {
    const firstProduct = products[0]
    const firstVariant = firstProduct?.variants?.[0]
    const lengthM =
      firstProduct?.unit === 'metro_linear' && Number.isFinite(firstProduct.length)
        ? firstProduct.length ?? 0
        : 0
    setStatus(null)
    setForm({
      productId: firstProduct?.id ?? '',
      variantId: supportsVariantSelection(firstProduct) ? firstVariant?.id ?? '' : '',
      lengthM,
      type: 'entrada',
      quantity: 0,
      producedAt: new Date().toISOString().slice(0, 10),
      lotId: '',
      notes: '',
    })
    setIsAdjustOpen(true)
  }

  const closeAdjust = () => {
    setIsAdjustOpen(false)
  }

  const handleProductChange = (productId: string) => {
    const product = products.find((item) => item.id === productId)
    const firstVariant = product?.variants?.[0]
    const lengthM =
      product?.unit === 'metro_linear' && Number.isFinite(product.length)
        ? product.length ?? 0
        : 0
    updateForm({
      productId,
      variantId: supportsVariantSelection(product) ? firstVariant?.id ?? '' : '',
      lengthM,
    })
  }

  const resolveCurrentStock = (
    product: typeof data.produtos[number],
    variantId?: string,
    lengthM?: number,
  ) => {
    if (product.unit === 'metro_linear') {
      const stockItem = findStockItem(data.stockItems, product.id, lengthM)
      return stockItem?.quantity ?? 0
    }
    const variantsList = product.variants ?? []
    const shouldUseVariants = product.hasVariants ?? false
    if (shouldUseVariants) {
      const targetId = variantId || variantsList[0]?.id
      const target = variantsList.find((variant) => variant.id === targetId)
      if (target) {
        return target.stock ?? 0
      }
    }
    return product.stock ?? 0
  }

  const handleAdjust = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.productId) {
      setStatus('Selecione um produto para ajustar.')
      return
    }
    if (form.quantity <= 0) {
      setStatus('Informe uma quantidade valida.')
      return
    }
    const payload = dataService.getAll()
    const productIndex = payload.produtos.findIndex((item) => item.id === form.productId)
    if (productIndex < 0) {
      setStatus('Produto nao encontrado.')
      return
    }
    const current = payload.produtos[productIndex]
    const isLinear = current.unit === 'metro_linear'
    const hasVariantSelection = supportsVariantSelection(current)
    const fallbackVariantId = hasVariantSelection ? current.variants?.[0]?.id : undefined
    const resolvedVariantId = hasVariantSelection
      ? form.variantId || fallbackVariantId
      : undefined
    let lengthM: number | undefined
    if (isLinear) {
      const parsedLength = Number(form.lengthM)
      if (!Number.isFinite(parsedLength) || parsedLength <= 0) {
        setStatus('Informe o comprimento.')
        return
      }
      lengthM = parsedLength
    }
    const delta = form.type === 'entrada' ? form.quantity : -form.quantity
    if (form.type === 'saida') {
      const currentStock = resolveCurrentStock(current, resolvedVariantId, lengthM)
      if (currentStock + delta < 0) {
        setStatus('Estoque insuficiente para essa saida.')
        return
      }
    }
    if (isLinear) {
      const index = findStockItemIndex(payload.stockItems, current.id, lengthM)
      if (index >= 0) {
        const target = payload.stockItems[index]
        payload.stockItems[index] = {
          ...target,
          quantity: (target.quantity ?? 0) + delta,
          updatedAt: new Date().toISOString(),
        }
      } else {
        payload.stockItems = [
          ...payload.stockItems,
          {
            id: createId(),
            productId: current.id,
            lengthM,
            unit: 'un',
            quantity: delta,
            createdAt: new Date().toISOString(),
          },
        ]
      }
    } else {
      payload.produtos[productIndex] = adjustProductStock(current, resolvedVariantId, delta)
    }
    payload.ajustesEstoqueProdutos = [
      ...payload.ajustesEstoqueProdutos,
      {
        id: createId(),
        productId: current.id,
        variantId: resolvedVariantId,
        lotId: form.lotId || undefined,
        type: form.type,
        quantity: form.quantity,
        lengthM,
        producedAt: form.producedAt || undefined,
        notes: form.notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      },
    ]
    const lengthLabel =
      isLinear && Number.isFinite(lengthM)
        ? ` (${formatMeasurement(lengthM ?? 0)} m)`
        : ''
    const description = `${current.name}${lengthLabel} · ${form.type === 'entrada' ? '+' : '-'}${form.quantity}`
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'alteracao',
        title: 'Ajuste de estoque',
        description,
      },
    })
    refresh()
    setStatus('Estoque atualizado.')
    setIsAdjustOpen(false)
  }

  return (
    <Page className="estoque">
      <PageHeader
        actions={
          <button className="button button--primary" type="button" onClick={openAdjust}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              edit
            </span>
            <span className="page-header__action-label">Ajustar estoque</span>
          </button>
        }
      />

      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Itens em estoque</span>
          <strong className="summary__value">{totalStock}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">SKUs ativos</span>
          <strong className="summary__value">{totalSkus}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Estoque critico</span>
          <strong className="summary__value">{criticalItems.length}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Sem estoque</span>
          <strong className="summary__value">{outOfStock.length}</strong>
        </article>
      </div>

      <div className="grid grid--two">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Alertas de estoque</h2>
              <p className="panel__subtitle">Itens que exigem reposicao</p>
            </div>
          </div>
          <div className="list">
            {criticalItems.length === 0 && (
              <div className="list__empty">Nenhum alerta de estoque ativo.</div>
            )}
            {criticalItems.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="list__item">
                <div>
                  <strong>{getLabel(item)}</strong>
                  <span className="list__meta">{item.status}</span>
                </div>
                <strong>{getStockValue(item)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Maiores saldos</h2>
              <p className="panel__subtitle">Produtos com maior quantidade</p>
            </div>
          </div>
          <div className="list">
            {topStock.length === 0 && <div className="list__empty">Nenhum item cadastrado.</div>}
            {topStock.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="list__item">
                <span>{getLabel(item)}</span>
                <strong>{getStockValue(item)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid--two">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Perdas registradas</h2>
              <p className="panel__subtitle">Refugos e perdas de producao</p>
            </div>
          </div>
          <div className="list">
            {losses.length === 0 && (
              <div className="list__empty">Nenhuma perda registrada.</div>
            )}
            {losses.map((scrap) => (
              <div key={scrap.id} className="list__item">
                <div>
                  <strong>{getProductLabel(scrap.productId, scrap.variantId)}</strong>
                  <span className="list__meta">{formatDateShort(scrap.createdAt)}</span>
                  <span className="list__meta">{getOrderLabel(scrap.productionOrderId)}</span>
                </div>
                <strong>-{scrap.quantity}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Ajustes recentes</h2>
              <p className="panel__subtitle">Entradas e saidas manuais</p>
            </div>
          </div>
          <div className="list">
            {adjustments.length === 0 && (
              <div className="list__empty">Nenhum ajuste manual registrado.</div>
            )}
            {adjustments.map((entry) => (
              <div key={entry.id} className="list__item">
                <div>
                  <strong>{getProductLabel(entry.productId, entry.variantId)}</strong>
                  <span className="list__meta">
                    {entry.type === 'entrada' ? 'Entrada' : 'Saida'} ·{' '}
                    {formatDateShort(entry.producedAt ?? entry.createdAt)}
                  </span>
                  <span className="list__meta">
                    {entry.lotId ? `Lote #${getLotCode(entry.lotId)}` : 'Sem lote'}
                  </span>
                  {entry.lengthM ? (
                    <span className="list__meta">
                      Comprimento: {formatMeasurement(entry.lengthM)} m
                    </span>
                  ) : null}
                </div>
                <strong>
                  {entry.type === 'entrada' ? '+' : '-'}
                  {entry.quantity}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Modal
        open={isAdjustOpen}
        onClose={closeAdjust}
        title="Ajustar estoque"
        size="lg"
        actions={
          <button className="button button--primary" type="submit" form={adjustFormId}>
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              save
            </span>
            <span className="modal__action-label">Salvar ajuste</span>
          </button>
        }
      >
        <form id={adjustFormId} className="modal__form" onSubmit={handleAdjust}>
          <div className="modal__group">
            <label className="modal__label" htmlFor="adjust-product">
              Produto
            </label>
            <select
              id="adjust-product"
              className="modal__input"
              value={form.productId}
              onChange={(event) => handleProductChange(event.target.value)}
            >
              <option value="">Selecione</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {supportsVariantSelection(selectedProduct) && (
            <div className="modal__group">
              <label className="modal__label" htmlFor="adjust-variant">
                Variante
              </label>
              <select
                id="adjust-variant"
                className="modal__input"
                value={form.variantId}
                onChange={(event) => updateForm({ variantId: event.target.value })}
              >
                {selectedProduct?.variants?.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedProduct?.unit === 'metro_linear' && (
            <div className="modal__group">
              <label className="modal__label" htmlFor="adjust-length">
                Comprimento (m)
              </label>
              <DimensionInput
                id="adjust-length"
                className="modal__input"
                min="0"
                step={0.01}
                value={form.lengthM}
                onValueChange={(value) => updateForm({ lengthM: value })}
              />
            </div>
          )}

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="adjust-type">
                Tipo
              </label>
              <select
                id="adjust-type"
                className="modal__input"
                value={form.type}
                onChange={(event) =>
                  updateForm({ type: event.target.value as ProductStockAdjustmentType })
                }
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saida</option>
              </select>
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="adjust-qty">
                Quantidade
              </label>
              <input
                id="adjust-qty"
                className="modal__input"
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={(event) => updateForm({ quantity: Number(event.target.value) })}
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="adjust-date">
                Data de producao
              </label>
              <input
                id="adjust-date"
                className="modal__input"
                type="date"
                value={form.producedAt}
                onChange={(event) => updateForm({ producedAt: event.target.value })}
              />
            </div>
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="adjust-lot">
              Lote (opcional)
            </label>
            <select
              id="adjust-lot"
              className="modal__input"
              value={form.lotId}
              onChange={(event) => updateForm({ lotId: event.target.value })}
            >
              <option value="">Sem lote</option>
              {lotOptions.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  #{getLotCode(lot.id)} · {getProductLabel(lot.productId, lot.variantId)} · {lot.quantity} un
                </option>
              ))}
            </select>
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="adjust-notes">
              Observacoes (opcional)
            </label>
            <textarea
              id="adjust-notes"
              className="modal__input modal__textarea"
              value={form.notes}
              onChange={(event) => updateForm({ notes: event.target.value })}
            />
          </div>
        </form>
      </Modal>
    </Page>
  )
}

export default Estoque
