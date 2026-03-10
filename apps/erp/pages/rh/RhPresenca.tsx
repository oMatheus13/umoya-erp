import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '@shared/components/Modal'
import { Page, PageHeader } from '@ui/components'
import { dataService } from '@shared/services/dataService'
import { useERPData } from '@shared/store/appStore'
import QuickNotice from '@shared/components/QuickNotice'
import type { PresenceEntry, PresenceLog, PresenceStatus } from '@shared/types/erp'
import { formatDateShort } from '@shared/utils/format'
import { createId } from '@shared/utils/ids'

type PresenceForm = {
  employeeId: string
  date: string
  status: PresenceStatus
  notes: string
}

const presenceOptions: { value: PresenceStatus; label: string }[] = [
  { value: 'presente', label: 'Presente' },
  { value: 'meio_periodo', label: 'Meio periodo' },
  { value: 'falta', label: 'Falta' },
  { value: 'ferias', label: 'Ferias' },
]

const presenceStatusStyles: Record<PresenceStatus, string> = {
  presente: 'badge--aprovado',
  meio_periodo: 'badge--pendente',
  falta: 'badge--recusado',
  ferias: 'badge--info',
}

const formatTime = (value?: string) => {
  if (!value) {
    return '-'
  }
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const createEmptyPresence = (): PresenceForm => ({
  employeeId: '',
  date: new Date().toISOString().slice(0, 10),
  status: 'presente',
  notes: '',
})

const RhPresenca = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<PresenceForm>(createEmptyPresence())
  const presenceFormId = 'presenca-form'

  const employees = useMemo(
    () => [...data.funcionarios].sort((a, b) => a.name.localeCompare(b.name)),
    [data.funcionarios],
  )
  const presencas = useMemo(
    () => [...data.presencas].sort((a, b) => b.date.localeCompare(a.date)),
    [data.presencas],
  )
  const presenceLogsByKey = useMemo(() => {
    const map = new Map<string, PresenceLog[]>()
    data.presenceLogs.forEach((entry) => {
      const date = entry.timestamp.slice(0, 10)
      const key = `${entry.employeeId}-${date}`
      const current = map.get(key) ?? []
      current.push(entry)
      map.set(key, current)
    })
    map.forEach((logs) => logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp)))
    return map
  }, [data.presenceLogs])

  const today = new Date().toISOString().slice(0, 10)
  const todayEntries = presencas.filter((entry) => entry.date === today)

  const summary = {
    total: todayEntries.length,
    presentes: todayEntries.filter((entry) => entry.status === 'presente').length,
    meio: todayEntries.filter((entry) => entry.status === 'meio_periodo').length,
    faltas: todayEntries.filter((entry) => entry.status === 'falta').length,
    ferias: todayEntries.filter((entry) => entry.status === 'ferias').length,
  }

  const getEmployeeName = (id: string) =>
    employees.find((employee) => employee.id === id)?.name ?? '-'
  const resolvePresenceTimes = (entry: PresenceEntry) => {
    const key = `${entry.employeeId}-${entry.date}`
    const logs = presenceLogsByKey.get(key) ?? []
    if (logs.length === 0) {
      return {
        inTime: '-',
        breakIn: '-',
        breakOut: '-',
        outTime: '-',
      }
    }
    const first = (type: PresenceLog['type']) =>
      logs.find((log) => log.type === type)
    const last = (type: PresenceLog['type']) =>
      [...logs].reverse().find((log) => log.type === type)
    return {
      inTime: formatTime(first('IN')?.timestamp),
      breakIn: formatTime(first('BREAK_IN')?.timestamp),
      breakOut: formatTime(last('BREAK_OUT')?.timestamp),
      outTime: formatTime(last('OUT')?.timestamp),
    }
  }

  const openModal = () => {
    setStatus(null)
    setEditingId(null)
    setForm(createEmptyPresence())
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setStatus(null)
    setEditingId(null)
  }

  const handleEdit = (entry: PresenceEntry) => {
    setEditingId(entry.id)
    setForm({
      employeeId: entry.employeeId,
      date: entry.date,
      status: entry.status,
      notes: entry.notes ?? '',
    })
    setIsModalOpen(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.employeeId) {
      setStatus('Selecione um funcionario.')
      return
    }
    if (!form.date) {
      setStatus('Informe a data.')
      return
    }

    const payload = dataService.getAll()
    const existingIndex = payload.presencas.findIndex(
      (entry) => entry.employeeId === form.employeeId && entry.date === form.date,
    )
    const next: PresenceEntry = {
      id: editingId ?? payload.presencas[existingIndex]?.id ?? createId(),
      employeeId: form.employeeId,
      date: form.date,
      status: form.status,
      notes: form.notes.trim() || undefined,
      createdAt: payload.presencas[existingIndex]?.createdAt ?? new Date().toISOString(),
    }

    if (editingId) {
      payload.presencas = payload.presencas.map((entry) => (entry.id === editingId ? next : entry))
    } else if (existingIndex >= 0) {
      payload.presencas = payload.presencas.map((entry, index) =>
        index === existingIndex ? next : entry,
      )
    } else {
      payload.presencas = [...payload.presencas, next]
    }

    dataService.replaceAll(payload)
    refresh()
    setStatus(editingId ? 'Presenca atualizada.' : 'Presenca registrada.')
    setIsModalOpen(false)
  }

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.presencas = payload.presencas.filter((entry) => entry.id !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setIsModalOpen(false)
    setStatus('Presenca removida.')
    setDeleteId(null)
  }

  return (
    <Page className="rh-page">
      <PageHeader
        actions={
          <button className="button button--primary" type="button" onClick={openModal}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              how_to_reg
            </span>
            <span className="page-header__action-label">Registrar presenca</span>
          </button>
        }
      />

      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Presencas hoje</span>
          <strong className="summary__value">{summary.total}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Presentes</span>
          <strong className="summary__value">{summary.presentes}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Meio periodo</span>
          <strong className="summary__value">{summary.meio}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Faltas</span>
          <strong className="summary__value">{summary.faltas}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Ferias</span>
          <strong className="summary__value">{summary.ferias}</strong>
        </article>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Registros recentes</h2>
            <p>Ultimas presencas registradas no sistema.</p>
          </div>
          <span className="panel__meta">{presencas.length} registros</span>
        </div>
        <div className="table-card">
          <table className="table">
            <thead className="table__head table__head--mobile-hide">
              <tr>
                <th>Funcionario</th>
                <th>Data</th>
                <th>Ponto</th>
                <th>Observacoes</th>
                <th className="table__actions table__actions--end">Status / Editar</th>
              </tr>
            </thead>
            <tbody>
              {presencas.length === 0 && (
                <tr>
                  <td colSpan={5} className="table__empty">
                    Nenhuma presenca registrada ainda.
                  </td>
                </tr>
              )}
              {presencas.map((entry) => {
                const times = resolvePresenceTimes(entry)
                const intervalLabel =
                  times.breakIn === '-' && times.breakOut === '-'
                    ? '-'
                    : `${times.breakIn} - ${times.breakOut}`
                return (
                  <tr key={entry.id}>
                    <td className="table__cell--truncate">
                      <div className="table__stack">
                        <strong>{getEmployeeName(entry.employeeId)}</strong>
                        <span className="table__sub table__sub--mobile">
                          {formatDateShort(entry.date)}
                        </span>
                        <span className="table__sub table__sub--mobile">
                          Ponto: {times.inTime} · Pausa: {intervalLabel} · Saida: {times.outTime}
                        </span>
                      </div>
                    </td>
                    <td className="table__cell--mobile-hide">{formatDateShort(entry.date)}</td>
                    <td className="table__cell--mobile-hide">
                      <div className="table__stack">
                        <span>Entrada: {times.inTime}</span>
                        <span>Pausa: {intervalLabel}</span>
                        <span>Saida: {times.outTime}</span>
                      </div>
                    </td>
                    <td className="table__cell--mobile-hide">{entry.notes ?? '-'}</td>
                    <td className="table__actions table__actions--end">
                      <div className="table__end">
                        <div className="table__status">
                          <span className={`badge ${presenceStatusStyles[entry.status]}`}>
                            {presenceOptions.find((item) => item.value === entry.status)?.label}
                          </span>
                        </div>
                        <ActionMenu
                          items={[
                            { label: 'Editar', onClick: () => handleEdit(entry) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar presenca' : 'Registrar presenca'}
        size="sm"
        actions={
          <>
            {editingId && (
              <button
                className="button button--danger"
                type="button"
                onClick={() => setDeleteId(editingId)}
              >
                <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                  delete
                </span>
                <span className="modal__action-label">Excluir</span>
              </button>
            )}
            <button className="button button--primary" type="submit" form={presenceFormId}>
              <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                save
              </span>
              <span className="modal__action-label">Salvar</span>
            </button>
          </>
        }
      >
        <form id={presenceFormId} className="modal__form" onSubmit={handleSubmit}>
          <div className="modal__group">
            <label className="modal__label" htmlFor="presence-employee">
              Funcionario
            </label>
            <select
              id="presence-employee"
              className="modal__input"
              value={form.employeeId}
              onChange={(event) => setForm((prev) => ({ ...prev, employeeId: event.target.value }))}
            >
              <option value="">Selecione</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="presence-date">
                Data
              </label>
              <input
                id="presence-date"
                className="modal__input"
                type="date"
                value={form.date}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="presence-status">
                Status
              </label>
              <select
                id="presence-status"
                className="modal__input"
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as PresenceStatus }))
                }
              >
                {presenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal__group">
            <label className="modal__label" htmlFor="presence-notes">
              Observacoes
            </label>
            <textarea
              id="presence-notes"
              className="modal__textarea"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Notas sobre a presenca"
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir presenca?"
        description="Este registro sera removido."
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </Page>
  )
}

export default RhPresenca
