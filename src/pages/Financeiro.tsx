import { useMemo, useState, type FormEvent } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'
import type { FinanceEntry } from '../types/erp'
import { formatCurrency, formatDateShort } from '../utils/format'
import { createId } from '../utils/ids'

type FinanceForm = {
  type: FinanceEntry['type']
  description: string
  amount: number
  category: string
}

const Financeiro = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<FinanceForm>({
    type: 'saida',
    description: '',
    amount: 0,
    category: '',
  })

  const updateForm = (patch: Partial<FinanceForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const resetForm = () => {
    setForm({ type: 'saida', description: '', amount: 0, category: '' })
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setStatus(null)
    resetForm()
  }

  const openNewModal = () => {
    setStatus(null)
    resetForm()
    setIsModalOpen(true)
  }

  const entries = useMemo(
    () => [...data.financeiro].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.financeiro],
  )

  const now = new Date()
  const isSameMonth = (value: string) => {
    const date = new Date(value)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }

  const totalBalance = useMemo(
    () =>
      data.financeiro.reduce(
        (acc, entry) => acc + (entry.type === 'entrada' ? entry.amount : -entry.amount),
        0,
      ),
    [data.financeiro],
  )

  const monthEntries = useMemo(
    () => data.financeiro.filter((entry) => isSameMonth(entry.createdAt)),
    [data.financeiro],
  )

  const monthIn = monthEntries
    .filter((entry) => entry.type === 'entrada')
    .reduce((acc, entry) => acc + entry.amount, 0)
  const monthOut = monthEntries
    .filter((entry) => entry.type === 'saida')
    .reduce((acc, entry) => acc + entry.amount, 0)
  const monthBalance = monthIn - monthOut

  const entryToDelete = deleteId
    ? data.financeiro.find((entry) => entry.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.financeiro = payload.financeiro.filter((entry) => entry.id !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Lancamento excluido.')
    setDeleteId(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.description.trim()) {
      setStatus('Informe a descricao.')
      return
    }
    if (form.amount <= 0) {
      setStatus('Informe um valor maior que zero.')
      return
    }

    dataService.addFinanceEntry({
      id: createId(),
      type: form.type,
      description: form.description.trim(),
      amount: form.amount,
      category: form.category.trim() || undefined,
      createdAt: new Date().toISOString(),
    })
    refresh()
    setStatus('Lancamento registrado.')
    setIsModalOpen(false)
    resetForm()
  }

  return (
    <section className="financeiro">
      <header className="financeiro__header">
        <div className="financeiro__headline">
          <span className="financeiro__eyebrow">Financeiro</span>
          <h1 className="financeiro__title">Fluxo de caixa</h1>
          <p className="financeiro__subtitle">Controle entradas, saidas e saldo.</p>
        </div>
        <div className="financeiro__actions">
          <button className="button button--primary" type="button" onClick={openNewModal}>
            Novo lancamento
          </button>
        </div>
      </header>
      {status && <p className="form__status">{status}</p>}

      <div className="financeiro__summary">
        <article className="financeiro__stat">
          <span className="financeiro__stat-label">Caixa atual</span>
          <strong className="financeiro__stat-value">{formatCurrency(totalBalance)}</strong>
        </article>
        <article className="financeiro__stat">
          <span className="financeiro__stat-label">Entradas do mes</span>
          <strong className="financeiro__stat-value">{formatCurrency(monthIn)}</strong>
        </article>
        <article className="financeiro__stat">
          <span className="financeiro__stat-label">Saidas do mes</span>
          <strong className="financeiro__stat-value">{formatCurrency(monthOut)}</strong>
        </article>
        <article className="financeiro__stat">
          <span className="financeiro__stat-label">Saldo do mes</span>
          <strong className="financeiro__stat-value">{formatCurrency(monthBalance)}</strong>
        </article>
      </div>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title="Novo lancamento"
        size="lg"
      >
        <form className="form" onSubmit={handleSubmit}>
            <div className="form__group">
              <label className="form__label" htmlFor="finance-type">
                Tipo
              </label>
              <select
                id="finance-type"
                className="form__input"
                value={form.type}
                onChange={(event) =>
                  updateForm({ type: event.target.value as FinanceEntry['type'] })
                }
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saida</option>
              </select>
            </div>

            <div className="form__group">
              <label className="form__label" htmlFor="finance-description">
                Descricao
              </label>
              <input
                id="finance-description"
                className="form__input"
                type="text"
                value={form.description}
                onChange={(event) => updateForm({ description: event.target.value })}
                placeholder="Ex: Compra de material"
              />
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="finance-amount">
                  Valor
                </label>
                <input
                  id="finance-amount"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => updateForm({ amount: Number(event.target.value) })}
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="finance-category">
                  Categoria
                </label>
                <input
                  id="finance-category"
                  className="form__input"
                  type="text"
                  value={form.category}
                  onChange={(event) => updateForm({ category: event.target.value })}
                  placeholder="Materiais, manutencao..."
                />
              </div>
            </div>

            <div className="form__actions">
              <button className="button button--primary" type="submit">
                Registrar
              </button>
              <button className="button button--ghost" type="button" onClick={closeModal}>
                Cancelar
              </button>
            </div>
            {status && <p className="form__status">{status}</p>}
        </form>
      </Modal>

      <div className="financeiro__layout">
        <section className="financeiro__panel">
          <div className="financeiro__panel-header">
            <div>
              <h2>Ultimos lancamentos</h2>
              <p>Registros por categoria e impacto no saldo.</p>
            </div>
            <span className="financeiro__panel-meta">{entries.length} registros</span>
          </div>
          <div className="table-card financeiro__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descricao</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table__empty">
                      Nenhum lancamento registrado ainda.
                    </td>
                  </tr>
                )}
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateShort(entry.createdAt)}</td>
                    <td>{entry.description}</td>
                    <td>{entry.category ?? '-'}</td>
                    <td>
                      <span
                        className={`badge ${
                          entry.type === 'entrada' ? 'badge--entrada' : 'badge--saida'
                        }`}
                      >
                        {entry.type}
                      </span>
                    </td>
                    <td>{formatCurrency(entry.amount)}</td>
                    <td>
                      <button
                        className="button button--danger"
                        type="button"
                        onClick={() => setDeleteId(entry.id)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={!!deleteId}
        title="Excluir lancamento?"
        description={
          entryToDelete
            ? `${entryToDelete.description} sera removido do financeiro.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </section>
  )
}

export default Financeiro
