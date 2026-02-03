import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../components/ActionMenu'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'
import type { EmployeePayment, EmployeePaymentStatus } from '../types/erp'
import { formatCurrency, formatDateShort } from '../utils/format'
import { createId } from '../utils/ids'

type PaymentForm = {
  employeeId: string
  periodStart: string
  periodEnd: string
  baseValue: number
  extras: number
  discounts: number
  status: EmployeePaymentStatus
  method: string
  notes: string
}

const statusOptions: { value: EmployeePaymentStatus; label: string }[] = [
  { value: 'aberto', label: 'Em aberto' },
  { value: 'pago', label: 'Pago' },
  { value: 'cancelado', label: 'Cancelado' },
]

const createEmptyForm = (): PaymentForm => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    employeeId: '',
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    baseValue: 0,
    extras: 0,
    discounts: 0,
    status: 'aberto',
    method: 'a_definir',
    notes: '',
  }
}

const RhPagamentos = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<PaymentForm>(createEmptyForm())

  const employees = useMemo(
    () => [...data.funcionarios].sort((a, b) => a.name.localeCompare(b.name)),
    [data.funcionarios],
  )
  const pagamentos = useMemo(
    () => [...data.pagamentosRH].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
    [data.pagamentosRH],
  )

  const totalPago = pagamentos
    .filter((entry) => entry.status === 'pago')
    .reduce((acc, entry) => acc + entry.total, 0)
  const totalAberto = pagamentos
    .filter((entry) => entry.status === 'aberto')
    .reduce((acc, entry) => acc + entry.total, 0)

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

  const handleEdit = (entry: EmployeePayment) => {
    setEditingId(entry.id)
    setForm({
      employeeId: entry.employeeId,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      baseValue: entry.baseValue,
      extras: entry.extras,
      discounts: entry.discounts,
      status: entry.status,
      method: entry.method ?? 'a_definir',
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
    if (!form.periodStart || !form.periodEnd) {
      setStatus('Informe o periodo.')
      return
    }
    const total = form.baseValue + form.extras - form.discounts
    if (total < 0) {
      setStatus('O total nao pode ser negativo.')
      return
    }

    const payload = dataService.getAll()
    const next: EmployeePayment = {
      id: editingId ?? createId(),
      employeeId: form.employeeId,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      baseValue: form.baseValue,
      extras: form.extras,
      discounts: form.discounts,
      total,
      status: form.status,
      method: form.method || undefined,
      createdAt:
        payload.pagamentosRH.find((entry) => entry.id === editingId)?.createdAt ??
        new Date().toISOString(),
      paidAt: form.status === 'pago' ? new Date().toISOString() : undefined,
      notes: form.notes.trim() || undefined,
    }

    if (editingId) {
      payload.pagamentosRH = payload.pagamentosRH.map((entry) =>
        entry.id === editingId ? next : entry,
      )
    } else {
      payload.pagamentosRH = [...payload.pagamentosRH, next]
    }
    dataService.replaceAll(payload)
    refresh()
    setStatus(editingId ? 'Pagamento atualizado.' : 'Pagamento registrado.')
    setIsModalOpen(false)
  }

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.pagamentosRH = payload.pagamentosRH.filter((entry) => entry.id !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Pagamento removido.')
    setDeleteId(null)
  }

  return (
    <section className="rh-page">
      <header className="rh-page__header">
        <div className="rh-page__headline">
          <span className="rh-page__eyebrow">RH</span>
          <h1 className="rh-page__title">Pagamentos</h1>
          <p className="rh-page__subtitle">Controle de pagamentos da equipe e periodos.</p>
        </div>
        <div className="rh-page__actions">
          <button className="button button--primary" type="button" onClick={openModal}>
            Registrar pagamento
          </button>
        </div>
      </header>

      {status && <p className="form__status">{status}</p>}

      <div className="rh-page__summary summary-card">
        <article className="rh-page__stat">
          <span className="rh-page__stat-label">Pagamentos</span>
          <strong className="rh-page__stat-value">{pagamentos.length}</strong>
        </article>
        <article className="rh-page__stat">
          <span className="rh-page__stat-label">Total pago</span>
          <strong className="rh-page__stat-value">{formatCurrency(totalPago)}</strong>
        </article>
        <article className="rh-page__stat">
          <span className="rh-page__stat-label">Em aberto</span>
          <strong className="rh-page__stat-value">{formatCurrency(totalAberto)}</strong>
        </article>
      </div>

      <section className="rh-page__panel">
        <div className="rh-page__panel-header">
          <div>
            <h2>Pagamentos registrados</h2>
            <p>Historico de pagamentos por periodo.</p>
          </div>
          <span className="rh-page__panel-meta">{pagamentos.length} registros</span>
        </div>
        <div className="table-card rh-page__table">
          <table className="table">
            <thead>
              <tr>
                <th>Funcionario</th>
                <th>Periodo</th>
                <th>Total</th>
                <th>Status</th>
                <th>Metodo</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.length === 0 && (
                <tr>
                  <td colSpan={6} className="table__empty">
                    Nenhum pagamento registrado ainda.
                  </td>
                </tr>
              )}
              {pagamentos.map((entry) => (
                <tr key={entry.id}>
                  <td>{getEmployeeName(entry.employeeId)}</td>
                  <td>
                    {formatDateShort(entry.periodStart)} - {formatDateShort(entry.periodEnd)}
                  </td>
                  <td>{formatCurrency(entry.total)}</td>
                  <td>{statusOptions.find((item) => item.value === entry.status)?.label}</td>
                  <td>{entry.method ?? '-'}</td>
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
        title={editingId ? 'Editar pagamento' : 'Registrar pagamento'}
        size="lg"
      >
        <form className="form" onSubmit={handleSubmit}>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="pay-employee">
                Funcionario
              </label>
              <select
                id="pay-employee"
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
            <div className="form__group">
              <label className="form__label" htmlFor="pay-status">
                Status
              </label>
              <select
                id="pay-status"
                className="form__input"
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    status: event.target.value as EmployeePaymentStatus,
                  }))
                }
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="pay-start">
                Inicio
              </label>
              <input
                id="pay-start"
                className="form__input"
                type="date"
                value={form.periodStart}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, periodStart: event.target.value }))
                }
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="pay-end">
                Fim
              </label>
              <input
                id="pay-end"
                className="form__input"
                type="date"
                value={form.periodEnd}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, periodEnd: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="pay-base">
                Base (R$)
              </label>
              <input
                id="pay-base"
                className="form__input"
                type="number"
                min="0"
                step="0.01"
                value={form.baseValue}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, baseValue: Number(event.target.value) }))
                }
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="pay-extras">
                Extras (R$)
              </label>
              <input
                id="pay-extras"
                className="form__input"
                type="number"
                min="0"
                step="0.01"
                value={form.extras}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, extras: Number(event.target.value) }))
                }
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="pay-discounts">
                Descontos (R$)
              </label>
              <input
                id="pay-discounts"
                className="form__input"
                type="number"
                min="0"
                step="0.01"
                value={form.discounts}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, discounts: Number(event.target.value) }))
                }
              />
            </div>
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="pay-method">
                Metodo
              </label>
              <input
                id="pay-method"
                className="form__input"
                type="text"
                value={form.method}
                onChange={(event) => setForm((prev) => ({ ...prev, method: event.target.value }))}
                placeholder="Pix, dinheiro, transferencia"
              />
            </div>
            <div className="form__group">
              <label className="form__label">Total</label>
              <input
                className="form__input"
                type="text"
                value={formatCurrency(form.baseValue + form.extras - form.discounts)}
                disabled
              />
            </div>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="pay-notes">
              Observacoes
            </label>
            <textarea
              id="pay-notes"
              className="form__textarea"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Notas do pagamento"
            />
          </div>

          <div className="form__actions">
            <button className="button button--primary" type="submit">
              Salvar
            </button>
            <button className="button button--ghost" type="button" onClick={closeModal}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir pagamento?"
        description="Este registro sera removido."
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </section>
  )
}

export default RhPagamentos
