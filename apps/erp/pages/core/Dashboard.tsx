import { useMemo } from 'react'
import { Page, PageHeader } from '@ui/components'
import type { Product } from '@shared/types/erp'
import type { PageIntentAction } from '@shared/types/ui'
import { useERPData } from '@shared/store/appStore'
import { formatCurrency } from '@shared/utils/format'

type DashboardProps = {
  onNavigate?: (page: string, intent?: PageIntentAction) => void
}

type QuickAction = {
  id: string
  label: string
  page: string
  intent?: PageIntentAction
  icon: string
}

type Bottleneck = {
  name: string
  capacity: number
  produced: number
  status: string
}

type AlertTone = 'danger' | 'warning'

type ProductionSummary = {
  producedToday: number
  producedMonth: number
  capacityTotal: number
  bottleneck: Bottleneck | null
}

const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value)

const formatPercent = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)

const getMonthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`

const isSameDay = (value: string | undefined, dayKey: string) => {
  if (!value) {
    return false
  }
  return new Date(value).toDateString() === dayKey
}

const isSameMonth = (value: string | undefined, monthKey: string) => {
  if (!value) {
    return false
  }
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}` === monthKey
}

const getProductStock = (product: Product) => {
  const variants = product.variants ?? []
  const usesVariants = product.hasVariants ?? false
  const hasLinearVariants = product.unit === 'metro_linear' && variants.length > 0
  if (usesVariants || hasLinearVariants) {
    return variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0)
  }
  return product.stock ?? 0
}

const summarizeNames = (items: string[], limit = 3) => {
  if (items.length === 0) {
    return 'Nenhum'
  }
  const visible = items.slice(0, limit)
  const remaining = items.length - visible.length
  const list = visible.join(', ')
  return remaining > 0 ? `${list} +${formatNumber(remaining)}` : list
}

const summarizeWithCount = (items: string[], limit = 3) => {
  if (items.length === 0) {
    return 'Nenhum'
  }
  return `${formatNumber(items.length)} (${summarizeNames(items, limit)})`
}

const getValueToneClass = (value: number) => {
  if (value < 0) {
    return ' dashboard__metric-value--negative'
  }
  if (value > 0) {
    return ' dashboard__metric-value--positive'
  }
  return ''
}

