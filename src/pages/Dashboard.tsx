import { useMemo } from 'react'
import { useERPData } from '../store/appStore'
import { formatCurrency, formatDateShort } from '../utils/format'

const Dashboard = () => {
  const { data } = useERPData()

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
    const now = new Date()
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
  }, [data.ordensProducao, data.pedidos])

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
    const entries = data.produtos.flatMap((product) =>
      (product.variants ?? []).map((variant) => ({
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        variantName: variant.name,
        stock: variant.stock ?? 0,
      })),
    )
    return entries
      .filter((entry) => entry.stock <= 5)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 4)
  }, [data.produtos])

  const getClientName = (id: string) =>
    data.clientes.find((client) => client.id === id)?.name ?? 'Cliente'

  const monthlyFlow = useMemo(() => {
    const now = new Date()
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
  }, [data.financeiro])


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

      <div className="dashboard__summary">
        <article className="dashboard__stat">
          <span className="dashboard__stat-label">Pedidos em aberto</span>
          <strong className="dashboard__stat-value">{openOrders}</strong>
        </article>
        <article className="dashboard__stat">
          <span className="dashboard__stat-label">Producao em andamento</span>
          <strong className="dashboard__stat-value">{inProduction}</strong>
        </article>
        <article className="dashboard__stat">
          <span className="dashboard__stat-label">Caixa atual</span>
          <strong className="dashboard__stat-value">{formatCurrency(cash)}</strong>
        </article>
        <article className="dashboard__stat">
          <span className="dashboard__stat-label">Producao do mes</span>
          <strong className="dashboard__stat-value">
            {formatCurrency(productionSummary.total)}
          </strong>
          <span className="dashboard__stat-meta">
            {productionSummary.count} ordens finalizadas
          </span>
        </article>
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
              <h2 className="dashboard__panel-title">Alertas rapidos</h2>
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
              <span className="dashboard__alert-title">Estoque baixo</span>
              <div className="dashboard__mini-list">
                {lowStock.length === 0 && (
                  <div className="dashboard__empty">Nenhum item abaixo do minimo.</div>
                )}
                {lowStock.map((entry) => (
                  <div key={`${entry.productId}-${entry.variantId}`} className="dashboard__mini-item">
                    <span>
                      {entry.productName}
                      {entry.variantName ? ` • ${entry.variantName}` : ''}
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
    </section>
  )
}

export default Dashboard
