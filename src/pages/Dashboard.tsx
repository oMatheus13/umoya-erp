import { useMemo, useState } from 'react'
import Modal from '../components/Modal'
import { PAYMENT_METHODS, getPaymentMethodId } from '../data/paymentMethods'
import { useERPData } from '../store/appStore'
import { dataService } from '../services/dataService'
import { createId } from '../utils/ids'
import { formatCurrency, formatDateShort } from '../utils/format'
import type { Order, ProductionOrder, Quote } from '../types/erp'

type DashboardProps = {
  onNavigate?: (page: string) => void
}

const Dashboard = ({ onNavigate }: DashboardProps) => {
  const { data, refresh } = useERPData()
  const now = new Date()
  const todayKey = now.toDateString()
  const todayInput = now.toISOString().slice(0, 10)

  const createDefaultDate = () => {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    return date.toISOString().slice(0, 10)
  }

  const availableClients = useMemo(
    () => [...data.clientes].sort((a, b) => a.name.localeCompare(b.name)),
    [data.clientes],
  )
  const availableProducts = useMemo(
    () => data.produtos.filter((product) => product.active !== false),
    [data.produtos],
  )

  const resolveUnitPrice = (productId: string, variantId?: string) => {
    const product = data.produtos.find((item) => item.id === productId)
    if (!product) {
      return 0
    }
    if (product.hasVariants) {
      const variant = product.variants?.find((item) => item.id === variantId)
      return variant?.priceOverride ?? 0
    }
    return product.price ?? 0
  }

  const buildQuickQuote = () => {
    const firstClient = availableClients[0]
    const firstProduct = availableProducts[0]
    const firstVariant = firstProduct?.hasVariants ? firstProduct?.variants?.[0] : undefined
    return {
      clientId: firstClient?.id ?? '',
      productId: firstProduct?.id ?? '',
      variantId: firstVariant?.id ?? '',
      quantity: 1,
      unitPrice: firstProduct ? resolveUnitPrice(firstProduct.id, firstVariant?.id) : 0,
    }
  }

  const buildQuickOrder = () => {
    const firstClient = availableClients[0]
    const firstProduct = availableProducts[0]
    const firstVariant = firstProduct?.hasVariants ? firstProduct?.variants?.[0] : undefined
    return {
      clientId: firstClient?.id ?? '',
      productId: firstProduct?.id ?? '',
      variantId: firstVariant?.id ?? '',
      quantity: 1,
      unitPrice: firstProduct ? resolveUnitPrice(firstProduct.id, firstVariant?.id) : 0,
      paymentMethod: 'a_definir',
    }
  }

  const buildQuickProduction = () => {
    const firstOrder = data.pedidos[0]
    const firstItem = firstOrder?.items[0]
    const lengthKey =
      firstItem?.customLength && firstItem.customLength > 0
        ? firstItem.customLength.toFixed(4)
        : ''
    const itemKey = firstItem
      ? `${firstItem.productId}:${firstItem.variantId ?? ''}:${lengthKey}`
      : ''
    return {
      orderId: firstOrder?.id ?? '',
      itemKey,
      quantity: firstItem?.quantity ?? 1,
      customLength: firstItem?.customLength ?? 0,
      plannedAt: todayInput,
    }
  }

  const openOrders = data.pedidos.filter((order) => order.status !== 'entregue').length
  const inProduction = data.ordensProducao.filter(
    (order) => order.status === 'em_producao',
  ).length

  const expiringQuotes = useMemo(() => {
    const now = new Date()
    const limit = new Date()
    limit.setDate(now.getDate() + 7)
    return data.orcamentos
      .filter(
        (quote) =>
          (quote.status === 'rascunho' || quote.status === 'enviado') &&
          new Date(quote.validUntil) <= limit,
      )
      .sort((a, b) => a.validUntil.localeCompare(b.validUntil))
      .slice(0, 3)
  }, [data.orcamentos])

  const cash = data.financeiro.reduce(
    (acc, entry) => acc + (entry.type === 'entrada' ? entry.amount : -entry.amount),
    0,
  )

  const productionSummary = useMemo(() => {
    const finishedThisMonth = data.ordensProducao.filter((order) => {
      if (!order.finishedAt) {
        return false
      }
      const date = new Date(order.finishedAt)
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    })
    const total = finishedThisMonth.reduce((acc, order) => {
      const pedido = data.pedidos.find((item) => item.id === order.orderId)
      return acc + (pedido?.total ?? 0)
    }, 0)
    return { total, count: finishedThisMonth.length }
  }, [data.ordensProducao, data.pedidos, now])

  const recentReceipts = useMemo(
    () => [...data.recibos].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).slice(0, 3),
    [data.recibos],
  )

  const recentOrders = useMemo(
    () =>
      [...data.pedidos]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4),
    [data.pedidos],
  )

  const lowStock = useMemo(() => {
    const entries = data.produtos.flatMap((product) => {
      const hasLinearVariants =
        product.unit === 'metro_linear' && (product.variants ?? []).length > 0
      if (product.hasVariants || hasLinearVariants) {
        return (product.variants ?? []).map((variant) => ({
          productId: product.id,
          productName: product.name,
          variantId: variant.id,
          variantName: variant.name,
          variantLocked: variant.locked ?? false,
          stock: variant.stock ?? 0,
        }))
      }
      return [
        {
          productId: product.id,
          productName: product.name,
          variantId: '',
          variantName: '',
          variantLocked: false,
          stock: product.stock ?? 0,
        },
      ]
    })
    return entries
      .filter((entry) => entry.stock <= 5)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 4)
  }, [data.produtos])

  const getClientName = (id: string) =>
    data.clientes.find((client) => client.id === id)?.name ?? 'Cliente'

  const getProductLabel = (productId: string, variantId?: string, length?: number) => {
    const product = data.produtos.find((item) => item.id === productId)
    if (!product) {
      return 'Produto'
    }
    if (product.unit === 'metro_linear' && length && length > 0) {
      const cm = length * 100
      const lengthLabel = cm % 1 === 0 ? `${cm.toFixed(0)} cm` : `${cm.toFixed(1)} cm`
      return `${product.name} • ${lengthLabel}`
    }
    const variant = product.variants?.find((item) => item.id === variantId)
    return variant ? `${product.name} • ${variant.name}` : product.name
  }

  const delayedProduction = useMemo(() => {
    const nowTime = now.getTime()
    return data.ordensProducao
      .filter((order) => order.status !== 'finalizada')
      .map((order) => {
        const orderCreatedAt = data.pedidos.find((item) => item.id === order.orderId)?.createdAt
        const referenceDate = order.plannedAt ?? orderCreatedAt
        if (!referenceDate) {
          return null
        }
        const days = Math.floor((nowTime - new Date(referenceDate).getTime()) / 86400000)
        return {
          id: order.id,
          productId: order.productId,
          variantId: order.variantId,
          days,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry && entry.days >= 5))
      .sort((a, b) => b.days - a.days)
      .slice(0, 3)
  }, [data.ordensProducao, data.pedidos, now])

  const pendingQuotes = data.orcamentos.filter(
    (quote) => quote.status === 'rascunho' || quote.status === 'enviado',
  ).length
  const pendingPayments = data.pedidos.filter(
    (order) => order.status === 'aguardando_pagamento',
  ).length
  const openProduction = data.ordensProducao.filter((order) => order.status === 'aberta').length

  const ordersToday = data.pedidos.filter(
    (order) => new Date(order.createdAt).toDateString() === todayKey,
  ).length
  const receiptsToday = data.recibos
    .filter((receipt) => new Date(receipt.issuedAt).toDateString() === todayKey)
    .reduce((acc, receipt) => acc + receipt.amount, 0)

  type QuickActionId = 'orcamentos' | 'pedidos' | 'producao' | 'presenca'

  const [quickAction, setQuickAction] = useState<QuickActionId | null>(null)
  const [quickStatus, setQuickStatus] = useState<string | null>(null)
  const [quickQuote, setQuickQuote] = useState(buildQuickQuote)
  const [quickOrder, setQuickOrder] = useState(buildQuickOrder)
  const [quickProduction, setQuickProduction] = useState(buildQuickProduction)

  const openQuickAction = (actionId: QuickActionId) => {
    setQuickStatus(null)
    if (actionId === 'orcamentos') {
      setQuickQuote(buildQuickQuote())
    }
    if (actionId === 'pedidos') {
      setQuickOrder(buildQuickOrder())
    }
    if (actionId === 'producao') {
      setQuickProduction(buildQuickProduction())
    }
    setQuickAction(actionId)
  }

  const closeQuickAction = () => {
    setQuickAction(null)
    setQuickStatus(null)
  }

  const quickActions = [
    {
      id: 'orcamentos' as const,
      title: 'Novo orcamento',
      description: 'Criar proposta rapida',
      icon: 'description',
    },
    {
      id: 'pedidos' as const,
      title: 'Novo pedido',
      description: 'Vincular a um cliente',
      icon: 'shopping_bag',
    },
    {
      id: 'producao' as const,
      title: 'Nova producao',
      description: 'Gerar ordem de producao',
      icon: 'factory',
    },
    {
      id: 'presenca' as const,
      title: 'Registrar presenca',
      description: 'Apontar equipe do dia',
      icon: 'how_to_reg',
    },
  ]

  const monthlyFlow = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      const label = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(
        date.getFullYear(),
      ).slice(-2)}`
      return { label, in: 0, out: 0, key: `${date.getFullYear()}-${date.getMonth()}` }
    })

    data.financeiro.forEach((entry) => {
      const date = new Date(entry.createdAt)
      const key = `${date.getFullYear()}-${date.getMonth()}`
      const target = months.find((month) => month.key === key)
      if (target) {
        if (entry.type === 'entrada') {
          target.in += entry.amount
        } else {
          target.out += entry.amount
        }
      }
    })

    const maxValue = Math.max(1, ...months.flatMap((month) => [month.in, month.out]))
    return { months, maxValue }
  }, [data.financeiro, now])

  return (
    <section className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__headline">
          <span className="dashboard__eyebrow">Visao geral</span>
          <h1 className="dashboard__title">Resumo da operacao</h1>
          <p className="dashboard__subtitle">
            Visao minimalista com foco no que move a fabrica hoje.
          </p>
        </div>
        <div className="dashboard__meta">
          <span>Atualizado</span>
          <strong>{formatDateShort(new Date().toISOString())}</strong>
        </div>
      </header>

      <div className="dashboard__hero">
        <section className="dashboard__section dashboard__section--summary">
          <div className="dashboard__section-header">
            <div>
              <h2 className="dashboard__section-title">Resumo do dia</h2>
              <p className="dashboard__section-subtitle">
                Producao, financeiro e pendencias em um olhar.
              </p>
            </div>
          </div>
          <div className="dashboard__summary">
            <div className="dashboard__summary-grid">
              <div className="dashboard__summary-item">
                <span className="dashboard__summary-label">Pedidos em aberto</span>
                <strong className="dashboard__summary-value">{openOrders}</strong>
              </div>
              <div className="dashboard__summary-item">
                <span className="dashboard__summary-label">Producao em andamento</span>
                <strong className="dashboard__summary-value">{inProduction}</strong>
              </div>
              <div className="dashboard__summary-item">
                <span className="dashboard__summary-label">Caixa atual</span>
                <strong className="dashboard__summary-value">{formatCurrency(cash)}</strong>
              </div>
              <div className="dashboard__summary-item">
                <span className="dashboard__summary-label">Producao do mes</span>
                <strong className="dashboard__summary-value">
                  {formatCurrency(productionSummary.total)}
                </strong>
                <span className="dashboard__summary-meta">
                  {productionSummary.count} ordens finalizadas
                </span>
              </div>
              <div className="dashboard__summary-item">
                <span className="dashboard__summary-label">Orcamentos pendentes</span>
                <strong className="dashboard__summary-value">{pendingQuotes}</strong>
              </div>
              <div className="dashboard__summary-item">
                <span className="dashboard__summary-label">Pagamentos pendentes</span>
                <strong className="dashboard__summary-value">{pendingPayments}</strong>
              </div>
              <div className="dashboard__summary-item">
                <span className="dashboard__summary-label">Ordens abertas</span>
                <strong className="dashboard__summary-value">{openProduction}</strong>
              </div>
              <div className="dashboard__summary-item">
                <span className="dashboard__summary-label">Movimento de hoje</span>
                <strong className="dashboard__summary-value">
                  {ordersToday} pedidos / {formatCurrency(receiptsToday)}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard__section dashboard__section--actions">
          <div className="dashboard__section-header">
            <div>
              <h2 className="dashboard__section-title">Atalhos rapidos</h2>
              <p className="dashboard__section-subtitle">
                Crie operacoes sem perder contexto.
              </p>
            </div>
          </div>
          <div className="dashboard__actions">
            {quickActions.map((action) => (
              <button
                key={action.id}
                className="dashboard__action"
                type="button"
                onClick={() => openQuickAction(action.id)}
              >
                <span className="dashboard__action-icon material-symbols-outlined" aria-hidden="true">
                  {action.icon}
                </span>
                <span>
                  <strong className="dashboard__action-title">{action.title}</strong>
                  <span className="dashboard__action-meta">{action.description}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard__grid">
        <section className="dashboard__panel dashboard__panel--chart">
          <div className="dashboard__panel-header">
            <div>
              <h2 className="dashboard__panel-title">Fluxo financeiro</h2>
              <p className="dashboard__panel-subtitle">Entradas vs saidas (6 meses)</p>
            </div>
            <div className="dashboard__legend">
              <span className="dashboard__legend-item">
                <i className="dashboard__legend-dot dashboard__legend-dot--in" />
                Entradas
              </span>
              <span className="dashboard__legend-item">
                <i className="dashboard__legend-dot dashboard__legend-dot--out" />
                Saidas
              </span>
            </div>
          </div>
          <div className="dashboard__chart" role="img" aria-label="Fluxo financeiro mensal">
            {monthlyFlow.months.map((month) => (
              <div key={month.label} className="dashboard__chart-group">
                <div className="dashboard__chart-bars">
                  <span
                    className="dashboard__chart-bar dashboard__chart-bar--in"
                    style={{ height: `${(month.in / monthlyFlow.maxValue) * 100}%` }}
                  />
                  <span
                    className="dashboard__chart-bar dashboard__chart-bar--out"
                    style={{ height: `${(month.out / monthlyFlow.maxValue) * 100}%` }}
                  />
                </div>
                <span className="dashboard__chart-label">{month.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard__panel">
          <div className="dashboard__panel-header">
            <div>
              <h2 className="dashboard__panel-title">Alertas</h2>
              <p className="dashboard__panel-subtitle">Itens que pedem atencao</p>
            </div>
          </div>
          <div className="dashboard__alert-grid">
            <div className="dashboard__alert">
              <span className="dashboard__alert-title">Orcamentos vencendo</span>
              <div className="dashboard__mini-list">
                {expiringQuotes.length === 0 && (
                  <div className="dashboard__empty">Nenhum orcamento nos proximos 7 dias.</div>
                )}
                {expiringQuotes.map((quote) => (
                  <div key={quote.id} className="dashboard__mini-item">
                    <span>{getClientName(quote.clientId)}</span>
                    <strong>{formatDateShort(quote.validUntil)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="dashboard__alert">
              <span className="dashboard__alert-title">Producao atrasada</span>
              <div className="dashboard__mini-list">
                {delayedProduction.length === 0 && (
                  <div className="dashboard__empty">Nenhuma ordem atrasada no momento.</div>
                )}
                {delayedProduction.map((entry) => (
                  <div key={entry.id} className="dashboard__mini-item">
                    <span>{getProductLabel(entry.productId, entry.variantId)}</span>
                    <strong>{entry.days} dias</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="dashboard__alert">
              <span className="dashboard__alert-title">Estoque baixo</span>
              <div className="dashboard__mini-list">
                {lowStock.length === 0 && (
                  <div className="dashboard__empty">Nenhum item abaixo do minimo.</div>
                )}
                {lowStock.map((entry) => (
                  <div key={`${entry.productId}-${entry.variantId}`} className="dashboard__mini-item">
                    <span>
                      {entry.variantName
                        ? entry.variantLocked
                          ? `${entry.productName} ${entry.variantName}`
                          : `${entry.productName} • ${entry.variantName}`
                        : entry.productName}
                    </span>
                    <strong>{entry.stock}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="dashboard__grid">
        <section className="dashboard__panel">
          <div className="dashboard__panel-header">
            <div>
              <h2 className="dashboard__panel-title">Pedidos recentes</h2>
              <p className="dashboard__panel-subtitle">Ultimas movimentacoes</p>
            </div>
          </div>
          <div className="dashboard__list">
            {recentOrders.length === 0 && (
              <div className="dashboard__empty">Nenhum pedido criado.</div>
            )}
            {recentOrders.map((order) => (
              <div key={order.id} className="dashboard__list-item">
                <span>{getClientName(order.clientId)}</span>
                <strong>{formatCurrency(order.total)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard__panel">
          <div className="dashboard__panel-header">
            <div>
              <h2 className="dashboard__panel-title">Pagamentos recentes</h2>
              <p className="dashboard__panel-subtitle">Entradas confirmadas</p>
            </div>
          </div>
          <div className="dashboard__list">
            {recentReceipts.length === 0 && (
              <div className="dashboard__empty">Nenhum pagamento registrado.</div>
            )}
            {recentReceipts.map((receipt) => {
              const order = data.pedidos.find((item) => item.id === receipt.orderId)
              const clientName = order ? getClientName(order.clientId) : 'Cliente'
              return (
                <div key={receipt.id} className="dashboard__list-item">
                  <span>{clientName}</span>
                  <strong>{formatCurrency(receipt.amount)}</strong>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <Modal
        open={Boolean(quickAction)}
        title={
          quickAction === 'orcamentos'
            ? 'Novo orcamento rapido'
            : quickAction === 'pedidos'
              ? 'Novo pedido rapido'
              : quickAction === 'producao'
                ? 'Nova producao rapida'
                : 'Registrar presenca'
        }
        onClose={closeQuickAction}
        size="sm"
      >
        {quickAction === 'orcamentos' && (
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              setQuickStatus(null)
              if (!quickQuote.clientId || !quickQuote.productId) {
                setQuickStatus('Selecione cliente e produto.')
                return
              }
              const nowIso = new Date().toISOString()
              const total = quickQuote.quantity * quickQuote.unitPrice
              const quote: Quote = {
                id: createId(),
                clientId: quickQuote.clientId,
                items: [
                  {
                    productId: quickQuote.productId,
                    variantId: quickQuote.variantId || undefined,
                    quantity: quickQuote.quantity,
                    unitPrice: quickQuote.unitPrice,
                  },
                ],
                total,
                validUntil: createDefaultDate(),
                status: 'rascunho',
                createdAt: nowIso,
              }
              dataService.upsertQuote(quote)
              refresh()
              setQuickStatus('Orcamento rapido criado.')
            }}
          >
            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="quick-quote-client">
                  Cliente
                </label>
                <select
                  id="quick-quote-client"
                  className="form__input"
                  value={quickQuote.clientId}
                  onChange={(event) =>
                    setQuickQuote((prev) => ({ ...prev, clientId: event.target.value }))
                  }
                >
                  <option value="">Selecione</option>
                  {availableClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="quick-quote-product">
                  Produto
                </label>
                <select
                  id="quick-quote-product"
                  className="form__input"
                  value={quickQuote.productId}
                  onChange={(event) => {
                    const productId = event.target.value
                    const product = data.produtos.find((item) => item.id === productId)
                    const variantId = product?.hasVariants ? product?.variants?.[0]?.id ?? '' : ''
                    setQuickQuote((prev) => ({
                      ...prev,
                      productId,
                      variantId,
                      unitPrice: resolveUnitPrice(productId, variantId),
                    }))
                  }}
                >
                  <option value="">Selecione</option>
                  {availableProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form__row">
              {data.produtos.find((item) => item.id === quickQuote.productId)?.hasVariants ? (
                <div className="form__group">
                  <label className="form__label" htmlFor="quick-quote-variant">
                    Variacao
                  </label>
                  <select
                    id="quick-quote-variant"
                    className="form__input"
                    value={quickQuote.variantId}
                    onChange={(event) => {
                      const variantId = event.target.value
                      setQuickQuote((prev) => ({
                        ...prev,
                        variantId,
                        unitPrice: resolveUnitPrice(prev.productId, variantId),
                      }))
                    }}
                    disabled={!quickQuote.productId}
                  >
                    <option value="">Selecione</option>
                    {(data.produtos.find((item) => item.id === quickQuote.productId)?.variants ??
                      []).map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name}
                      </option>
                    ))}
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
                <label className="form__label" htmlFor="quick-quote-qty">
                  Quantidade
                </label>
                <input
                  id="quick-quote-qty"
                  className="form__input"
                  type="number"
                  min="1"
                  value={quickQuote.quantity}
                  onChange={(event) =>
                    setQuickQuote((prev) => ({
                      ...prev,
                      quantity: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="quick-quote-price">
                  Valor unitario
                </label>
                <input
                  id="quick-quote-price"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={quickQuote.unitPrice}
                  onChange={(event) =>
                    setQuickQuote((prev) => ({
                      ...prev,
                      unitPrice: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="form__summary">
                <span>Total</span>
                <strong>{formatCurrency(quickQuote.quantity * quickQuote.unitPrice)}</strong>
              </div>
            </div>
            {quickStatus && <div className="form__status">{quickStatus}</div>}
            <div className="form__actions">
              <button className="button button--primary" type="submit">
                Criar orcamento
              </button>
              <button className="button button--ghost" type="button" onClick={closeQuickAction}>
                Fechar
              </button>
            </div>
          </form>
        )}

        {quickAction === 'pedidos' && (
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              setQuickStatus(null)
              if (!quickOrder.clientId || !quickOrder.productId) {
                setQuickStatus('Selecione cliente e produto.')
                return
              }
              const nowIso = new Date().toISOString()
              const total = quickOrder.quantity * quickOrder.unitPrice
              const normalizedPayment =
                getPaymentMethodId(quickOrder.paymentMethod) || quickOrder.paymentMethod
              const order: Order = {
                id: createId(),
                clientId: quickOrder.clientId,
                items: [
                  {
                    productId: quickOrder.productId,
                    variantId: quickOrder.variantId || undefined,
                    quantity: quickOrder.quantity,
                    unitPrice: quickOrder.unitPrice,
                  },
                ],
                total,
                paymentMethod: normalizedPayment || 'a_definir',
                status: 'aguardando_pagamento',
                createdAt: nowIso,
              }
              dataService.upsertOrder(order)
              refresh()
              setQuickStatus('Pedido rapido criado.')
            }}
          >
            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="quick-order-client">
                  Cliente
                </label>
                <select
                  id="quick-order-client"
                  className="form__input"
                  value={quickOrder.clientId}
                  onChange={(event) =>
                    setQuickOrder((prev) => ({ ...prev, clientId: event.target.value }))
                  }
                >
                  <option value="">Selecione</option>
                  {availableClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="quick-order-product">
                  Produto
                </label>
                <select
                  id="quick-order-product"
                  className="form__input"
                  value={quickOrder.productId}
                  onChange={(event) => {
                    const productId = event.target.value
                    const product = data.produtos.find((item) => item.id === productId)
                    const variantId = product?.hasVariants ? product?.variants?.[0]?.id ?? '' : ''
                    setQuickOrder((prev) => ({
                      ...prev,
                      productId,
                      variantId,
                      unitPrice: resolveUnitPrice(productId, variantId),
                    }))
                  }}
                >
                  <option value="">Selecione</option>
                  {availableProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form__row">
              {data.produtos.find((item) => item.id === quickOrder.productId)?.hasVariants ? (
                <div className="form__group">
                  <label className="form__label" htmlFor="quick-order-variant">
                    Variacao
                  </label>
                  <select
                    id="quick-order-variant"
                    className="form__input"
                    value={quickOrder.variantId}
                    onChange={(event) => {
                      const variantId = event.target.value
                      setQuickOrder((prev) => ({
                        ...prev,
                        variantId,
                        unitPrice: resolveUnitPrice(prev.productId, variantId),
                      }))
                    }}
                    disabled={!quickOrder.productId}
                  >
                    <option value="">Selecione</option>
                    {(data.produtos.find((item) => item.id === quickOrder.productId)?.variants ??
                      []).map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name}
                      </option>
                    ))}
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
                <label className="form__label" htmlFor="quick-order-qty">
                  Quantidade
                </label>
                <input
                  id="quick-order-qty"
                  className="form__input"
                  type="number"
                  min="1"
                  value={quickOrder.quantity}
                  onChange={(event) =>
                    setQuickOrder((prev) => ({
                      ...prev,
                      quantity: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="quick-order-price">
                  Valor unitario
                </label>
                <input
                  id="quick-order-price"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={quickOrder.unitPrice}
                  onChange={(event) =>
                    setQuickOrder((prev) => ({
                      ...prev,
                      unitPrice: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="quick-order-payment">
                  Forma de pagamento
                </label>
                <select
                  id="quick-order-payment"
                  className="form__input"
                  value={quickOrder.paymentMethod}
                  onChange={(event) =>
                    setQuickOrder((prev) => ({
                      ...prev,
                      paymentMethod: event.target.value,
                    }))
                  }
                >
                  {quickOrder.paymentMethod &&
                    !PAYMENT_METHODS.some((method) => method.id === quickOrder.paymentMethod) && (
                      <option value={quickOrder.paymentMethod}>
                        Outro ({quickOrder.paymentMethod})
                      </option>
                    )}
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form__summary">
              <span>Total</span>
              <strong>{formatCurrency(quickOrder.quantity * quickOrder.unitPrice)}</strong>
            </div>
            {quickStatus && <div className="form__status">{quickStatus}</div>}
            <div className="form__actions">
              <button className="button button--primary" type="submit">
                Criar pedido
              </button>
              <button className="button button--ghost" type="button" onClick={closeQuickAction}>
                Fechar
              </button>
            </div>
          </form>
        )}

        {quickAction === 'producao' && (
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              setQuickStatus(null)
              if (!quickProduction.orderId || !quickProduction.itemKey) {
                setQuickStatus('Selecione um pedido e item.')
                return
              }
              const [productId, variantValue, lengthValue] = quickProduction.itemKey.split(':')
              const length = lengthValue ? Number(lengthValue) : quickProduction.customLength
              const productionOrder: ProductionOrder = {
                id: createId(),
                orderId: quickProduction.orderId,
                productId,
                variantId: variantValue || undefined,
                quantity: quickProduction.quantity,
                customLength: Number.isFinite(length) ? length : undefined,
                status: 'aberta',
                plannedAt: quickProduction.plannedAt,
              }
              const payload = dataService.getAll()
              payload.ordensProducao = [...payload.ordensProducao, productionOrder]
              dataService.replaceAll(payload)
              refresh()
              setQuickStatus('Ordem de producao criada.')
            }}
          >
            <div className="form__group">
              <label className="form__label" htmlFor="quick-production-order">
                Pedido
              </label>
              <select
                id="quick-production-order"
                className="form__input"
                value={quickProduction.orderId}
                onChange={(event) => {
                  const orderId = event.target.value
                  const order = data.pedidos.find((item) => item.id === orderId)
                  const firstItem = order?.items[0]
                  const lengthKey =
                    firstItem?.customLength && firstItem.customLength > 0
                      ? firstItem.customLength.toFixed(4)
                      : ''
                  const itemKey = firstItem
                    ? `${firstItem.productId}:${firstItem.variantId ?? ''}:${lengthKey}`
                    : ''
                  setQuickProduction((prev) => ({
                    ...prev,
                    orderId,
                    itemKey,
                    quantity: firstItem?.quantity ?? 1,
                    customLength: firstItem?.customLength ?? 0,
                  }))
                }}
              >
                <option value="">Selecione</option>
                {data.pedidos.map((order) => (
                  <option key={order.id} value={order.id}>
                    {getClientName(order.clientId)} • {formatCurrency(order.total)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="quick-production-item">
                  Item
                </label>
                <select
                  id="quick-production-item"
                  className="form__input"
                  value={quickProduction.itemKey}
                  onChange={(event) => {
                    const itemKey = event.target.value
                    const [productId, variantValue, lengthValue] = itemKey.split(':')
                    const length = lengthValue ? Number(lengthValue) : 0
                    const order = data.pedidos.find(
                      (item) => item.id === quickProduction.orderId,
                    )
                    const targetItem = order?.items.find(
                      (item) =>
                        item.productId === productId &&
                        (item.variantId ?? '') === variantValue &&
                        (item.customLength ?? 0) === length,
                    )
                    setQuickProduction((prev) => ({
                      ...prev,
                      itemKey,
                      quantity: targetItem?.quantity ?? prev.quantity,
                      customLength: targetItem?.customLength ?? 0,
                    }))
                  }}
                  disabled={!quickProduction.orderId}
                >
                  <option value="">Selecione</option>
                  {(data.pedidos.find((order) => order.id === quickProduction.orderId)?.items ??
                    []).map((item) => {
                    const lengthKey =
                      item.customLength && item.customLength > 0
                        ? item.customLength.toFixed(4)
                        : ''
                    const itemKey = `${item.productId}:${item.variantId ?? ''}:${lengthKey}`
                    return (
                      <option key={itemKey} value={itemKey}>
                        {getProductLabel(item.productId, item.variantId, item.customLength)}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="quick-production-qty">
                  Quantidade
                </label>
                <input
                  id="quick-production-qty"
                  className="form__input"
                  type="number"
                  min="1"
                  value={quickProduction.quantity}
                  onChange={(event) =>
                    setQuickProduction((prev) => ({
                      ...prev,
                      quantity: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="quick-production-date">
                Data planejada
              </label>
              <input
                id="quick-production-date"
                className="form__input"
                type="date"
                value={quickProduction.plannedAt}
                onChange={(event) =>
                  setQuickProduction((prev) => ({
                    ...prev,
                    plannedAt: event.target.value,
                  }))
                }
              />
            </div>
            {quickStatus && <div className="form__status">{quickStatus}</div>}
            <div className="form__actions">
              <button className="button button--primary" type="submit">
                Criar producao
              </button>
              <button className="button button--ghost" type="button" onClick={closeQuickAction}>
                Fechar
              </button>
            </div>
          </form>
        )}

        {quickAction === 'presenca' && (
          <div className="form">
            <p className="modal__description">
              Registro rapido de presenca entra na proxima etapa. Por enquanto, use o painel de
              funcionarios para apontar equipe.
            </p>
            <div className="form__actions">
              <button
                className="button button--primary"
                type="button"
                onClick={() => {
                  onNavigate?.('funcionarios')
                  closeQuickAction()
                }}
              >
                Ir para funcionarios
              </button>
              <button className="button button--ghost" type="button" onClick={closeQuickAction}>
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}

export default Dashboard
