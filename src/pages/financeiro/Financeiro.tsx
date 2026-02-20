import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import CurrencyInput from '../../components/CurrencyInput'
import Modal from '../../components/Modal'
import QuickNotice from '../../components/QuickNotice'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { FinanceEntry } from '../../types/erp'
import { formatCurrency, formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'

type FinanceForm = {
  type: FinanceEntry['type']
  description: string
  amount: number
  category: string
  cashboxId: string
  transferToId: string
}

const Financeiro = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [cashCheckDate, setCashCheckDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [cashOpening, setCashOpening] = useState(0)
  const [cashActual, setCashActual] = useState(0)
  const [cashNotes, setCashNotes] = useState('')
  const [form, setForm] = useState<FinanceForm>({
    type: 'saida',
    description: '',
    amount: 0,
    category: '',
    cashboxId: 'caixa_operacional',
    transferToId: '',
  })
  const financeFormId = 'financeiro-form'

  const updateForm = (patch: Partial<FinanceForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const resetForm = () => {
    setForm({
      type: 'saida',
      description: '',
      amount: 0,
      category: '',
      cashboxId: 'caixa_operacional',
      transferToId: '',
    })
    setEditingId(null)
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

  const handleEdit = (entry: FinanceEntry) => {
    setEditingId(entry.id)
    setForm({
      type: entry.type,
      description: entry.description,
      amount: entry.amount,
      category: entry.category ?? '',
      cashboxId: entry.cashboxId,
      transferToId: entry.transferToId ?? '',
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const entries = useMemo(
    () => [...data.financeiro].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.financeiro],
  )
  const cashboxes = useMemo(() => data.caixas, [data.caixas])
  const cashboxMap = useMemo(
    () => new Map(cashboxes.map((cashbox) => [cashbox.id, cashbox])),
    [cashboxes],
  )

  const now = new Date()
  const isSameMonth = (value: string) => {
    const date = new Date(value)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }

  const isSameDay = (value: string, target: string) =>
    value.slice(0, 10) === target

  const getCashboxName = (id: string) => cashboxMap.get(id)?.name ?? 'Caixa'

  const cashEntriesByDate = useMemo(
    () =>
      data.financeiro.filter((entry) => isSameDay(entry.createdAt, cashCheckDate)),
    [cashCheckDate, data.financeiro],
  )

  const cashIn = cashEntriesByDate
    .filter(
      (entry) =>
        (entry.type === 'entrada' && entry.cashboxId === 'caixa_fisico') ||
        (entry.type === 'transferencia' && entry.transferToId === 'caixa_fisico'),
    )
    .reduce((acc, entry) => acc + entry.amount, 0)

  const cashOut = cashEntriesByDate
    .filter(
      (entry) =>
        (entry.type === 'saida' && entry.cashboxId === 'caixa_fisico') ||
        (entry.type === 'transferencia' && entry.cashboxId === 'caixa_fisico'),
    )
    .reduce((acc, entry) => acc + entry.amount, 0)

  const cashClosing = cashOpening + cashIn - cashOut
  const cashDiff = cashActual - cashClosing

  const cashboxBalances = useMemo(() => {
    const balances = new Map<string, number>()
    cashboxes.forEach((cashbox) => {
      balances.set(cashbox.id, 0)
    })
    data.financeiro.forEach((entry) => {
      const current = balances.get(entry.cashboxId) ?? 0
      if (entry.type === 'entrada') {
        balances.set(entry.cashboxId, current + entry.amount)
        return
      }
      if (entry.type === 'saida') {
        balances.set(entry.cashboxId, current - entry.amount)
        return
      }
      if (entry.type === 'transferencia') {
        balances.set(entry.cashboxId, current - entry.amount)
        if (entry.transferToId) {
          const target = balances.get(entry.transferToId) ?? 0
          balances.set(entry.transferToId, target + entry.amount)
        }
      }
    })
    return balances
  }, [cashboxes, data.financeiro])

  const totalBalance = useMemo(() => {
    let total = 0
    cashboxBalances.forEach((value) => {
      total += value
    })
    return total
  }, [cashboxBalances])

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
  const monthTransfers = monthEntries
    .filter((entry) => entry.type === 'transferencia')
    .reduce((acc, entry) => acc + entry.amount, 0)
  const monthBalance = monthIn - monthOut

  const bankBalance = cashboxBalances.get('caixa_bancario') ?? 0
  const cashBalance = cashboxBalances.get('caixa_fisico') ?? 0
  const operationalBalance = cashboxBalances.get('caixa_operacional') ?? 0
  const cashChecks = data.conferenciasCaixaFisico.slice(0, 5)

  const entryToDelete = deleteId
    ? data.financeiro.find((entry) => entry.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.financeiro = payload.financeiro.filter((entry) => entry.id !== deleteId)
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Lancamento removido',
        description: entryToDelete?.description,
      },
    })
    refresh()
    setIsModalOpen(false)
    resetForm()
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
    if (!form.cashboxId) {
      setStatus('Selecione o caixa de origem.')
      return
    }
    if (form.type === 'transferencia') {
      if (!form.transferToId) {
        setStatus('Selecione o caixa de destino.')
        return
      }
      if (form.transferToId === form.cashboxId) {
        setStatus('Escolha caixas diferentes para transferir.')
        return
      }
    }

    const entryTitle =
      form.type === 'entrada'
        ? 'Entrada registrada'
        : form.type === 'transferencia'
          ? 'Transferencia registrada'
          : 'Saida registrada'

    const payload = dataService.getAll()
    const existingEntry = editingId
      ? payload.financeiro.find((entry) => entry.id === editingId)
      : undefined
    const next: FinanceEntry = {
      id: editingId ?? createId(),
      type: form.type,
      description: form.description.trim(),
      amount: form.amount,
      category: form.category.trim() || undefined,
      createdAt: existingEntry?.createdAt ?? new Date().toISOString(),
      cashboxId: form.cashboxId,
      transferToId: form.type === 'transferencia' ? form.transferToId : undefined,
    }

    if (editingId) {
      payload.financeiro = payload.financeiro.map((entry) =>
        entry.id === editingId ? next : entry,
      )
    } else {
      payload.financeiro = [...payload.financeiro, next]
    }

    dataService.replaceAll(payload, {
      auditEvent: {
        category: editingId ? 'alteracao' : 'acao',
        title: editingId ? 'Lancamento atualizado' : entryTitle,
        description: `${next.description} · ${formatCurrency(next.amount)}`,
      },
    })
    refresh()
    setStatus(editingId ? 'Lancamento atualizado.' : 'Lancamento registrado.')
    setIsModalOpen(false)
    resetForm()
  }

  const handleSaveCashCheck = () => {
    if (!cashCheckDate) {
      setStatus('Informe a data da conferencia.')
      return
    }
    const payload = dataService.getAll()
    payload.conferenciasCaixaFisico = [
      {
        id: createId(),
        date: cashCheckDate,
        opening: cashOpening,
        cashIn,
        cashOut,
        closing: cashClosing,
        actual: cashActual,
        notes: cashNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
      },
      ...payload.conferenciasCaixaFisico,
    ]
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Conferencia de caixa fisico',
        description: cashCheckDate,
      },
    })
    refresh()
    setStatus('Conferencia do caixa fisico salva.')
  }

  return (
    <Page className="financeiro">
      <PageHeader
        actions={
          <button className="button button--primary" type="button" onClick={openNewModal}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              add
            </span>
            <span className="page-header__action-label">Novo lancamento</span>
          </button>
        }
      />
      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Saldo total</span>
          <strong className="summary__value">{formatCurrency(totalBalance)}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Entradas do mes</span>
          <strong className="summary__value">{formatCurrency(monthIn)}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Saidas do mes</span>
          <strong className="summary__value">{formatCurrency(monthOut)}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Transferencias do mes</span>
          <strong className="summary__value">{formatCurrency(monthTransfers)}</strong>
        </article>
      </div>

      <div className="grid grid--two">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Estrutura de caixas</h2>
              <p>Saldo do banco nao representa dinheiro disponivel.</p>
            </div>
            <span className="panel__meta">
              Saldo do mes: {formatCurrency(monthBalance)}
            </span>
          </div>
          <div className="list">
            {cashboxes.map((cashbox) => (
              <div key={cashbox.id} className="list__item">
                <div>
                  <strong>{cashbox.name}</strong>
                  <span className="list__meta">
                    {cashbox.id === 'caixa_bancario'
                      ? 'Saldo bancario'
                      : cashbox.id === 'caixa_fisico'
                        ? 'Dinheiro em especie'
                        : 'Caixa interno'}
                  </span>
                </div>
                <strong>{formatCurrency(cashboxBalances.get(cashbox.id) ?? 0)}</strong>
              </div>
            ))}
          </div>
          <div className="panel__items">
            <div className="panel__item">
              <span className="panel__item-label">Caixa bancario</span>
              <strong className="panel__item-value">{formatCurrency(bankBalance)}</strong>
            </div>
            <div className="panel__item">
              <span className="panel__item-label">Caixa fisico</span>
              <strong className="panel__item-value">{formatCurrency(cashBalance)}</strong>
            </div>
            <div className="panel__item">
              <span className="panel__item-label">Caixa operacional</span>
              <strong className="panel__item-value">{formatCurrency(operationalBalance)}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Caixa fisico diario</h2>
              <p>Conferencia simples para dinheiro em especie.</p>
            </div>
          </div>
          <div className="panel__body">
            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="cash-check-date">
                  Data
                </label>
                <input
                  id="cash-check-date"
                  className="form__input"
                  type="date"
                  value={cashCheckDate}
                  onChange={(event) => setCashCheckDate(event.target.value)}
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="cash-check-opening">
                  Saldo inicial
                </label>
                <input
                  id="cash-check-opening"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashOpening}
                  onChange={(event) => setCashOpening(Number(event.target.value))}
                />
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label">Entradas em dinheiro</label>
                <div className="form__summary">{formatCurrency(cashIn)}</div>
              </div>
              <div className="form__group">
                <label className="form__label">Saidas em dinheiro</label>
                <div className="form__summary">{formatCurrency(cashOut)}</div>
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label">Saldo final esperado</label>
                <div className="form__summary">{formatCurrency(cashClosing)}</div>
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="cash-check-actual">
                  Conferencia manual
                </label>
                <input
                  id="cash-check-actual"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashActual}
                  onChange={(event) => setCashActual(Number(event.target.value))}
                />
              </div>
            </div>

            <div className="form__group">
              <span className="form__label">Diferenca</span>
              <div
                className={`form__summary${cashDiff !== 0 ? ' form__summary--alert' : ''}`}
              >
                {formatCurrency(cashDiff)}
              </div>
            </div>

            <div className="form__group">
              <label className="form__label" htmlFor="cash-check-notes">
                Observacoes
              </label>
              <textarea
                id="cash-check-notes"
                className="form__input form__textarea"
                value={cashNotes}
                onChange={(event) => setCashNotes(event.target.value)}
                placeholder="Anote divergencias ou ajustes"
              />
            </div>

            <div className="form__actions">
              <button className="button button--primary" type="button" onClick={handleSaveCashCheck}>
                Salvar conferencia
              </button>
            </div>
          </div>

          <div className="list">
            {cashChecks.length === 0 && (
              <div className="list__empty">Nenhuma conferencia registrada.</div>
            )}
            {cashChecks.map((check) => (
              <div key={check.id} className="list__item">
                <div>
                  <strong>{formatDateShort(check.date)}</strong>
                  <span className="list__meta">
                    Saldo final {formatCurrency(check.closing)}
                  </span>
                </div>
                <strong>{formatCurrency(check.actual - check.closing)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar lancamento' : 'Novo lancamento'}
        size="lg"
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
            <button className="button button--primary" type="submit" form={financeFormId}>
              <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                save
              </span>
              <span className="modal__action-label">
                {editingId ? 'Salvar' : 'Registrar'}
              </span>
            </button>
          </>
        }
      >
        <form id={financeFormId} className="modal__form" onSubmit={handleSubmit}>
            <div className="modal__group">
              <label className="modal__label" htmlFor="finance-type">
                Tipo
              </label>
              <select
                id="finance-type"
                className="modal__input"
                value={form.type}
                onChange={(event) =>
                  updateForm({ type: event.target.value as FinanceEntry['type'] })
                }
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saida</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>

            <div className="modal__group">
              <label className="modal__label" htmlFor="finance-description">
                Descricao
              </label>
              <input
                id="finance-description"
                className="modal__input"
                type="text"
                value={form.description}
                onChange={(event) => updateForm({ description: event.target.value })}
                placeholder="Ex: Compra de material"
              />
            </div>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="finance-amount">
                  Valor
                </label>
                <CurrencyInput
                  id="finance-amount"
                  className="modal__input"
                  value={form.amount}
                  onValueChange={(value) => updateForm({ amount: value ?? 0 })}
                />
              </div>
              <div className="modal__group">
                <label className="modal__label" htmlFor="finance-category">
                  Categoria
                </label>
                <input
                  id="finance-category"
                  className="modal__input"
                  type="text"
                  value={form.category}
                  onChange={(event) => updateForm({ category: event.target.value })}
                  placeholder="Materiais, manutencao..."
                />
              </div>
            </div>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="finance-cashbox">
                  Caixa de origem
                </label>
                <select
                  id="finance-cashbox"
                  className="modal__input"
                  value={form.cashboxId}
                  onChange={(event) => updateForm({ cashboxId: event.target.value })}
                >
                  <option value="">Selecionar caixa</option>
                  {cashboxes.map((cashbox) => (
                    <option key={cashbox.id} value={cashbox.id}>
                      {cashbox.name}
                    </option>
                  ))}
                </select>
              </div>
              {form.type === 'transferencia' && (
                <div className="modal__group">
                  <label className="modal__label" htmlFor="finance-cashbox-dest">
                    Caixa de destino
                  </label>
                  <select
                    id="finance-cashbox-dest"
                    className="modal__input"
                    value={form.transferToId}
                    onChange={(event) => updateForm({ transferToId: event.target.value })}
                  >
                    <option value="">Selecionar caixa</option>
                    {cashboxes.map((cashbox) => (
                      <option key={cashbox.id} value={cashbox.id}>
                        {cashbox.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

        </form>
      </Modal>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Ultimos lancamentos</h2>
            <p>Registros por categoria e impacto no saldo.</p>
          </div>
          <span className="panel__meta">{entries.length} registros</span>
        </div>
        <div className="table-card">
          <table className="table">
            <thead className="table__head table__head--mobile-hide">
              <tr>
                <th>Data</th>
                <th>Descricao</th>
                <th>Caixa</th>
                <th>Categoria</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th className="table__actions table__actions--end">Editar</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="table__empty">
                    Nenhum lancamento registrado ainda.
                  </td>
                </tr>
              )}
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="table__cell--mobile-hide">
                    {formatDateShort(entry.createdAt)}
                  </td>
                  <td className="table__cell--truncate">
                    <div className="table__stack">
                      <strong>{entry.description}</strong>
                      <span className="table__sub table__sub--mobile">
                        {formatDateShort(entry.createdAt)}
                      </span>
                      <span className="table__sub table__sub--mobile">
                        {formatCurrency(entry.amount)}
                      </span>
                    </div>
                  </td>
                  <td className="table__cell--mobile-hide">
                    {entry.type === 'transferencia' && entry.transferToId
                      ? `${getCashboxName(entry.cashboxId)} → ${getCashboxName(entry.transferToId)}`
                      : getCashboxName(entry.cashboxId)}
                  </td>
                  <td className="table__cell--mobile-hide">{entry.category ?? '-'}</td>
                  <td>
                    <span
                      className={`badge ${
                        entry.type === 'entrada'
                          ? 'badge--entrada'
                          : entry.type === 'saida'
                            ? 'badge--saida'
                            : 'badge--transferencia'
                      }`}
                    >
                      {entry.type}
                    </span>
                  </td>
                  <td className="table__cell--mobile-hide">{formatCurrency(entry.amount)}</td>
                  <td className="table__actions table__actions--end">
                    <ActionMenu
                      items={[
                        { label: 'Editar', onClick: () => handleEdit(entry) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
    </Page>
  )
}

export default Financeiro
