import { useMemo } from 'react'
import { Page, PageHeader } from '@ui/components'
import { useERPData } from '@shared/store/appStore'
import { formatCurrency, formatDateShort } from '@shared/utils/format'

type HistoryItem = {
  id: string
  date: string
  title: string
  description: string
}

const RhHistorico = () => {
  const { data } = useERPData()

  const employees = useMemo(
    () => [...data.funcionarios].sort((a, b) => a.name.localeCompare(b.name)),
    [data.funcionarios],
  )

  const historyItems = useMemo(() => {
    const items: HistoryItem[] = []
    data.funcionarios.forEach((employee) => {
      if (employee.hiredAt) {
        items.push({
          id: `hire-${employee.id}`,
          date: employee.hiredAt,
          title: employee.name,
          description: 'Admissao registrada',
        })
      }
      if (employee.active === false) {
        items.push({
          id: `inactive-${employee.id}`,
          date: new Date().toISOString().slice(0, 10),
          title: employee.name,
          description: 'Funcionario marcado como inativo',
        })
      }
    })

    data.presencas.forEach((entry) => {
      const employee = employees.find((item) => item.id === entry.employeeId)
      items.push({
        id: `presenca-${entry.id}`,
        date: entry.date,
        title: employee?.name ?? 'Funcionario',
        description: `Presenca: ${entry.status}`,
      })
    })

    data.pagamentosRH.forEach((entry) => {
      const employee = employees.find((item) => item.id === entry.employeeId)
      items.push({
        id: `pagamento-${entry.id}`,
        date: entry.periodEnd,
        title: employee?.name ?? 'Funcionario',
        description: `Pagamento ${entry.status} - ${formatCurrency(entry.total)}`,
      })
    })

    data.ocorrenciasRH.forEach((entry) => {
      const employee = employees.find((item) => item.id === entry.employeeId)
      items.push({
        id: `occ-${entry.id}`,
        date: entry.date,
        title: employee?.name ?? 'Funcionario',
        description: `Ocorrencia: ${entry.type}`,
      })
    })

    return items.sort((a, b) => b.date.localeCompare(a.date))
  }, [data.funcionarios, data.presencas, data.pagamentosRH, data.ocorrenciasRH, employees])

  return (
    <Page className="rh-page">
      <PageHeader />

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Eventos recentes</h2>
            <p>Admissoes, presencas, pagamentos e ocorrencias.</p>
          </div>
          <span className="panel__meta">{historyItems.length} eventos</span>
        </div>
        <div className="table-card">
          <table className="table">
            <thead className="table__head table__head--mobile-hide">
              <tr>
                <th>Funcionario</th>
                <th>Data</th>
                <th>Evento</th>
              </tr>
            </thead>
            <tbody>
              {historyItems.length === 0 && (
                <tr>
                  <td colSpan={3} className="table__empty">
                    Nenhum historico registrado ainda.
                  </td>
                </tr>
              )}
              {historyItems.map((item) => (
                <tr key={item.id}>
                  <td className="table__cell--truncate">
                    <div className="table__stack">
                      <strong>{item.title}</strong>
                      <span className="table__sub table__sub--mobile">
                        {formatDateShort(item.date)}
                      </span>
                      <span className="table__sub table__sub--mobile">{item.description}</span>
                    </div>
                  </td>
                  <td className="table__cell--mobile-hide">{formatDateShort(item.date)}</td>
                  <td className="table__cell--mobile-hide">{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  )
}

export default RhHistorico
