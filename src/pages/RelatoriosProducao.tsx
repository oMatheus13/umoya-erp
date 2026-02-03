import { useMemo } from 'react'
import { useERPData } from '../store/appStore'
import { formatDateShort } from '../utils/format'
import { getProductUnitLabel } from '../utils/units'

const RelatoriosProducao = () => {
  const { data } = useERPData()

  const productionSummary = useMemo(() => {
    return data.ordensProducao.reduce(
      (acc, order) => {
        acc.total += 1
        if (order.status === 'em_producao') acc.active += 1
        if (order.status === 'finalizada') acc.done += 1
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
      if (order.status === 'em_producao') {
        existing.active += amount
      }
      if (order.status === 'finalizada') {
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
    <section className="relatorios">
      <header className="relatorios__header">
        <div className="relatorios__headline">
          <span className="relatorios__eyebrow">Relatorios</span>
          <h1 className="relatorios__title">Producao por periodo</h1>
          <p className="relatorios__subtitle">
            Volume produzido, lotes ativos e andamento geral.
          </p>
        </div>
      </header>

      <div className="card-grid summary-card">
        <article className="card">
          <span className="card__label">Ordens</span>
          <span className="card__value">{productionSummary.total}</span>
        </article>
        <article className="card">
          <span className="card__label">Em producao</span>
          <span className="card__value">{productionSummary.active}</span>
        </article>
        <article className="card">
          <span className="card__label">Finalizadas</span>
          <span className="card__value">{productionSummary.done}</span>
        </article>
        <article className="card">
          <span className="card__label">Lotes ativos</span>
          <span className="card__value">{lotsSummary.active}</span>
        </article>
      </div>

      <div className="grid">
        <section className="panel">
          <h2 className="panel__title">Producao por produto</h2>
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Unidade</th>
                  <th>Total</th>
                  <th>Em producao</th>
                  <th>Finalizadas</th>
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
                      <td>{row.name}</td>
                      <td>{row.unitLabel}</td>
                      <td>{row.total.toFixed(2)}</td>
                      <td>{row.active.toFixed(2)}</td>
                      <td>{row.done.toFixed(2)}</td>
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
      </div>
    </section>
  )
}

export default RelatoriosProducao
