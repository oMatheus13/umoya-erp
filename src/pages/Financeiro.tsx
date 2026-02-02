import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../components/ActionMenu'
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
  cashboxId: string
  transferToId: string
}

const Financeiro = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
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

    dataService.addFinanceEntry({
      id: createId(),
      type: form.type,
      description: form.description.trim(),
      amount: form.amount,
      category: form.category.trim() || undefined,
      createdAt: new Date().toISOString(),
      cashboxId: form.cashboxId,
      transferToId: form.type === 'transferencia' ? form.transferToId : undefined,
    })
    refresh()
    setStatus('Lancamento registrado.')
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
    dataService.replaceAll(payload)
    refresh()
    setStatus('Conferencia do caixa fisico salva.')
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
          <span className="financeiro__stat-label">Saldo total</span>
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
          <span className="financeiro__stat-label">Transferencias do mes</span>
          <strong className="financeiro__stat-value">{formatCurrency(monthTransfers)}</strong>
        </article>
      </div>

      <div className="financeiro__grid">
        <section className="financeiro__panel">
          <div className="financeiro__panel-header">
            <div>
              <h2>Estrutura de caixas</h2>
              <p>Saldo do banco nao representa dinheiro disponivel.</p>
            </div>
            <span className="financeiro__panel-meta">
              Saldo do mes: {formatCurrency(monthBalance)}
            </span>
          </div>
          <div className="financeiro__list">
            {cashboxes.map((cashbox) => (
              <div key={cashbox.id} className="financeiro__list-item">
                <div>
                  <strong>{cashbox.name}</strong>
                  <span className="financeiro__list-meta">
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
          <div className="financeiro__cashbox-highlight">
            <div>
              <span>Caixa bancario</span>
              <strong>{formatCurrency(bankBalance)}</strong>
            </div>
            <div>
              <span>Caixa fisico</span>
              <strong>{formatCurrency(cashBalance)}</strong>
            </div>
            <div>
              <span>Caixa operacional</span>
              <strong>{formatCurrency(operationalBalance)}</strong>
            </div>
          </div>
        </section>

        <section className="financeiro__panel">
          <div className="financeiro__panel-header">
            <div>
              <h2>Caixa fisico diario</h2>
              <p>Conferencia simples para dinheiro em especie.</p>
            </div>
          </div>
          <div className="financeiro__check">
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
                <div className="form__summary">
                  <strong>{formatCurrency(cashIn)}</strong>
                </div>
              </div>
              <div className="form__group">
                <label className="form__label">Saidas em dinheiro</label>
                <div className="form__summary">
                  <strong>{formatCurrency(cashOut)}</strong>
                </div>
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label">Saldo final esperado</label>
                <div className="form__summary">
                  <strong>{formatCurrency(cashClosing)}</strong>
                </div>
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

            <div className="financeiro__diff">
              <span>Diferenca</span>
              <strong className={cashDiff !== 0 ? 'financeiro__diff-value--alert' : ''}>
                {formatCurrency(cashDiff)}
              </strong>
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

          <div className="financeiro__list">
            {cashChecks.length === 0 && (
              <div className="financeiro__empty">Nenhuma conferencia registrada.</div>
            )}
            {cashChecks.map((check) => (
              <div key={check.id} className="financeiro__list-item">
                <div>
                  <strong>{formatDateShort(check.date)}</strong>
                  <span className="financeiro__list-meta">
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
                <option value="transferencia">Transferencia</option>
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

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="finance-cashbox">
                  Caixa de origem
                </label>
                <select
                  id="finance-cashbox"
                  className="form__input"
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
                <div className="form__group">
                  <label className="form__label" htmlFor="finance-cashbox-dest">
                    Caixa de destino
                  </label>
                  <select
                    id="finance-cashbox-dest"
                    className="form__input"
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
                  <th>Caixa</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Acoes</th>
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
                    <td>{formatDateShort(entry.createdAt)}</td>
                    <td>{entry.description}</td>
                    <td>
                      {entry.type === 'transferencia' && entry.transferToId
                        ? `${getCashboxName(entry.cashboxId)} → ${getCashboxName(entry.transferToId)}`
                        : getCashboxName(entry.cashboxId)}
                    </td>
                    <td>{entry.category ?? '-'}</td>
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
                    <td>{formatCurrency(entry.amount)}</td>
                    <td className="table__actions">
                      <ActionMenu
                        items={[
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
