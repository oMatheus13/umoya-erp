import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '../../components/Modal'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { EmployeeOccurrence } from '../../types/erp'
import { formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'

type OccurrenceForm = {
  employeeId: string
  date: string
  type: string
  description: string
  resolved: boolean
}

const createEmptyForm = (): OccurrenceForm => ({
  employeeId: '',
  date: new Date().toISOString().slice(0, 10),
  type: 'Atraso',
  description: '',
  resolved: false,
})

const RhOcorrencias = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<OccurrenceForm>(createEmptyForm())
  const occurrenceFormId = 'ocorrencia-form'

  const employees = useMemo(
    () => [...data.funcionarios].sort((a, b) => a.name.localeCompare(b.name)),
    [data.funcionarios],
  )
  const ocorrencias = useMemo(
    () => [...data.ocorrenciasRH].sort((a, b) => b.date.localeCompare(a.date)),
    [data.ocorrenciasRH],
  )

  const getEmployeeName = (id: string) =>
    employees.find((employee) => employee.id === id)?.name ?? '-'

  const openModal = () => {
    setStatus(null)
    setEditingId(null)
    setForm(createEmptyForm())
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingId(null)
  }

  const handleEdit = (entry: EmployeeOccurrence) => {
    setEditingId(entry.id)
    setForm({
      employeeId: entry.employeeId,
      date: entry.date,
      type: entry.type,
      description: entry.description,
      resolved: entry.resolved ?? false,
    })
    setIsModalOpen(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.employeeId) {
      setStatus('Selecione um funcionario.')
      return
    }
    if (!form.type.trim()) {
      setStatus('Informe o tipo da ocorrencia.')
      return
    }
    if (!form.description.trim()) {
      setStatus('Informe uma descricao.')
      return
    }

    const payload = dataService.getAll()
    const next: EmployeeOccurrence = {
      id: editingId ?? createId(),
      employeeId: form.employeeId,
      date: form.date,
      type: form.type.trim(),
      description: form.description.trim(),
      resolved: form.resolved,
      createdAt:
        payload.ocorrenciasRH.find((entry) => entry.id === editingId)?.createdAt ??
        new Date().toISOString(),
    }

    if (editingId) {
      payload.ocorrenciasRH = payload.ocorrenciasRH.map((entry) =>
        entry.id === editingId ? next : entry,
      )
    } else {
      payload.ocorrenciasRH = [...payload.ocorrenciasRH, next]
    }

    dataService.replaceAll(payload)
    refresh()
    setStatus(editingId ? 'Ocorrencia atualizada.' : 'Ocorrencia registrada.')
    setIsModalOpen(false)
  }

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.ocorrenciasRH = payload.ocorrenciasRH.filter((entry) => entry.id !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Ocorrencia removida.')
    setDeleteId(null)
  }

  return (
    <Page className="rh-page">
      <PageHeader
        actions={
          <button className="button button--primary" type="button" onClick={openModal}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              report
            </span>
            <span className="page-header__action-label">Registrar ocorrencia</span>
          </button>
        }
      />

      {status && <p className="form__status">{status}</p>}

      <section className="rh-page__panel">
        <div className="rh-page__panel-header">
          <div>
            <h2>Ocorrencias recentes</h2>
            <p>Historico por funcionario e data.</p>
          </div>
          <span className="rh-page__panel-meta">{ocorrencias.length} registros</span>
        </div>
        <div className="table-card rh-page__table">
          <table className="table">
            <thead>
              <tr>
                <th>Funcionario</th>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descricao</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {ocorrencias.length === 0 && (
                <tr>
                  <td colSpan={6} className="table__empty">
                    Nenhuma ocorrencia registrada ainda.
                  </td>
                </tr>
              )}
              {ocorrencias.map((entry) => (
                <tr key={entry.id}>
                  <td>{getEmployeeName(entry.employeeId)}</td>
                  <td>{formatDateShort(entry.date)}</td>
                  <td>{entry.type}</td>
                  <td>{entry.description}</td>
                  <td>{entry.resolved ? 'Resolvida' : 'Pendente'}</td>
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
        title={editingId ? 'Editar ocorrencia' : 'Registrar ocorrencia'}
        size="lg"
        actions={
          <button className="button button--primary" type="submit" form={occurrenceFormId}>
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              save
            </span>
            <span className="modal__action-label">Salvar</span>
          </button>
        }
      >
        <form id={occurrenceFormId} className="form" onSubmit={handleSubmit}>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="occ-employee">
                Funcionario
              </label>
              <select
                id="occ-employee"
                className="form__input"
                value={form.employeeId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, employeeId: event.target.value }))
                }
              >
                <option value="">Selecione</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="occ-date">
                Data
              </label>
              <input
                id="occ-date"
                className="form__input"
                type="date"
                value={form.date}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              />
            </div>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="occ-type">
              Tipo
            </label>
            <input
              id="occ-type"
              className="form__input"
              type="text"
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
              placeholder="Ex: Atraso, advertencia, acidente"
            />
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="occ-desc">
              Descricao
            </label>
            <textarea
              id="occ-desc"
              className="form__textarea"
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Descreva a ocorrencia"
            />
          </div>

          <label className="toggle form__checkbox">
            <input
              type="checkbox"
              checked={form.resolved}
              onChange={(event) => setForm((prev) => ({ ...prev, resolved: event.target.checked }))}
            />
            <span className="toggle__track" aria-hidden="true">
              <span className="toggle__thumb" />
            </span>
            <span className="toggle__label">Ocorrencia resolvida</span>
          </label>

        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir ocorrencia?"
        description="Este registro sera removido."
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </Page>
  )
}

export default RhOcorrencias
