import { useMemo } from 'react'
import { useERPData } from '../store/appStore'
import { formatCurrency, formatDateShort } from '../utils/format'

const Dashboard = () => {
  const { data } = useERPData()

  const openOrders = data.pedidos.filter((order) => order.status !== 'entregue').length
  const pendingQuotes = data.orcamentos.filter(
    (quote) => quote.status === 'rascunho' || quote.status === 'enviado',
  ).length
  const inProduction = data.ordensProducao.filter(
    (order) => order.status === 'em_producao',
  ).length

  const quoteStatusCounts = useMemo(() => {
    const counts = {
      rascunho: 0,
      enviado: 0,
      aprovado: 0,
      recusado: 0,
    }
    data.orcamentos.forEach((quote) => {
      counts[quote.status] += 1
    })
    return counts
  }, [data.orcamentos])

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

  const productionValue = useMemo(() => {
    const now = new Date()
    const finishedThisMonth = data.ordensProducao.filter((order) => {
      if (!order.finishedAt) {
        return false
      }
      const date = new Date(order.finishedAt)
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    })
    return finishedThisMonth.reduce((acc, order) => {
      const pedido = data.pedidos.find((item) => item.id === order.orderId)
      return acc + (pedido?.total ?? 0)
    }, 0)
  }, [data.ordensProducao, data.pedidos])

  const recentPayments = useMemo(
    () =>
      [...data.financeiro]
        .filter((entry) => entry.type === 'entrada')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 3),
    [data.financeiro],
  )

  const recentOrders = useMemo(
    () =>
      [...data.pedidos]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4),
    [data.pedidos],
  )

  const recentProductions = useMemo(
    () =>
      [...data.ordensProducao]
        .sort((a, b) => (b.plannedAt ?? '').localeCompare(a.plannedAt ?? ''))
        .slice(0, 4),
    [data.ordensProducao],
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
  const getProductName = (id: string) =>
    data.produtos.find((product) => product.id === id)?.name ?? 'Produto'

  const quoteStatusLabels = {
    rascunho: 'Rascunhos',
    enviado: 'Enviados',
    aprovado: 'Aprovados',
    recusado: 'Recusados',
  }

  return (
    <section className="dashboard">
      <div>
        <h1 className="dashboard__title">Visao Geral</h1>
        <p>Resumo rapido das operacoes e producao do mes.</p>
      </div>

      <div className="card-grid">
        <article className="card">
          <span className="card__label">Pedidos em aberto</span>
          <span className="card__value">{openOrders}</span>
        </article>
        <article className="card">
          <span className="card__label">Orcamentos pendentes</span>
          <span className="card__value">{pendingQuotes}</span>
        </article>
        <article className="card">
          <span className="card__label">Producao em andamento</span>
          <span className="card__value">{inProduction}</span>
        </article>
        <article className="card">
          <span className="card__label">Caixa atual</span>
          <span className="card__value">{formatCurrency(cash)}</span>
        </article>
      </div>

      <div className="grid">
        <section className="panel">
          <h2 className="panel__title">Pipeline de orcamentos</h2>
          <div className="list">
            {Object.entries(quoteStatusCounts).map(([key, value]) => (
              <div key={key} className="list__item">
                <span>{quoteStatusLabels[key as keyof typeof quoteStatusLabels]}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2 className="panel__title">Orcamentos vencendo</h2>
          <div className="list">
            {expiringQuotes.length === 0 && (
              <div className="list__item">
                <span>Nenhum orcamento vencendo nos proximos 7 dias.</span>
                <strong>-</strong>
              </div>
            )}
            {expiringQuotes.map((quote) => (
              <div key={quote.id} className="list__item">
                <span>{getClientName(quote.clientId)}</span>
                <strong>{formatDateShort(quote.validUntil)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid">
        <section className="panel">
          <h2 className="panel__title">Fluxo financeiro</h2>
          <div className="chart" role="img" aria-label="Grafico de linha" />
        </section>
        <section className="panel">
          <h2 className="panel__title">Pagamentos recentes</h2>
          <div className="list">
            {recentPayments.length === 0 && (
              <div className="list__item">
                <span>Nenhum pagamento registrado.</span>
                <strong>-</strong>
              </div>
            )}
            {recentPayments.map((entry) => (
              <div key={entry.id} className="list__item">
                <span>{entry.description}</span>
                <strong>{formatCurrency(entry.amount)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid">
        <section className="panel">
          <h2 className="panel__title">Pedidos recentes</h2>
          <div className="list">
            {recentOrders.length === 0 && (
              <div className="list__item">
                <span>Nenhum pedido criado.</span>
                <strong>-</strong>
              </div>
            )}
            {recentOrders.map((order) => (
              <div key={order.id} className="list__item">
                <span>{getClientName(order.clientId)}</span>
                <strong>{formatCurrency(order.total)}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2 className="panel__title">Estoque baixo</h2>
          <div className="list">
            {lowStock.length === 0 && (
              <div className="list__item">
                <span>Nenhum item abaixo do minimo.</span>
                <strong>-</strong>
              </div>
            )}
            {lowStock.map((entry) => (
              <div key={`${entry.productId}-${entry.variantId}`} className="list__item">
                <span>
                  {entry.productName}
                  {entry.variantName ? ` • ${entry.variantName}` : ''}
                </span>
                <strong>{entry.stock}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid">
        <section className="panel">
          <h2 className="panel__title">Producao recente</h2>
          <div className="list">
            {recentProductions.length === 0 && (
              <div className="list__item">
                <span>Nenhuma ordem em producao.</span>
                <strong>-</strong>
              </div>
            )}
            {recentProductions.map((production) => (
              <div key={production.id} className="list__item">
                <span>{getProductName(production.productId)}</span>
                <strong>{production.quantity}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2 className="panel__title">Producao do mes</h2>
          <div className="list">
            <div className="list__item">
              <span>Valor produzido</span>
              <strong>{formatCurrency(productionValue)}</strong>
            </div>
            <div className="list__item">
              <span>Ordens finalizadas</span>
              <strong>
                {data.ordensProducao.filter((order) => order.status === 'finalizada').length}
              </strong>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}

export default Dashboard
