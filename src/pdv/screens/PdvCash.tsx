import { useMemo, useState } from 'react'
import QuickNotice from '../../components/QuickNotice'
import { getPaymentMethodLabel, getPaymentMethodOptions } from '../../data/paymentMethods'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type {
  PdvCashMovementSource,
  PdvCashMovementType,
  PdvCashSession,
} from '../../types/erp'
import { formatCurrency, formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'

type PdvCashProps = {
  operatorId?: string
  operatorName?: string
}

const sourceLabels: Record<PdvCashMovementSource, string> = {
  venda: 'Venda',
  sangria: 'Sangria',
  reforco: 'Reforco',
  ajuste: 'Ajuste',
}

const PdvCash = ({ operatorId, operatorName }: PdvCashProps) => {
  const { data, refresh } = useERPData()
  const [openingBalance, setOpeningBalance] = useState(0)
  const [movementType, setMovementType] = useState<PdvCashMovementType>('entrada')
  const [movementSource, setMovementSource] = useState<PdvCashMovementSource>('reforco')
  const [movementMethod, setMovementMethod] = useState('dinheiro')
  const [movementAmount, setMovementAmount] = useState(0)
  const [movementNote, setMovementNote] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const paymentOptions = useMemo(
    () => getPaymentMethodOptions(data.tabelas?.paymentMethods),
    [data.tabelas?.paymentMethods],
  )

  const activeMovementMethod = useMemo(() => {
    if (paymentOptions.length === 0) {
      return movementMethod || 'dinheiro'
    }
    return paymentOptions.some((option) => option.id === movementMethod)
      ? movementMethod
      : paymentOptions[0].id
  }, [movementMethod, paymentOptions])

  const openSession = useMemo(() => {
    const sessions = data.pdvCaixas.filter((session) => session.status === 'aberto')
    return sessions.sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0] ?? null
  }, [data.pdvCaixas])

  const sessionMovements = useMemo(() => {
    if (!openSession) {
      return []
    }
    return data.pdvMovimentacoes
      .filter((movement) => movement.cashSessionId === openSession.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [data.pdvMovimentacoes, openSession])

  const cashIn = useMemo(
    () =>
      sessionMovements
        .filter((movement) => movement.type === 'entrada')
        .reduce((acc, movement) => acc + movement.amount, 0),
    [sessionMovements],
  )

  const cashOut = useMemo(
    () =>
      sessionMovements
        .filter((movement) => movement.type === 'saida')
        .reduce((acc, movement) => acc + movement.amount, 0),
    [sessionMovements],
  )

  const currentBalance = useMemo(() => {
    if (!openSession) {
      return 0
    }
    return openSession.openingBalance + cashIn - cashOut
  }, [cashIn, cashOut, openSession])

  const methodSummary = useMemo(() => {
    const totals = new Map<string, number>()
    sessionMovements.forEach((movement) => {
      if (movement.type !== 'entrada') {
        return
      }
      const current = totals.get(movement.method) ?? 0
      totals.set(movement.method, current + movement.amount)
    })
    return Array.from(totals.entries())
  }, [sessionMovements])

  const handleOpen = () => {
    const now = new Date().toISOString()
    const session: PdvCashSession = {
      id: createId(),
      userId: operatorId,
      userName: operatorName,
      openingBalance,
      status: 'aberto',
      openedAt: now,
    }
    dataService.upsertPdvCashSession(session)
    refresh()
    setStatus('Caixa aberto.')
  }

  const handleClose = () => {
    if (!openSession) {
      return
    }
    const now = new Date().toISOString()
    dataService.upsertPdvCashSession({
      ...openSession,
      status: 'fechado',
      closingBalance: currentBalance,
      closedAt: now,
    })
    refresh()
    setStatus('Caixa fechado.')
  }

  const handleMovement = () => {
    if (!openSession) {
      setStatus('Abra o caixa antes de registrar movimentos.')
      return
    }
    if (movementAmount <= 0) {
      setStatus('Informe um valor maior que zero.')
      return
    }
    const now = new Date().toISOString()
    dataService.addPdvCashMovement({
      id: createId(),
      cashSessionId: openSession.id,
      type: movementType,
      method: activeMovementMethod,
      amount: movementAmount,
      source: movementSource,
      createdAt: now,
      description: movementNote.trim() || undefined,
    })
    refresh()
    setMovementAmount(0)
    setMovementNote('')
    setStatus('Movimento registrado.')
  }

  return (
    <div className="pdv__cash">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Caixa</h2>
            <p>Controle diario</p>
          </div>
          <span className="panel__meta">
            {openSession
              ? `Aberto em ${formatDateShort(openSession.openedAt)}`
              : 'Sem caixa aberto'}
          </span>
        </div>
        <div className="panel__body">
          {!openSession && (
            <div className="panel__section">
              <div className="form__row">
                <div className="form__group">
                  <label className="form__label" htmlFor="pdv-cash-opening">
                    Saldo inicial
                  </label>
                  <input
                    id="pdv-cash-opening"
                    className="form__input"
                    type="number"
                    min={0}
                    value={openingBalance}
                    onChange={(event) => setOpeningBalance(Number(event.target.value))}
                  />
                </div>
              </div>
              <div className="form__actions">
                <button
                  className="button button--primary button--lg"
                  type="button"
                  onClick={handleOpen}
                >
                  Abrir caixa
                </button>
              </div>
            </div>
          )}

          {openSession && (
            <>
              <div className="panel__section">
                <div className="panel__items">
                  <div className="panel__item">
                    <span className="panel__item-label">Saldo inicial</span>
                    <strong className="panel__item-value">
                      {formatCurrency(openSession.openingBalance)}
                    </strong>
                  </div>
                  <div className="panel__item">
                    <span className="panel__item-label">Entradas</span>
                    <strong className="panel__item-value">{formatCurrency(cashIn)}</strong>
                  </div>
                  <div className="panel__item">
                    <span className="panel__item-label">Saidas</span>
                    <strong className="panel__item-value">{formatCurrency(cashOut)}</strong>
                  </div>
                  <div className="panel__item">
                    <span className="panel__item-label">Saldo atual</span>
                    <strong className="panel__item-value">
                      {formatCurrency(currentBalance)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="panel__section">
                <div className="panel__section-header">
                  <h3 className="panel__section-title">Movimentacao rapida</h3>
                </div>
                <div className="card__row">
                  <button
                    type="button"
                    className={`button button--sm ${
                      movementType === 'entrada' ? 'button--primary' : 'button--ghost'
                    }`}
                    onClick={() => {
                      setMovementType('entrada')
                      setMovementSource('reforco')
                    }}
                  >
                    Reforco
                  </button>
                  <button
                    type="button"
                    className={`button button--sm ${
                      movementType === 'saida' ? 'button--primary' : 'button--ghost'
                    }`}
                    onClick={() => {
                      setMovementType('saida')
                      setMovementSource('sangria')
                    }}
                  >
                    Sangria
                  </button>
                </div>
                <div className="form__row">
                  <div className="form__group">
                    <label className="form__label" htmlFor="pdv-movement-amount">
                      Valor
                    </label>
                    <input
                      id="pdv-movement-amount"
                      className="form__input"
                      type="number"
                      min={0}
                      value={movementAmount}
                      onChange={(event) => setMovementAmount(Number(event.target.value))}
                    />
                  </div>
                  <div className="form__group">
                    <label className="form__label" htmlFor="pdv-movement-method">
                      Meio
                    </label>
                    <select
                      id="pdv-movement-method"
                      className="form__input"
                      value={activeMovementMethod}
                      onChange={(event) => setMovementMethod(event.target.value)}
                    >
                      {paymentOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form__group">
                    <label className="form__label" htmlFor="pdv-movement-note">
                      Observacao
                    </label>
                    <input
                      id="pdv-movement-note"
                      className="form__input"
                      type="text"
                      value={movementNote}
                      placeholder="Opcional"
                      onChange={(event) => setMovementNote(event.target.value)}
                    />
                  </div>
                </div>
                <div className="form__actions">
                  <button
                    className="button button--primary button--sm"
                    type="button"
                    onClick={handleMovement}
                  >
                    Registrar
                  </button>
                </div>
              </div>

              <div className="panel__section">
                <div className="panel__section-header">
                  <h3 className="panel__section-title">Resumo por meio</h3>
                </div>
                <div className="panel__items">
                  {methodSummary.map(([method, amount]) => (
                    <div key={method} className="panel__item">
                      <span className="panel__item-label">
                        {getPaymentMethodLabel(method, data.tabelas?.paymentMethods)}
                      </span>
                      <strong className="panel__item-value">
                        {formatCurrency(amount)}
                      </strong>
                    </div>
                  ))}
                </div>
                {methodSummary.length === 0 && (
                  <div className="list__empty">Sem entradas registradas.</div>
                )}
              </div>

              <div className="panel__section">
                <div className="panel__actions">
                  <button
                    className="button button--ghost button--sm"
                    type="button"
                    onClick={handleClose}
                  >
                    Fechar caixa
                  </button>
                </div>
              </div>
            </>
          )}

          <QuickNotice message={status} onClear={() => setStatus(null)} />
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Ultimas entradas e saidas</h2>
            <p>Movimentos recentes no caixa atual.</p>
          </div>
          <span className="panel__meta">{sessionMovements.length} registros</span>
        </div>
        <div className="list list--compact">
          {sessionMovements.slice(0, 12).map((movement) => (
            <div key={movement.id} className="list__item list__item--center">
              <div>
                <strong>{sourceLabels[movement.source]}</strong>
                <span className="list__meta">
                  {getPaymentMethodLabel(movement.method, data.tabelas?.paymentMethods)} ·{' '}
                  {formatDateShort(movement.createdAt)}
                </span>
              </div>
              <strong
                className={
                  movement.type === 'entrada'
                    ? 'summary__value--positive'
                    : 'summary__value--negative'
                }
              >
                {movement.type === 'entrada' ? '+' : '-'} {formatCurrency(movement.amount)}
              </strong>
            </div>
          ))}
          {sessionMovements.length === 0 && (
            <div className="list__empty">Nenhum movimento registrado.</div>
          )}
        </div>
      </section>
    </div>
  )
}

export default PdvCash
