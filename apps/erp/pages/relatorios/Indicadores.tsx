import { useMemo } from 'react'
import { Page, PageHeader } from '@ui/components'
import { useERPData } from '@shared/store/appStore'
import { formatCurrency } from '@shared/utils/format'

const Indicadores = () => {
  const { data } = useERPData()

  const totalOrders = data.pedidos.length
  const totalClients = data.clientes.length
  const totalSuppliers = data.fornecedores.length
  const totalProducts = data.produtos.length
  const cash = data.financeiro.reduce(
    (acc, entry) => acc + (entry.type === 'entrada' ? entry.amount : -entry.amount),
    0,
  )

  const revenue = useMemo(
    () =>
      data.financeiro
        .filter((entry) => entry.type === 'entrada')
        .reduce((acc, entry) => acc + entry.amount, 0),
    [data.financeiro],
  )

  const topClients = useMemo(() => {
    const totals = new Map<string, number>()
    data.pedidos.forEach((order) => {
      totals.set(order.clientId, (totals.get(order.clientId) ?? 0) + order.total)
    })
    return [...totals.entries()]
      .map(([clientId, total]) => ({
        clientId,
        total,
        name: data.clientes.find((client) => client.id === clientId)?.name ?? 'Cliente',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
  }, [data.pedidos, data.clientes])

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

  return (
    <Page className="indicadores">
      <PageHeader />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Pedidos</span>
          <span className="summary__value">{totalOrders}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Clientes</span>
          <span className="summary__value">{totalClients}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Fornecedores</span>
          <span className="summary__value">{totalSuppliers}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Produtos</span>
          <span className="summary__value">{totalProducts}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Caixa atual</span>
          <span className="summary__value">{formatCurrency(cash)}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Faturamento</span>
          <span className="summary__value">{formatCurrency(revenue)}</span>
        </article>
      </div>

      <div className="grid">
        <section className="panel">
          <h2 className="panel__title">Top clientes</h2>
          <div className="list">
            {topClients.length === 0 && (
              <div className="list__item">
                <span>Nenhum pedido registrado.</span>
                <strong>-</strong>
              </div>
            )}
            {topClients.map((client) => (
              <div key={client.clientId} className="list__item">
                <span>{client.name}</span>
                <strong>{formatCurrency(client.total)}</strong>
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
    </Page>
  )
}

export default Indicadores