const Dashboard = ({ onNavigate }: DashboardProps) => {
  const { data } = useERPData()
  const today = new Date()
  const todayKey = today.toDateString()
  const monthKey = getMonthKey(today)
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const previousMonthKey = getMonthKey(previousMonth)

  const quickActions: QuickAction[] = [
    {
      id: 'orcamentos',
      label: 'Novo Orçamento',
      page: 'orcamentos',
      intent: { type: 'new' },
      icon: 'request_quote',
    },
    {
      id: 'producao',
      label: 'Nova Ordem',
      page: 'producao',
      intent: { type: 'new' },
      icon: 'factory',
    },
    {
      id: 'compras',
      label: 'Registrar Compra',
      page: 'compras',
      intent: { type: 'new' },
      icon: 'shopping_cart',
    },
  ]

  const cashSummary = useMemo(() => {
    const balances = new Map<string, number>()
    data.caixas.forEach((cashbox) => {
      balances.set(cashbox.id, 0)
    })
    data.financeiro.forEach((entry) => {
      const current = balances.get(entry.cashboxId) ?? 0
      if (entry.type === 'entrada') {
        balances.set(entry.cashboxId, current + entry.amount)
        return
      }
      if (entry.type === 'saida') {
        balances.set(entry.cashboxId, current - entry.amount)
        return
      }
      if (entry.type === 'transferencia') {
        balances.set(entry.cashboxId, current - entry.amount)
        if (entry.transferToId) {
          const target = balances.get(entry.transferToId) ?? 0
          balances.set(entry.transferToId, target + entry.amount)
        }
      }
    })
    let totalBalance = 0
    balances.forEach((value) => {
      totalBalance += value
    })
    const bankBalance = balances.get('caixa_bancario') ?? 0
    const cashBalance = balances.get('caixa_fisico') ?? 0
    const reservedBalance =
      (balances.get('caixa_impostos') ?? 0) + (balances.get('caixa_reserva') ?? 0)
    const availableReal = totalBalance - reservedBalance
    return {
      balances,
      totalBalance,
      bankBalance,
      cashBalance,
      reservedBalance,
      availableReal,
    }
  }, [data.caixas, data.financeiro])

  const periodSummary = useMemo(() => {
    const monthEntries = data.financeiro.filter((entry) =>
      isSameMonth(entry.createdAt, monthKey),
    )
    const previousEntries = data.financeiro.filter((entry) =>
      isSameMonth(entry.createdAt, previousMonthKey),
    )
    const monthRevenue = monthEntries
      .filter((entry) => entry.type === 'entrada')
      .reduce((acc, entry) => acc + entry.amount, 0)
    const monthCost = monthEntries
      .filter((entry) => entry.type === 'saida')
      .reduce((acc, entry) => acc + entry.amount, 0)
    const grossProfit = monthRevenue - monthCost
    const margin = monthRevenue > 0 ? grossProfit / monthRevenue : 0
    const previousRevenue = previousEntries
      .filter((entry) => entry.type === 'entrada')
      .reduce((acc, entry) => acc + entry.amount, 0)
    const revenueDelta = monthRevenue - previousRevenue
    return { monthRevenue, monthCost, grossProfit, margin, previousRevenue, revenueDelta }
  }, [data.financeiro, monthKey, previousMonthKey])

  const salesSummary = useMemo(() => {
    const ordersToday = data.pedidos.filter((order) => isSameDay(order.createdAt, todayKey))
    const ordersMonth = data.pedidos.filter((order) => isSameMonth(order.createdAt, monthKey))
    const salesToday = ordersToday.reduce((acc, order) => acc + order.total, 0)
    const salesMonth = ordersMonth.reduce((acc, order) => acc + order.total, 0)
    const openOrders = data.pedidos.filter((order) => order.status !== 'entregue').length
    const pendingDeliveries = data.entregas.filter(
      (delivery) => delivery.status !== 'entregue',
    ).length

    const todayStart = new Date(todayKey)
    const overdueDeliveries = data.entregas.filter(
      (delivery) =>
        delivery.status !== 'entregue' &&
        delivery.scheduledAt &&
        new Date(delivery.scheduledAt) < todayStart,
    ).length

    const delinquentThreshold = new Date(todayStart)
    delinquentThreshold.setDate(delinquentThreshold.getDate() - 7)
    const delinquentOrders = data.pedidos.filter(
      (order) =>
        order.status === 'aguardando_pagamento' &&
        new Date(order.createdAt) < delinquentThreshold,
    ).length

    return {
      salesToday,
      salesMonth,
      openOrders,
      pendingDeliveries,
      overdueDeliveries,
      delinquentOrders,
    }
  }, [data.pedidos, data.entregas, todayKey, monthKey])

  const productionSummary = useMemo<ProductionSummary>(() => {
    const finishedToday = data.ordensProducao.filter((order) => {
      if (order.status !== 'CONCLUIDA') {
        return false
      }
      const date = order.finishedAt ?? order.plannedAt
      return isSameDay(date, todayKey)
    })
    let producedToday = 0
    const producedByMold = new Map<string, number>()
    finishedToday.forEach((order) => {
      producedToday += order.quantity
      if (order.moldId) {
        producedByMold.set(order.moldId, (producedByMold.get(order.moldId) ?? 0) + order.quantity)
      }
    })
    const producedMonth = data.ordensProducao
      .filter((order) => {
        if (order.status !== 'CONCLUIDA') {
          return false
        }
        const date = order.finishedAt ?? order.plannedAt
        return isSameMonth(date, monthKey)
      })
      .reduce((acc, order) => acc + order.quantity, 0)
    const capacityTotal = data.moldes.reduce((acc, mold) => acc + (mold.stock ?? 0), 0)
    let bottleneck: Bottleneck | null = null
    let bottleneckRatio = -1
    data.moldes.forEach((mold) => {
      const capacity = mold.stock ?? 0
      const produced = producedByMold.get(mold.id) ?? 0
      if (capacity <= 0 && produced <= 0) {
        return
      }
      const ratio = capacity > 0 ? produced / capacity : 0
      if (ratio > bottleneckRatio) {
        bottleneckRatio = ratio
        bottleneck = {
          name: mold.name,
          capacity,
          produced,
          status: ratio >= 1 ? 'no limite' : ratio >= 0.8 ? 'atenção' : 'ok',
        }
      }
    })
    return { producedToday, producedMonth, capacityTotal, bottleneck }
  }, [data.ordensProducao, data.moldes, todayKey, monthKey])

  const stockSummary = useMemo(() => {
    const materialsBelowMin = data.materiais
      .filter((material) => {
        if (typeof material.minStock !== 'number' || typeof material.stock !== 'number') {
          return false
        }
        return material.stock < material.minStock
      })
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))

    const productLastOrder = new Map<string, Date>()
    data.pedidos.forEach((order) => {
      const orderDate = new Date(order.createdAt)
      order.items.forEach((item) => {
        const current = productLastOrder.get(item.productId)
        if (!current || orderDate > current) {
          productLastOrder.set(item.productId, orderDate)
        }
      })
    })

    const idleThreshold = new Date(todayKey)
    idleThreshold.setDate(idleThreshold.getDate() - 30)

    const idleProducts = data.produtos
      .map((product) => {
        const stock = getProductStock(product)
        const lastOrder = productLastOrder.get(product.id)
        return { name: product.name, stock, lastOrder }
      })
      .filter((product) => product.stock > 0)
      .filter((product) => !product.lastOrder || product.lastOrder < idleThreshold)
      .sort((a, b) => {
        const aTime = a.lastOrder ? a.lastOrder.getTime() : 0
        const bTime = b.lastOrder ? b.lastOrder.getTime() : 0
        return aTime - bTime
      })

    const lowStockProducts = data.produtos
      .map((product) => ({ name: product.name, stock: getProductStock(product) }))
      .filter((product) => product.stock > 0 && product.stock <= 5)
      .sort((a, b) => a.stock - b.stock)

    const materialNames = materialsBelowMin.map((material) => material.name)
    const idleNames = idleProducts.map((product) => product.name)
    const lowStockNames = lowStockProducts.map((product) => product.name)
    const criticalCount = materialNames.length + idleNames.length + lowStockNames.length

    return {
      materialNames,
      idleNames,
      lowStockNames,
      criticalCount,
    }
  }, [data.materiais, data.produtos, data.pedidos, todayKey])

  const pendingFiscalCount = useMemo(
    () => data.fiscalNotas.filter((note) => note.status === 'pendente').length,
    [data.fiscalNotas],
  )

  const alertItems = useMemo(() => {
    const items: Array<{
      id: string
      label: string
      count: number
      page: string
      tone: AlertTone
    }> = [
      {
        id: 'cash-low',
        label: 'Caixa baixo',
        count: cashSummary.availableReal <= 0 ? 1 : 0,
        page: 'financeiro',
        tone: 'danger',
      },
      {
        id: 'taxes',
        label: 'Imposto a vencer',
        count: pendingFiscalCount,
        page: 'fiscal',
        tone: 'warning',
      },
      {
        id: 'overdue-orders',
        label: 'Pedido atrasado',
        count: salesSummary.overdueDeliveries,
        page: 'entregas',
        tone: 'danger',
      },
      {
        id: 'delinquent',
        label: 'Cliente inadimplente',
        count: salesSummary.delinquentOrders,
        page: 'pedidos',
        tone: 'danger',
      },
      {
        id: 'stock-critical',
        label: 'Estoque crítico',
        count: stockSummary.criticalCount,
        page: 'estoque',
        tone: 'warning',
      },
    ]
    return items.filter((item) => item.count > 0)
  }, [
    cashSummary.availableReal,
    pendingFiscalCount,
    salesSummary.overdueDeliveries,
    salesSummary.delinquentOrders,
    stockSummary.criticalCount,
  ])

  const handleQuickAction = (action: QuickAction) => {
    if (action.intent) {
      onNavigate?.(action.page, action.intent)
      return
    }
    onNavigate?.(action.page)
  }

  const showComparison =
    periodSummary.previousRevenue > 0 || periodSummary.monthRevenue > 0
  const comparisonSignal = periodSummary.revenueDelta >= 0 ? '↑' : '↓'
  const comparisonValue = formatCurrency(Math.abs(periodSummary.revenueDelta))
  const comparisonClass =
    periodSummary.revenueDelta < 0 ? ' dashboard__comparison--down' : ' dashboard__comparison--up'
  const availableRealClass =
    cashSummary.availableReal <= 0 ? ' dashboard__metric-value--negative' : ''
  const grossProfitClass = getValueToneClass(periodSummary.grossProfit)
  const marginClass = getValueToneClass(periodSummary.margin)
  const materialAlert = stockSummary.materialNames.length > 0
  const idleAlert = stockSummary.idleNames.length > 0
  const lowStockAlert = stockSummary.lowStockNames.length > 0

  return (
    <Page>
      <PageHeader
        actions={quickActions.map((action) => (
          <button
            key={action.id}
            className="button button--primary dashboard__quick-action"
            type="button"
            onClick={() => handleQuickAction(action)}
            aria-label={action.label}
          >
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              {action.icon}
            </span>
            <span className="page-header__action-label">{action.label}</span>
          </button>
        ))}
      />

      <section className="dashboard">
        <section className="dashboard__section dashboard__section--cash">
          <header className="dashboard__section-header">
            <h2 className="dashboard__section-title">Caixa</h2>
          </header>
        <dl className="dashboard__metrics dashboard__metrics--pairs">
          <div className="dashboard__metric dashboard__metric--no-divider">
            <dt className="dashboard__metric-label">No Banco</dt>
            <dd className="dashboard__metric-value">
              <strong>{formatCurrency(cashSummary.bankBalance)}</strong>
            </dd>
          </div>
          <div className="dashboard__metric dashboard__metric--no-divider">
            <dt className="dashboard__metric-label">Em Espécie</dt>
            <dd className="dashboard__metric-value">
              <strong>{formatCurrency(cashSummary.cashBalance)}</strong>
            </dd>
          </div>
          <div className="dashboard__metric">
            <dt className="dashboard__metric-label">Total em caixa</dt>
            <dd className="dashboard__metric-value">
              <strong>{formatCurrency(cashSummary.totalBalance)}</strong>
            </dd>
          </div>
          <div className="dashboard__metric">
            <dt className="dashboard__metric-label">Disponível real</dt>
            <dd className={`dashboard__metric-value${availableRealClass}`}>
              <strong>{formatCurrency(cashSummary.availableReal)}</strong>
            </dd>
          </div>
          <div className="dashboard__metric dashboard__metric--full">
            <dt className="dashboard__metric-label">Reservado (imposto + reserva)</dt>
            <dd className="dashboard__metric-value">
              <strong>{formatCurrency(cashSummary.reservedBalance)}</strong>
            </dd>
          </div>
        </dl>
      </section>

        <section className="dashboard__section dashboard__section--period">
          <header className="dashboard__section-header">
            <h2 className="dashboard__section-title">Resultado do período</h2>
          </header>
        <dl className="dashboard__metrics dashboard__metrics--pairs">
          <div className="dashboard__metric dashboard__metric--full">
            <dt className="dashboard__metric-label">Faturamento do mês</dt>
            <dd className="dashboard__metric-value">
              <strong>{formatCurrency(periodSummary.monthRevenue)}</strong>
            </dd>
          </div>
          <div className="dashboard__metric dashboard__metric--full">
            <dt className="dashboard__metric-label">Custo total</dt>
            <dd className="dashboard__metric-value">
              <strong>{formatCurrency(periodSummary.monthCost)}</strong>
            </dd>
          </div>
          <div className="dashboard__metric">
            <dt className="dashboard__metric-label">Lucro bruto</dt>
            <dd className={`dashboard__metric-value${grossProfitClass}`}>
              <strong>{formatCurrency(periodSummary.grossProfit)}</strong>
            </dd>
          </div>
          <div className="dashboard__metric">
            <dt className="dashboard__metric-label">Margem</dt>
            <dd className={`dashboard__metric-value${marginClass}`}>
              <strong>{formatPercent(periodSummary.margin * 100)}%</strong>
            </dd>
          </div>
        </dl>
        {showComparison && (
          <p className={`dashboard__comparison${comparisonClass}`}>
            Comparação com mês anterior: {comparisonSignal} {comparisonValue}
          </p>
        )}
        </section>

        <section className="dashboard__section dashboard__section--sales">
          <header className="dashboard__section-header">
            <h2 className="dashboard__section-title">Vendas e pedidos</h2>
          </header>
        <dl className="dashboard__metrics dashboard__metrics--pairs">
          <div className="dashboard__metric dashboard__metric--no-divider">
            <dt className="dashboard__metric-label">Vendas hoje</dt>
            <dd className="dashboard__metric-value">
              <strong>{formatCurrency(salesSummary.salesToday)}</strong>
            </dd>
          </div>
          <div className="dashboard__metric dashboard__metric--no-divider">
            <dt className="dashboard__metric-label">Vendas no mês</dt>
            <dd className="dashboard__metric-value">
              <strong>{formatCurrency(salesSummary.salesMonth)}</strong>
            </dd>
          </div>
            <div className="dashboard__metric">
              <dt className="dashboard__metric-label">Pedidos em aberto</dt>
              <dd className="dashboard__metric-value">
                <strong>{formatNumber(salesSummary.openOrders)}</strong>
              </dd>
            </div>
            <div className="dashboard__metric">
              <dt className="dashboard__metric-label">Encomendas</dt>
              <dd className="dashboard__metric-value">
                <strong>{formatNumber(salesSummary.pendingDeliveries)}</strong>
              </dd>
            </div>
          </dl>
        </section>

        <section className="dashboard__section dashboard__section--production">
          <header className="dashboard__section-header">
            <h2 className="dashboard__section-title">Produção e gargalos</h2>
          </header>
        <dl className="dashboard__metrics dashboard__metrics--pairs">
          <div className="dashboard__metric dashboard__metric--no-divider">
            <dt className="dashboard__metric-label">Produção do dia</dt>
            <dd className="dashboard__metric-value">
              <strong>{formatNumber(productionSummary.producedToday)}</strong>
            </dd>
          </div>
          <div className="dashboard__metric dashboard__metric--no-divider">
            <dt className="dashboard__metric-label">Produção do mês</dt>
            <dd className="dashboard__metric-value">
              <strong>{formatNumber(productionSummary.producedMonth)}</strong>
            </dd>
          </div>
          <div className="dashboard__metric dashboard__metric--full">
            <dt className="dashboard__metric-label">Capacidade vs realizado</dt>
            <dd className="dashboard__metric-value">
              <strong>
                {formatNumber(productionSummary.capacityTotal)} x{' '}
                {formatNumber(productionSummary.producedToday)}
              </strong>
            </dd>
          </div>
          <div className="dashboard__metric dashboard__metric--full">
            <dt className="dashboard__metric-label">Gargalo atual</dt>
            <dd className="dashboard__metric-value">
              {productionSummary.bottleneck ? (
                  <strong>
                    {productionSummary.bottleneck.name}: capacidade{' '}
                    {formatNumber(productionSummary.bottleneck.capacity)}/dia, produzido hoje{' '}
                    {formatNumber(productionSummary.bottleneck.produced)}, status{' '}
                    {productionSummary.bottleneck.status}
                  </strong>
                ) : (
                  <strong>Sem gargalo crítico registrado.</strong>
                )}
              </dd>
            </div>
          </dl>
        </section>

      <section className="dashboard__section dashboard__section--stock">
        <header className="dashboard__section-header">
          <h2 className="dashboard__section-title">Estoque crítico</h2>
        </header>
        <ul className="dashboard__list">
          <li
            className={`dashboard__list-item${
              materialAlert ? ' dashboard__list-item--alert' : ''
            }`}
          >
            Matéria-prima abaixo do mínimo: {summarizeWithCount(stockSummary.materialNames)}
          </li>
          <li
            className={`dashboard__list-item${idleAlert ? ' dashboard__list-item--alert' : ''}`}
          >
            Produto pronto parado demais: {summarizeWithCount(stockSummary.idleNames)}
          </li>
          <li
            className={`dashboard__list-item${
              lowStockAlert ? ' dashboard__list-item--alert' : ''
            }`}
          >
            Itens que vão faltar em breve: {summarizeWithCount(stockSummary.lowStockNames)}
          </li>
        </ul>
      </section>

        <section className="dashboard__section dashboard__section--alerts">
          <header className="dashboard__section-header">
            <h2 className="dashboard__section-title">Alertas e ações</h2>
          </header>
        {alertItems.length > 0 ? (
          <ul className="dashboard__alerts">
            {alertItems.map((alert) => (
              <li key={alert.id} className={`dashboard__alert dashboard__alert--${alert.tone}`}>
                <button
                  className="button button--ghost dashboard__alert-button"
                  type="button"
                  onClick={() => onNavigate?.(alert.page)}
                  >
                    {alert.label} ({formatNumber(alert.count)})
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard__empty">Nenhum alerta crítico no momento.</p>
          )}
        </section>
      </section>
    </Page>
  )
}

export default Dashboard
