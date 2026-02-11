import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DimensionInput from '../../components/DimensionInput'
import {
  getPaymentCashboxId,
  getPaymentMethodOptions,
} from '../../data/paymentMethods'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { Order, Product, ProductVariant, Quote } from '../../types/erp'
import { formatDimensionsMm } from '../../utils/dimensions'
import { formatCurrency } from '../../utils/format'
import { createId } from '../../utils/ids'
import { resolveOrderCode } from '../../utils/orderCode'
import { resolveUnitPrice, resolveVariantPrice } from '../../utils/sales'
import { getProductUnitLabel } from '../../utils/units'

type PdvMode = 'venda' | 'orcamento'

type CartItem = {
  id: string
  productId: string
  variantId: string
  quantity: number
  unitPrice: number
  customLength: number
  customWidth: number
  customHeight: number
}

type PendingAddItem = {
  productId: string
  variantId?: string
}

type PdvCheckoutProps = {
  mode: PdvMode
  onOpenCash?: () => void
  pendingAddItem?: PendingAddItem | null
  onConsumePendingAdd?: () => void
}

const createDefaultDate = () => {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().slice(0, 10)
}

const PdvCheckout = ({
  mode,
  onOpenCash,
  pendingAddItem,
  onConsumePendingAdd,
}: PdvCheckoutProps) => {
  const { data, refresh } = useERPData()
  const submitRef = useRef<() => void>(() => {})
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')
  const [validUntil, setValidUntil] = useState(createDefaultDate)
  const [paymentMethod, setPaymentMethod] = useState('dinheiro')
  const [status, setStatus] = useState<string | null>(null)
  const [items, setItems] = useState<CartItem[]>([])

  const paymentOptions = useMemo(
    () => getPaymentMethodOptions(data.tabelas?.paymentMethods),
    [data.tabelas?.paymentMethods],
  )

  const activePaymentMethod = useMemo(() => {
    if (paymentOptions.length === 0) {
      return paymentMethod || 'dinheiro'
    }
    return paymentOptions.some((option) => option.id === paymentMethod)
      ? paymentMethod
      : paymentOptions[0].id
  }, [paymentMethod, paymentOptions])

  const products = useMemo(
    () =>
      data.produtos
        .filter((product) => product.active !== false)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.produtos],
  )

  const openSession = useMemo(() => {
    const sessions = data.pdvCaixas.filter((session) => session.status === 'aberto')
    return sessions.sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0] ?? null
  }, [data.pdvCaixas])

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0),
    [items],
  )

  const resolveVariant = (product: Product, variantId: string) =>
    product.variants?.find((variant) => variant.id === variantId)

  const resolveItemUnitPrice = useCallback((product: Product, item: CartItem) => {
    if (product.unit === 'metro_linear') {
      return resolveUnitPrice(product, undefined, { customLength: item.customLength })
    }
    if (product.hasVariants && item.variantId) {
      return resolveVariantPrice(product, item.variantId)
    }
    return resolveUnitPrice(product, undefined, item)
  }, [])

  const addItem = useCallback((product: Product, variant?: ProductVariant | null) => {
    const isLinear = product.unit === 'metro_linear'
    const defaultLength =
      isLinear && product.length && product.length > 0 ? product.length : isLinear ? 1 : 0
    const defaultWidth =
      product.unit === 'm2' && product.width && product.width > 0 ? product.width : 0
    const activeVariants = (product.variants ?? []).filter((variant) => variant.active !== false)
    const variantId =
      variant?.id ?? (!isLinear && product.hasVariants ? activeVariants[0]?.id ?? '' : '')
    const nextItem: CartItem = {
      id: createId(),
      productId: product.id,
      variantId,
      quantity: 1,
      unitPrice: 0,
      customLength: defaultLength,
      customWidth: defaultWidth,
      customHeight: 0,
    }
    nextItem.unitPrice = resolveItemUnitPrice(product, nextItem)
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.productId === nextItem.productId &&
          item.variantId === nextItem.variantId &&
          item.customLength === nextItem.customLength &&
          item.customWidth === nextItem.customWidth,
      )
      if (existingIndex >= 0) {
        return prev.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      }
      return [...prev, nextItem]
    })
    setStatus(null)
  }, [resolveItemUnitPrice])

  const addProduct = useCallback(
    (product: Product) => addItem(product, null),
    [addItem],
  )

  const addVariant = useCallback(
    (product: Product, variant: ProductVariant) => {
      addItem(product, variant)
    },
    [addItem],
  )

  const updateItem = (id: string, patch: Partial<CartItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  const handleVariantChange = (id: string, variantId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item
        }
        const product = products.find((entry) => entry.id === item.productId)
        if (!product) {
          return item
        }
        const next = { ...item, variantId }
        return { ...next, unitPrice: resolveItemUnitPrice(product, next) }
      }),
    )
  }

  const handleLengthChange = (id: string, value: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item
        }
        const product = products.find((entry) => entry.id === item.productId)
        if (!product) {
          return item
        }
        const next = { ...item, customLength: value }
        return {
          ...next,
          unitPrice:
            product.unit === 'metro_linear'
              ? resolveItemUnitPrice(product, next)
              : item.unitPrice,
        }
      }),
    )
  }

  const handleWidthChange = (id: string, value: number) => {
    updateItem(id, { customWidth: value })
  }

  const handleQuantityChange = (id: string, value: number) => {
    const quantity = Number.isFinite(value) ? Math.max(1, value) : 1
    updateItem(id, { quantity })
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const resetForm = useCallback(() => {
    setItems([])
    setClientId('')
    setClientName('')
    setValidUntil(createDefaultDate())
  }, [])

  const resolveClientId = useCallback(() => {
    if (clientId) {
      return clientId
    }
    const payload = dataService.getAll()
    const name = clientName.trim() || 'Cliente balcao'
    const normalized = name.toLowerCase()
    const existing = payload.clientes.find(
      (client) => client.name.trim().toLowerCase() === normalized,
    )
    if (existing) {
      return existing.id
    }
    const next = {
      id: createId(),
      name,
      active: true,
    }
    payload.clientes = [...payload.clientes, next]
    dataService.replaceAll(payload)
    return next.id
  }, [clientId, clientName])

  const resolveStockStatus = (product: Product, item: CartItem) => {
    const variant = item.variantId ? resolveVariant(product, item.variantId) : undefined
    const stock = variant?.stock ?? product.stock
    if (typeof stock !== 'number' || !Number.isFinite(stock)) {
      return null
    }
    if (stock <= 0) {
      return { label: 'Estoque zerado', tone: 'danger' as const }
    }
    if (item.quantity > stock) {
      return { label: `Estoque insuficiente (${stock})`, tone: 'warning' as const }
    }
    if (stock <= item.quantity + 2) {
      return { label: `Estoque baixo (${stock})`, tone: 'warning' as const }
    }
    return null
  }

  const validateItems = useCallback(() => {
    if (items.length === 0) {
      return 'Adicione pelo menos um produto.'
    }
    for (const item of items) {
      const product = products.find((entry) => entry.id === item.productId)
      if (!product) {
        return 'Produto nao encontrado.'
      }
      if (item.quantity <= 0) {
        return 'Quantidade invalida.'
      }
      if (product.unit === 'metro_linear' && item.customLength <= 0) {
        return `Informe o comprimento de ${product.name}.`
      }
      if (product.hasVariants && product.unit !== 'metro_linear' && !item.variantId) {
        return `Selecione a variacao de ${product.name}.`
      }
    }
    return null
  }, [items, products])

  const handleSubmit = useCallback(() => {
    if (mode === 'venda' && !openSession) {
      setStatus('Abra o caixa para registrar a venda.')
      return
    }
    const validation = validateItems()
    if (validation) {
      setStatus(validation)
      return
    }
    const resolvedClientId = resolveClientId()
    const now = new Date().toISOString()
    const mappedItems = items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId || undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      customLength: item.customLength > 0 ? item.customLength : undefined,
      customWidth: item.customWidth > 0 ? item.customWidth : undefined,
      customHeight: item.customHeight > 0 ? item.customHeight : undefined,
    }))

    if (mode === 'orcamento') {
      const quote: Quote = {
        id: createId(),
        clientId: resolvedClientId,
        items: mappedItems,
        total: subtotal,
        paymentMethod: mode === 'orcamento' ? 'a_definir' : activePaymentMethod,
        validUntil,
        status: 'rascunho',
        fulfillment: 'estoque',
        createdAt: now,
      }
      dataService.upsertQuote(quote)
      refresh()
      resetForm()
      setStatus('Orcamento salvo.')
      return
    }

    const orderId = createId()
    const order: Order = {
      id: orderId,
      trackingCode: resolveOrderCode({ id: orderId }),
      clientId: resolvedClientId,
      items: mappedItems,
      total: subtotal,
      paymentMethod: activePaymentMethod,
      status: 'pago',
      fulfillment: 'estoque',
      createdAt: now,
    }
    dataService.upsertOrder(order)
    dataService.addReceipt({
      id: createId(),
      orderId: order.id,
      amount: subtotal,
      paymentMethod: activePaymentMethod,
      issuedAt: now,
    })
    dataService.addFinanceEntry({
      id: createId(),
      type: 'entrada',
      description: `Venda PDV #${resolveOrderCode(order)}`,
      amount: subtotal,
      createdAt: now,
      cashboxId: getPaymentCashboxId(activePaymentMethod, data.tabelas?.paymentMethods),
    })
    if (openSession) {
      dataService.addPdvCashMovement({
        id: createId(),
        cashSessionId: openSession.id,
        type: 'entrada',
        method: activePaymentMethod,
        amount: subtotal,
        source: 'venda',
        createdAt: now,
        orderId: order.id,
      })
    }
    refresh()
    resetForm()
    setStatus('Venda registrada.')
  }, [
    activePaymentMethod,
    data.tabelas?.paymentMethods,
    items,
    mode,
    openSession,
    refresh,
    resetForm,
    resolveClientId,
    subtotal,
    validUntil,
    validateItems,
  ])

  useEffect(() => {
    submitRef.current = handleSubmit
  }, [handleSubmit])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (!isEditable && event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault()
        submitRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!pendingAddItem) {
      return
    }
    const product = products.find((entry) => entry.id === pendingAddItem.productId)
    if (!product) {
      onConsumePendingAdd?.()
      return
    }
    if (pendingAddItem.variantId) {
      const variant = product.variants?.find(
        (entry) => entry.id === pendingAddItem.variantId,
      )
      if (variant) {
        addVariant(product, variant)
      } else {
        addProduct(product)
      }
      onConsumePendingAdd?.()
      return
    }
    addProduct(product)
    onConsumePendingAdd?.()
  }, [addProduct, addVariant, onConsumePendingAdd, pendingAddItem, products])

  return (
    <div className="pdv__checkout">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Catalogo</h2>
            <p>Produtos disponiveis</p>
          </div>
          <span className="panel__meta">{products.length} itens</span>
        </div>
        <div className="panel__body">
          <div className="card-grid">
            {products.map((product) => {
              const unitLabel = getProductUnitLabel(product.unit)
              const dimensions = formatDimensionsMm(
                [product.length, product.width, product.height],
                {
                  emptyLabel: 'Sem medidas',
                  compact: true,
                },
              )
              const sku = product.sku?.trim()
              return (
                <article key={product.id} className="card">
                  <div className="card__stack">
                    <strong className="card__title">{product.name}</strong>
                    <span className="card__meta">{unitLabel}</span>
                    <span className="card__meta">{dimensions}</span>
                    {sku && <span className="card__meta">SKU {sku}</span>}
                  </div>
                  <div className="card__row card__row--between">
                    <strong className="card__title">{formatCurrency(product.price)}</strong>
                    <button
                      className="button button--primary button--sm"
                      type="button"
                      onClick={() => addProduct(product)}
                    >
                      Adicionar
                    </button>
                  </div>
                </article>
              )
            })}
            {products.length === 0 && (
              <p className="card-grid__empty">Nenhum produto encontrado.</p>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Resumo do atendimento</h2>
            <p>{mode === 'venda' ? 'Venda' : 'Orcamento'}</p>
          </div>
          <span className="panel__meta">{items.length} itens</span>
        </div>
        <div className="panel__body">
          {mode === 'venda' && !openSession && (
            <div className="panel__section">
              <div className="panel__section-header">
                <h3 className="panel__section-title">Caixa fechado</h3>
                {onOpenCash && (
                  <button
                    className="button button--ghost button--sm"
                    type="button"
                    onClick={onOpenCash}
                  >
                    Abrir caixa
                  </button>
                )}
              </div>
              <p className="panel__subtitle">Abra o caixa para registrar a venda.</p>
            </div>
          )}

          <div className="panel__section">
            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="pdv-client-select">
                  Cliente
                </label>
                <select
                  id="pdv-client-select"
                  className="form__input"
                  value={clientId}
                  onChange={(event) => {
                    setClientId(event.target.value)
                    setClientName('')
                  }}
                >
                  <option value="">Selecione um cliente</option>
                  {data.clientes
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="pdv-client-name">
                  Ou digite novo
                </label>
                <input
                  id="pdv-client-name"
                  className="form__input"
                  type="text"
                  placeholder="Cliente balcao"
                  value={clientName}
                  onChange={(event) => {
                    setClientName(event.target.value)
                    setClientId('')
                  }}
                />
              </div>
              {mode === 'orcamento' && (
                <div className="form__group">
                  <label className="form__label" htmlFor="pdv-valid-until">
                    Validade
                  </label>
                  <input
                    id="pdv-valid-until"
                    className="form__input"
                    type="date"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="panel__section">
            <div className="pdv__cart-list">
              {items.map((item) => {
                const product = products.find((entry) => entry.id === item.productId)
                if (!product) {
                  return null
                }
                const hasVariants = product.hasVariants && product.unit !== 'metro_linear'
                const variantOptions = (product.variants ?? []).filter(
                  (variant) => variant.active !== false,
                )
                const unitLabel = getProductUnitLabel(product.unit)
                const stockStatus = resolveStockStatus(product, item)
                const stockClass =
                  stockStatus?.tone === 'danger'
                    ? 'badge ui-badge--danger'
                    : 'badge ui-badge--warning'
                return (
                  <article key={item.id} className="card">
                    <div className="card__header">
                      <div className="card__stack">
                        <strong className="card__title">{product.name}</strong>
                        <span className="card__meta">{unitLabel}</span>
                      </div>
                      <div className="card__row">
                        {stockStatus && (
                          <span className={stockClass}>{stockStatus.label}</span>
                        )}
                        <button
                          className="button button--ghost button--icon"
                          type="button"
                          aria-label="Remover item"
                          onClick={() => removeItem(item.id)}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            close
                          </span>
                        </button>
                      </div>
                    </div>
                    <div className="form__row">
                      {hasVariants && (
                        <div className="form__group">
                          <label className="form__label" htmlFor={`pdv-variant-${item.id}`}>
                            Variacao
                          </label>
                          <select
                            id={`pdv-variant-${item.id}`}
                            className="form__input"
                            value={item.variantId}
                            onChange={(event) =>
                              handleVariantChange(item.id, event.target.value)
                            }
                          >
                            <option value="">Selecione</option>
                            {variantOptions.map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {product.unit === 'metro_linear' && (
                        <div className="form__group">
                          <label className="form__label" htmlFor={`pdv-length-${item.id}`}>
                            Comprimento
                          </label>
                          <DimensionInput
                            id={`pdv-length-${item.id}`}
                            className="form__input"
                            min="0"
                            step={0.01}
                            value={item.customLength}
                            onValueChange={(value) => handleLengthChange(item.id, value)}
                          />
                        </div>
                      )}
                      {product.unit === 'm2' && (
                        <>
                          <div className="form__group">
                            <label className="form__label" htmlFor={`pdv-length-${item.id}`}>
                              Comprimento
                            </label>
                            <DimensionInput
                              id={`pdv-length-${item.id}`}
                              className="form__input"
                              min="0"
                              step={0.01}
                              value={item.customLength}
                              onValueChange={(value) => handleLengthChange(item.id, value)}
                            />
                          </div>
                          <div className="form__group">
                            <label className="form__label" htmlFor={`pdv-width-${item.id}`}>
                              Largura
                            </label>
                            <DimensionInput
                              id={`pdv-width-${item.id}`}
                              className="form__input"
                              min="0"
                              step={0.01}
                              value={item.customWidth}
                              onValueChange={(value) => handleWidthChange(item.id, value)}
                            />
                          </div>
                        </>
                      )}
                      <div className="form__group">
                        <label className="form__label" htmlFor={`pdv-quantity-${item.id}`}>
                          Quantidade
                        </label>
                        <input
                          id={`pdv-quantity-${item.id}`}
                          className="form__input"
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) =>
                            handleQuantityChange(item.id, Number(event.target.value))
                          }
                        />
                      </div>
                    </div>
                    <div className="card__row card__row--between">
                      <span className="card__meta">
                        Unitario {formatCurrency(item.unitPrice)}
                      </span>
                      <strong className="card__title">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </strong>
                    </div>
                  </article>
                )
              })}
              {items.length === 0 && (
                <div className="list__empty">Nenhum item selecionado.</div>
              )}
            </div>
          </div>

          <div className="panel__section">
            <div className="summary">
              <article className="summary__item">
                <span className="summary__label">Total</span>
                <strong className="summary__value">{formatCurrency(subtotal)}</strong>
              </article>
            </div>
            {mode === 'venda' && (
              <div className="form__group">
                <span className="form__label">Meio de pagamento</span>
                <div className="card__row">
                  {paymentOptions.map((option) => (
                    <button
                      key={option.id}
                      className={`button button--sm ${
                        activePaymentMethod === option.id
                          ? 'button--primary'
                          : 'button--ghost'
                      }`}
                      type="button"
                      onClick={() => setPaymentMethod(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="panel__section">
            {status && <p className="form__status">{status}</p>}
            <button
              className="button button--primary button--lg button--block"
              type="button"
              onClick={handleSubmit}
            >
              {mode === 'venda' ? 'Receber pagamento' : 'Salvar orcamento'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default PdvCheckout
