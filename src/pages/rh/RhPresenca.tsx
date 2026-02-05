import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '../../components/Modal'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { PresenceEntry, PresenceStatus } from '../../types/erp'
import { formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'

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

      {status && <p className="form__status">{status}</p>}

      <div className="rh-page__summary summary-card">
        <article className="rh-page__stat">
          <span className="rh-page__stat-label">Presencas hoje</span>
          <strong className="rh-page__stat-value">{summary.total}</strong>
        </article>
        <article className="rh-page__stat">
          <span className="rh-page__stat-label">Presentes</span>
          <strong className="rh-page__stat-value">{summary.presentes}</strong>
        </article>
        <article className="rh-page__stat">
          <span className="rh-page__stat-label">Meio periodo</span>
          <strong className="rh-page__stat-value">{summary.meio}</strong>
        </article>
        <article className="rh-page__stat">
          <span className="rh-page__stat-label">Faltas</span>
          <strong className="rh-page__stat-value">{summary.faltas}</strong>
        </article>
        <article className="rh-page__stat">
          <span className="rh-page__stat-label">Ferias</span>
          <strong className="rh-page__stat-value">{summary.ferias}</strong>
        </article>
      </div>

      <section className="rh-page__panel">
        <div className="rh-page__panel-header">
          <div>
            <h2>Registros recentes</h2>
            <p>Ultimas presencas registradas no sistema.</p>
          </div>
          <span className="rh-page__panel-meta">{presencas.length} registros</span>
        </div>
        <div className="table-card rh-page__table">
          <table className="table">
            <thead>
              <tr>
                <th>Funcionario</th>
                <th>Data</th>
                <th>Status</th>
                <th>Observacoes</th>
                <th>Acoes</th>
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
              {presencas.map((entry) => (
                <tr key={entry.id}>
                  <td>{getEmployeeName(entry.employeeId)}</td>
                  <td>{formatDateShort(entry.date)}</td>
                  <td>{presenceOptions.find((item) => item.value === entry.status)?.label}</td>
                  <td>{entry.notes ?? '-'}</td>
                  <td className="table__actions">
                    <ActionMenu
                      items={[
                        { label: 'Editar', onClick: () => handleEdit(entry) },
                        {
                          label: 'Excluir',
                          onClick: () => setDeleteId(entry.id),
                          variant: 'danger',
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
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
          <button className="button button--primary" type="submit" form={presenceFormId}>
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              save
            </span>
            <span className="modal__action-label">Salvar</span>
          </button>
        }
      >
        <form id={presenceFormId} className="form" onSubmit={handleSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="presence-employee">
              Funcionario
            </label>
            <select
              id="presence-employee"
              className="form__input"
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
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="presence-date">
                Data
              </label>
              <input
                id="presence-date"
                className="form__input"
                type="date"
                value={form.date}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="presence-status">
                Status
              </label>
              <select
                id="presence-status"
                className="form__input"
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
          <div className="form__group">
            <label className="form__label" htmlFor="presence-notes">
              Observacoes
            </label>
            <textarea
              id="presence-notes"
              className="form__textarea"
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
