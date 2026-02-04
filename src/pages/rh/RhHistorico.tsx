import { useMemo } from 'react'
import { Page, PageHeader } from '../../components/ui'
import { useERPData } from '../../store/appStore'
import { formatCurrency, formatDateShort } from '../../utils/format'

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
      <PageHeader title="Historico" />

      <section className="rh-page__panel">
        <div className="rh-page__panel-header">
          <div>
            <h2>Eventos recentes</h2>
            <p>Admissoes, presencas, pagamentos e ocorrencias.</p>
          </div>
          <span className="rh-page__panel-meta">{historyItems.length} eventos</span>
        </div>
        <div className="table-card rh-page__table">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Funcionario</th>
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
                  <td>{formatDateShort(item.date)}</td>
                  <td>{item.title}</td>
                  <td>{item.description}</td>
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
