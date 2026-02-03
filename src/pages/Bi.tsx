import { useMemo, useState } from 'react'
import { useERPData } from '../store/appStore'
import { formatCurrency } from '../utils/format'

type RangeOption = '7' | '30' | '90' | '180' | '365' | 'all'

const Bi = () => {
  const { data } = useERPData()
  const [range, setRange] = useState<RangeOption>('90')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pago' | 'entregue'>('todos')

  const startDate = useMemo(() => {
    if (range === 'all') {
      return null
    }
    const days = Number(range)
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date
  }, [range])

  const isInRange = (value: string) => {
    if (!startDate) {
      return true
    }
    return new Date(value) >= startDate
  }

  const filteredOrders = useMemo(
    () =>
      data.pedidos.filter((order) => {
        if (!isInRange(order.createdAt)) {
          return false
        }
        if (statusFilter === 'todos') {
          return true
        }
        return order.status === statusFilter
      }),
    [data.pedidos, startDate, statusFilter],
  )

  const filteredFinance = useMemo(
    () => data.financeiro.filter((entry) => isInRange(entry.createdAt)),
    [data.financeiro, startDate],
  )

  const revenue = filteredFinance
    .filter((entry) => entry.type === 'entrada')
    .reduce((acc, entry) => acc + entry.amount, 0)
  const expenses = filteredFinance
    .filter((entry) => entry.type === 'saida')
    .reduce((acc, entry) => acc + entry.amount, 0)
  const net = revenue - expenses

  const averageTicket = useMemo(() => {
    const paidOrders = filteredOrders.filter(
      (order) => order.status === 'pago' || order.status === 'entregue',
    )
    if (paidOrders.length === 0) {
      return 0
    }
    const total = paidOrders.reduce((acc, order) => acc + order.total, 0)
    return total / paidOrders.length
  }, [filteredOrders])

  const statusCounts = useMemo(() => {
    const counts = {
      aguardando_pagamento: 0,
      pago: 0,
      em_producao: 0,
      entregue: 0,
    }
    filteredOrders.forEach((order) => {
      counts[order.status] += 1
    })
    return counts
  }, [filteredOrders])

  const maxStatus = Math.max(
    1,
    ...Object.values(statusCounts).map((value) => Number(value)),
  )

  const monthlyRevenue = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      const label = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(
        date.getFullYear(),
      ).slice(-2)}`
      return { label, total: 0, key: `${date.getFullYear()}-${date.getMonth()}` }
    })

    filteredFinance
      .filter((entry) => entry.type === 'entrada')
      .forEach((entry) => {
        const date = new Date(entry.createdAt)
        const key = `${date.getFullYear()}-${date.getMonth()}`
        const target = months.find((month) => month.key === key)
        if (target) {
          target.total += entry.amount
        }
      })

    const maxValue = Math.max(1, ...months.map((month) => month.total))
    return { months, maxValue }
  }, [filteredFinance])

  const topProducts = useMemo(() => {
    const totals = new Map<string, number>()
    filteredOrders.forEach((order) => {
      const item = order.items[0]
      if (!item) {
        return
      }
      totals.set(item.productId, (totals.get(item.productId) ?? 0) + order.total)
    })
    return [...totals.entries()]
      .map(([productId, total]) => ({
        productId,
        total,
        name: data.produtos.find((product) => product.id === productId)?.name ?? 'Produto',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [filteredOrders, data.produtos])

  const topClients = useMemo(() => {
    const totals = new Map<string, number>()
    filteredOrders.forEach((order) => {
      totals.set(order.clientId, (totals.get(order.clientId) ?? 0) + order.total)
    })
    return [...totals.entries()]
      .map(([clientId, total]) => ({
        clientId,
        total,
        name: data.clientes.find((client) => client.id === clientId)?.name ?? 'Cliente',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [filteredOrders, data.clientes])

  return (
    <section className="bi">
      <header className="bi__header">
        <div className="bi__headline">
          <span className="bi__eyebrow">Inteligencia</span>
          <h1 className="bi__title">BI</h1>
          <p className="bi__subtitle">Analise o desempenho e as tendencias do negocio.</p>
        </div>
        <div className="bi__actions">
          <div className="bi__filters">
            <div className="bi__filter">
              <label className="form__label" htmlFor="bi-range">
                Periodo
              </label>
              <select
                id="bi-range"
                className="form__input"
                value={range}
                onChange={(event) => setRange(event.target.value as RangeOption)}
              >
                <option value="7">Ultimos 7 dias</option>
                <option value="30">Ultimos 30 dias</option>
                <option value="90">Ultimos 90 dias</option>
                <option value="180">Ultimos 6 meses</option>
                <option value="365">Ultimo ano</option>
                <option value="all">Tudo</option>
              </select>
            </div>
            <div className="bi__filter">
              <label className="form__label" htmlFor="bi-status">
                Status
              </label>
              <select
                id="bi-status"
                className="form__input"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as 'todos' | 'pago' | 'entregue')
                }
              >
                <option value="todos">Todos</option>
                <option value="pago">Pago</option>
                <option value="entregue">Entregue</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="bi__cards summary-card">
        <article className="card">
          <span className="card__label">Receita</span>
          <span className="card__value">{formatCurrency(revenue)}</span>
        </article>
        <article className="card">
          <span className="card__label">Despesas</span>
          <span className="card__value">{formatCurrency(expenses)}</span>
        </article>
        <article className="card">
          <span className="card__label">Resultado</span>
          <span className="card__value">{formatCurrency(net)}</span>
        </article>
        <article className="card">
          <span className="card__label">Ticket medio</span>
          <span className="card__value">{formatCurrency(averageTicket)}</span>
        </article>
      </div>

      <div className="bi__grid">
        <section className="panel">
          <h2 className="panel__title">Receita por mes</h2>
          <div className="bi__chart">
            {monthlyRevenue.months.map((month) => (
              <div key={month.label} className="bi__bar">
                <div
                  className="bi__bar-fill"
                  style={{ height: `${(month.total / monthlyRevenue.maxValue) * 100}%` }}
                />
                <span className="bi__bar-label">{month.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2 className="panel__title">Pedidos por status</h2>
          <div className="bi__rows">
            {Object.entries(statusCounts).map(([key, value]) => (
              <div key={key} className="bi__row">
                <span className="bi__row-label">{key.replace('_', ' ')}</span>
                <div className="bi__row-bar">
                  <span
                    className="bi__row-fill"
                    style={{ width: `${(value / maxStatus) * 100}%` }}
                  />
                </div>
                <strong className="bi__row-value">{value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="bi__tables">
        <section className="panel">
          <h2 className="panel__title">Top produtos</h2>
          <div className="table-card bi__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length === 0 && (
                  <tr>
                    <td colSpan={2} className="table__empty">
                      Sem dados suficientes no periodo selecionado.
                    </td>
                  </tr>
                )}
                {topProducts.map((product) => (
                  <tr key={product.productId}>
                    <td>{product.name}</td>
                    <td>{formatCurrency(product.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <h2 className="panel__title">Top clientes</h2>
          <div className="table-card bi__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {topClients.length === 0 && (
                  <tr>
                    <td colSpan={2} className="table__empty">
                      Sem dados suficientes no periodo selecionado.
                    </td>
                  </tr>
                )}
                {topClients.map((client) => (
                  <tr key={client.clientId}>
                    <td>{client.name}</td>
                    <td>{formatCurrency(client.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  )
}

export default Bi
