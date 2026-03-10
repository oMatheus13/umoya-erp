import { useMemo } from 'react'
import { Page, PageHeader } from '@ui/components'
import { useERPData } from '@shared/store/appStore'
import { formatCurrency } from '@shared/utils/format'
import { getMaterialUnitLabel } from '@shared/utils/units'

const RelatoriosConsumo = () => {
  const { data } = useERPData()

  const consumos = useMemo(() => {
    const totals = new Map<
      string,
      { id: string; name: string; unit: string; total: number; cost: number }
    >()
    data.consumosMateriais.forEach((entry) => {
      const material = data.materiais.find((item) => item.id === entry.materialId)
      if (!material) {
        return
      }
      const unitLabel = getMaterialUnitLabel(material.unit, data.tabelas)
      const amount = entry.actual ?? entry.expected
      const cost = material.marketUnitPrice ? amount * material.marketUnitPrice : 0
      const existing = totals.get(material.id) ?? {
        id: material.id,
        name: material.name,
        unit: unitLabel,
        total: 0,
        cost: 0,
      }
      existing.total += amount
      existing.cost += cost
      totals.set(material.id, existing)
    })
    return [...totals.values()].sort((a, b) => b.total - a.total)
  }, [data.consumosMateriais, data.materiais, data.tabelas])

  const totals = useMemo(() => {
    const totalConsumed = consumos.reduce((acc, item) => acc + item.total, 0)
    const totalCost = consumos.reduce((acc, item) => acc + item.cost, 0)
    const lowStock = data.materiais.filter(
      (material) => material.minStock !== undefined && (material.stock ?? 0) <= material.minStock,
    ).length
    return { totalConsumed, totalCost, lowStock }
  }, [consumos, data.materiais])

  const lowStockMaterials = useMemo(
    () =>
      data.materiais
        .filter(
          (material) =>
            material.minStock !== undefined && (material.stock ?? 0) <= material.minStock,
        )
        .slice(0, 5),
    [data.materiais],
  )

  return (
    <Page className="relatorios">
      <PageHeader />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Registros</span>
          <span className="summary__value">{data.consumosMateriais.length}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Materiais diferentes</span>
          <span className="summary__value">{consumos.length}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Consumo total</span>
          <span className="summary__value">{totals.totalConsumed.toFixed(2)}</span>
        </article>
        <article className="summary__item">
          <span className="summary__label">Custo estimado</span>
          <span className="summary__value">{formatCurrency(totals.totalCost)}</span>
        </article>
      </div>

      <section className="panel">
        <h2 className="panel__title">Consumo por material</h2>
        <div className="table-card">
          <table className="table">
            <thead className="table__head table__head--mobile-hide">
              <tr>
                <th>Material</th>
                <th>Unidade</th>
                <th>Quantidade</th>
                <th>Custo</th>
              </tr>
            </thead>
            <tbody>
              {consumos.length === 0 ? (
                <tr>
                  <td className="table__empty" colSpan={4}>
                    Nenhum consumo registrado.
                  </td>
                </tr>
              ) : (
                consumos.map((item) => (
                  <tr key={item.id}>
                    <td className="table__cell--truncate">
                      <div className="table__stack">
                        <strong>{item.name}</strong>
                        <span className="table__sub table__sub--mobile">
                          {item.total.toFixed(2)} {item.unit}
                        </span>
                        <span className="table__sub table__sub--mobile">
                          {formatCurrency(item.cost)}
                        </span>
                      </div>
                    </td>
                    <td className="table__cell--mobile-hide">{item.unit}</td>
                    <td className="table__cell--mobile-hide">{item.total.toFixed(2)}</td>
                    <td className="table__cell--mobile-hide">{formatCurrency(item.cost)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2 className="panel__title">Alertas de estoque</h2>
          <span className="panel__meta">{totals.lowStock} alertas</span>
        </div>
        <div className="list list--compact list--soft">
          {lowStockMaterials.length === 0 && (
            <div className="list__item">
              <span>Sem alertas no momento.</span>
              <strong>-</strong>
            </div>
          )}
          {lowStockMaterials.map((material) => (
            <div key={material.id} className="list__item">
              <span>{material.name}</span>
              <strong>
                {(material.stock ?? 0).toFixed(2)} / {(material.minStock ?? 0).toFixed(2)}
              </strong>
            </div>
          ))}
        </div>
      </section>
    </Page>
  )
}

export default RelatoriosConsumo
