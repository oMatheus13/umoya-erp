import { useMemo } from 'react'
import { Page, PageHeader } from '../../components/ui'
import { useERPData } from '../../store/appStore'
import { formatCurrency } from '../../utils/format'

const RelatoriosVendas = () => {
  const { data } = useERPData()

  const totals = useMemo(() => {
    const totalOrders = data.pedidos.length
    const totalValue = data.pedidos.reduce((acc, order) => acc + order.total, 0)
    const openOrders = data.pedidos.filter((order) => order.status !== 'entregue').length
    const ticket = totalOrders > 0 ? totalValue / totalOrders : 0
    return { totalOrders, totalValue, openOrders, ticket }
  }, [data.pedidos])

  const salesByClient = useMemo(() => {
    const totalsByClient = new Map<string, { name: string; total: number; orders: number }>()
    data.pedidos.forEach((order) => {
      const client = data.clientes.find((item) => item.id === order.clientId)
      const name = client?.name ?? 'Cliente'
      const existing = totalsByClient.get(order.clientId) ?? { name, total: 0, orders: 0 }
      existing.total += order.total
      existing.orders += 1
      totalsByClient.set(order.clientId, existing)
    })
    return [...totalsByClient.values()].sort((a, b) => b.total - a.total)
  }, [data.pedidos, data.clientes])

  const salesByObra = useMemo(() => {
    const totalsByObra = new Map<string, { label: string; total: number; orders: number }>()
    data.pedidos.forEach((order) => {
      if (!order.obraId) {
        return
      }
      const client = data.clientes.find((item) => item.id === order.clientId)
      const obra = client?.obras?.find((item) => item.id === order.obraId)
      const label = obra ? `${obra.name} · ${client?.name ?? 'Cliente'}` : 'Obra'
      const existing = totalsByObra.get(order.obraId) ?? { label, total: 0, orders: 0 }
      existing.total += order.total
      existing.orders += 1
      totalsByObra.set(order.obraId, existing)
    })
    return [...totalsByObra.values()].sort((a, b) => b.total - a.total)
  }, [data.pedidos, data.clientes])

  return (
    <Page className="relatorios">
      <PageHeader />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Pedidos</span>
          <span className="summary__value">{totals.totalOrders}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Receita total</span>
          <span className="summary__value">{formatCurrency(totals.totalValue)}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Ticket medio</span>
          <span className="summary__value">{formatCurrency(totals.ticket)}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Pedidos em aberto</span>
          <span className="summary__value">{totals.openOrders}</span>
        </article>
      </div>

      <div className="grid grid--three">
        <section className="panel">
          <h2 className="panel__title">Clientes com maior receita</h2>
          <div className="list">
            {salesByClient.length === 0 && (
              <div className="list__item">
                <span>Nenhum pedido registrado.</span>
                <strong>-</strong>
              </div>
            )}
            {salesByClient.slice(0, 5).map((client) => (
              <div key={client.name} className="list__item">
                <span>{client.name}</span>
                <strong>{formatCurrency(client.total)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2 className="panel__title">Obras mais ativas</h2>
          <div className="list">
            {salesByObra.length === 0 && (
              <div className="list__item">
                <span>Sem obras vinculadas.</span>
                <strong>-</strong>
              </div>
            )}
            {salesByObra.slice(0, 5).map((obra) => (
              <div key={obra.label} className="list__item">
                <span>{obra.label}</span>
                <strong>{formatCurrency(obra.total)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2 className="panel__title">Resumo rapido</h2>
          <div className="list">
            <div className="list__item">
              <span>Pedidos entregues</span>
              <strong>
                {data.pedidos.filter((order) => order.status === 'entregue').length}
              </strong>
            </div>
            <div className="list__item">
              <span>Pedidos pagos</span>
              <strong>{data.pedidos.filter((order) => order.status === 'pago').length}</strong>
            </div>
            <div className="list__item">
              <span>Pedidos em producao</span>
              <strong>
                {data.pedidos.filter((order) => order.status === 'em_producao').length}
              </strong>
            </div>
          </div>
        </section>
      </div>
    </Page>
  )
}

export default RelatoriosVendas
