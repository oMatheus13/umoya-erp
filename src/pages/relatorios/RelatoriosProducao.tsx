import { useMemo } from 'react'
import { Page, PageHeader } from '../../components/ui'
import { useERPData } from '../../store/appStore'
import { formatDateShort } from '../../utils/format'
import { getProductUnitLabel } from '../../utils/units'

const RelatoriosProducao = () => {
  const { data } = useERPData()

  const productionSummary = useMemo(() => {
    return data.ordensProducao.reduce(
      (acc, order) => {
        acc.total += 1
        if (order.status === 'EM_ANDAMENTO' || order.status === 'PARCIAL') acc.active += 1
        if (order.status === 'CONCLUIDA') acc.done += 1
        return acc
      },
      { total: 0, active: 0, done: 0 },
    )
  }, [data.ordensProducao])

  const lotsSummary = useMemo(() => {
    return data.lotesProducao.reduce(
      (acc, lot) => {
        acc.total += 1
        if (lot.status !== 'pronto') acc.active += 1
        return acc
      },
      { total: 0, active: 0 },
    )
  }, [data.lotesProducao])

  const productionByProduct = useMemo(() => {
    const totals = new Map<
      string,
      { productId: string; name: string; unitLabel: string; total: number; active: number; done: number }
    >()
    data.ordensProducao.forEach((order) => {
      const product = data.produtos.find((item) => item.id === order.productId)
      if (!product) {
        return
      }
      const unitLabel = getProductUnitLabel(product.unit, data.tabelas)
      const length = product.unit === 'metro_linear'
        ? order.customLength ?? product.length ?? 1
        : 1
      const amount = order.quantity * length
      const existing = totals.get(product.id) ?? {
        productId: product.id,
        name: product.name,
        unitLabel,
        total: 0,
        active: 0,
        done: 0,
      }
      existing.total += amount
      if (order.status === 'EM_ANDAMENTO' || order.status === 'PARCIAL') {
        existing.active += amount
      }
      if (order.status === 'CONCLUIDA') {
        existing.done += amount
      }
      totals.set(product.id, existing)
    })
    return [...totals.values()].sort((a, b) => b.total - a.total)
  }, [data.ordensProducao, data.produtos, data.tabelas])

  const recentLots = useMemo(
    () => [...data.lotesProducao].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [data.lotesProducao],
  )

  const getProductName = (id: string) =>
    data.produtos.find((product) => product.id === id)?.name ?? 'Produto'

  return (
    <Page className="relatorios">
      <PageHeader />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Ordens</span>
          <span className="summary__value">{productionSummary.total}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Em andamento</span>
          <span className="summary__value">{productionSummary.active}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Concluidas</span>
          <span className="summary__value">{productionSummary.done}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Lotes ativos</span>
          <span className="summary__value">{lotsSummary.active}</span>
        </article>
      </div>

      <section className="panel">
        <h2 className="panel__title">Producao por produto</h2>
        <div className="table-card">
          <table className="table">
            <thead className="table__head table__head--mobile-hide">
              <tr>
                <th>Produto</th>
                <th>Unidade</th>
                <th>Total</th>
                <th>Em andamento</th>
                <th>Concluidas</th>
              </tr>
            </thead>
            <tbody>
              {productionByProduct.length === 0 ? (
                <tr>
                  <td className="table__empty" colSpan={5}>
                    Nenhuma ordem registrada.
                  </td>
                </tr>
              ) : (
                productionByProduct.map((row) => (
                  <tr key={row.productId}>
                    <td className="table__cell--truncate">
                      <div className="table__stack">
                        <strong>{row.name}</strong>
                        <span className="table__sub table__sub--mobile">
                          {row.total.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="table__cell--mobile-hide">{row.unitLabel}</td>
                    <td className="table__cell--mobile-hide">{row.total.toFixed(2)}</td>
                    <td className="table__cell--mobile-hide">{row.active.toFixed(2)}</td>
                    <td className="table__cell--mobile-hide">{row.done.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title">Lotes recentes</h2>
        <div className="list">
          {recentLots.length === 0 && (
            <div className="list__item">
              <span>Nenhum lote registrado.</span>
              <strong>-</strong>
            </div>
          )}
          {recentLots.map((lot) => (
            <div key={lot.id} className="list__item">
              <span>
                {getProductName(lot.productId)} · {lot.quantity} un
              </span>
              <strong>{formatDateShort(lot.createdAt)}</strong>
            </div>
          ))}
        </div>
      </section>
    </Page>
  )
}

export default RelatoriosProducao
