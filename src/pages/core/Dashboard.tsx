import { useMemo, useState } from 'react'
import Modal from '../../components/Modal'
import {
  List,
  ListItem,
  Page,
  PageHeader,
  Panel,
  Section,
  SectionHeader,
  Summary,
  SummaryItem,
} from '../../components/ui'
import { getPaymentMethodId, getPaymentMethodOptions } from '../../data/paymentMethods'
import { useERPData } from '../../store/appStore'
import { dataService } from '../../services/dataService'
import { createId } from '../../utils/ids'
import { formatCurrency, formatDateShort } from '../../utils/format'
import type { Order, ProductionOrder, Quote } from '../../types/erp'

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
  const paymentOptions = useMemo(
    () => getPaymentMethodOptions(data.tabelas?.paymentMethods),
    [data.tabelas?.paymentMethods],
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
    <Page>
      <PageHeader
        title="Painel"
        meta={
          <>
            <span>Atualizado</span>
            <strong>{formatDateShort(new Date().toISOString())}</strong>
          </>
        }
      />

      <div className="ui-grid ui-grid--2">
        <Section>
          <SectionHeader
            title="Resumo do dia"
            subtitle="Producao, financeiro e pendencias em um olhar."
          />
          <Summary>
            <SummaryItem label="Pedidos em aberto" value={openOrders} />
            <SummaryItem label="Producao em andamento" value={inProduction} />
            <SummaryItem label="Caixa atual" value={formatCurrency(cash)} />
            <SummaryItem
              label="Producao do mes"
              value={formatCurrency(productionSummary.total)}
              meta={`${productionSummary.count} ordens finalizadas`}
            />
            <SummaryItem label="Orcamentos pendentes" value={pendingQuotes} />
            <SummaryItem label="Pagamentos pendentes" value={pendingPayments} />
            <SummaryItem label="Ordens abertas" value={openProduction} />
            <SummaryItem
              label="Movimento de hoje"
              value={`${ordersToday} pedidos / ${formatCurrency(receiptsToday)}`}
            />
          </Summary>
        </Section>

        <Section>
          <SectionHeader title="Atalhos rapidos" subtitle="Crie operacoes sem perder contexto." />
          <div className="ui-action-grid">
            {quickActions.map((action) => (
              <button
                key={action.id}
                className="ui-action"
                type="button"
                onClick={() => openQuickAction(action.id)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {action.icon}
                </span>
                <span>
                  <strong className="ui-action__title">{action.title}</strong>
                  <span className="ui-action__meta">{action.description}</span>
                </span>
              </button>
            ))}
          </div>
        </Section>
      </div>

      <div className="ui-grid ui-grid--2">
        <Panel>
          <SectionHeader
            title="Fluxo financeiro"
            subtitle="Entradas vs saidas (6 meses)"
            actions={
              <div className="page-header__meta">
                <span>Entradas</span>
                <span>Saidas</span>
              </div>
            }
          />
          <div className="ui-chart" role="img" aria-label="Fluxo financeiro mensal">
            {monthlyFlow.months.map((month) => (
              <div key={month.label} className="ui-chart__group">
                <div className="ui-chart__bars">
                  <span
                    className="ui-chart__bar ui-chart__bar--in"
                    style={{ height: `${(month.in / monthlyFlow.maxValue) * 100}%` }}
                  />
                  <span
                    className="ui-chart__bar ui-chart__bar--out"
                    style={{ height: `${(month.out / monthlyFlow.maxValue) * 100}%` }}
                  />
                </div>
                <span className="ui-chart__label">{month.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="Alertas" subtitle="Itens que pedem atencao" />
          <div className="ui-grid ui-grid--3">
            <div>
              <span className="ui-summary__label">Orcamentos vencendo</span>
              <div className="ui-list">
                {expiringQuotes.length === 0 && (
                  <div className="ui-summary__meta">Nenhum orcamento nos proximos 7 dias.</div>
                )}
                {expiringQuotes.map((quote) => (
                  <div key={quote.id} className="ui-list__item">
                    <span className="ui-list__item-title">{getClientName(quote.clientId)}</span>
                    <strong className="ui-list__item-value">
                      {formatDateShort(quote.validUntil)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span className="ui-summary__label">Producao atrasada</span>
              <div className="ui-list">
                {delayedProduction.length === 0 && (
                  <div className="ui-summary__meta">Nenhuma ordem atrasada no momento.</div>
                )}
                {delayedProduction.map((entry) => (
                  <div key={entry.id} className="ui-list__item">
                    <span className="ui-list__item-title">
                      {getProductLabel(entry.productId, entry.variantId)}
                    </span>
                    <strong className="ui-list__item-value">{entry.days} dias</strong>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span className="ui-summary__label">Estoque baixo</span>
              <div className="ui-list">
                {lowStock.length === 0 && (
                  <div className="ui-summary__meta">Nenhum item abaixo do minimo.</div>
                )}
                {lowStock.map((entry) => (
                  <div key={`${entry.productId}-${entry.variantId}`} className="ui-list__item">
                    <span className="ui-list__item-title">
                      {entry.variantName
                        ? entry.variantLocked
                          ? `${entry.productName} ${entry.variantName}`
                          : `${entry.productName} • ${entry.variantName}`
                        : entry.productName}
                    </span>
                    <strong className="ui-list__item-value">{entry.stock}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="ui-grid ui-grid--2">
        <Panel>
          <SectionHeader title="Pedidos recentes" subtitle="Ultimas movimentacoes" />
          {recentOrders.length === 0 ? (
            <div className="ui-summary__meta">Nenhum pedido criado.</div>
          ) : (
            <List>
              {recentOrders.map((order) => (
                <ListItem
                  key={order.id}
                  title={getClientName(order.clientId)}
                  meta={`Pedido #${order.id.slice(-6)}`}
                  value={formatCurrency(order.total)}
                />
              ))}
            </List>
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Pagamentos recentes" subtitle="Entradas confirmadas" />
          {recentReceipts.length === 0 ? (
            <div className="ui-summary__meta">Nenhum pagamento registrado.</div>
          ) : (
            <List>
              {recentReceipts.map((receipt) => {
                const order = data.pedidos.find((item) => item.id === receipt.orderId)
                const clientName = order ? getClientName(order.clientId) : 'Cliente'
                return (
                  <ListItem
                    key={receipt.id}
                    title={clientName}
                    meta={`Pedido #${receipt.orderId.slice(-6)}`}
                    value={formatCurrency(receipt.amount)}
                  />
                )
              })}
            </List>
          )}
        </Panel>
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
              const clientName =
                availableClients.find((client) => client.id === quickQuote.clientId)?.name ??
                'Cliente'
              dataService.upsertQuote(quote, {
                auditEvent: {
                  category: 'acao',
                  title: 'Orcamento criado (atalho)',
                  description: `${clientName} · 1 item`,
                },
              })
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
                getPaymentMethodId(
                  quickOrder.paymentMethod,
                  data.tabelas?.paymentMethods,
                ) || quickOrder.paymentMethod
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
              const clientName =
                availableClients.find((client) => client.id === quickOrder.clientId)?.name ??
                'Cliente'
              dataService.upsertOrder(order, {
                auditEvent: {
                  category: 'acao',
                  title: 'Pedido criado (atalho)',
                  description: `${clientName} · 1 item`,
                },
              })
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
                    !paymentOptions.some((method) => method.id === quickOrder.paymentMethod) && (
                      <option value={quickOrder.paymentMethod}>
                        Outro ({quickOrder.paymentMethod})
                      </option>
                    )}
                  {paymentOptions.map((method) => (
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
    </Page>
  )
}

export default Dashboard
