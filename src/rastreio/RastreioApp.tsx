import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { supabaseNoPersist } from '../services/supabaseClient'
import type { TrackingOrderPayload, TrackingStage, TrackingSummaryStage } from '../types/tracking'
import { formatDateShort } from '../utils/format'

type FetchStatus = 'idle' | 'loading' | 'error' | 'success'

type Step = {
  id: string
  label: string
}

const productionSteps: Step[] = [
  { id: 'aguardando_producao', label: 'Aguardando producao' },
  { id: 'moldagem', label: 'Moldagem' },
  { id: 'desenforma', label: 'Desenforma' },
  { id: 'cura', label: 'Cura' },
  { id: 'aguardando_envio', label: 'Aguardando envio' },
  { id: 'em_rota', label: 'Em rota' },
  { id: 'entregue', label: 'Entregue' },
]

const stockSteps: Step[] = [
  { id: 'aguardando_envio', label: 'Aguardando envio' },
  { id: 'em_rota', label: 'Em rota' },
  { id: 'entregue', label: 'Entregue' },
]

const stageLabels: Record<TrackingStage, string> = {
  aguardando_producao: 'Aguardando producao',
  moldagem: 'Moldagem',
  cura: 'Cura',
  aguardando_envio: 'Aguardando envio',
  em_rota: 'Em rota',
  entregue: 'Entregue',
}

const summaryLabels: Record<TrackingSummaryStage, string> = {
  aguardando_producao: 'Aguardando producao',
  em_producao: 'Em producao',
  aguardando_envio: 'Aguardando envio',
  em_rota: 'Em rota',
  entregue: 'Entregue',
}

const parseTrackingCode = () => {
  if (typeof window === 'undefined') {
    return ''
  }
  const params = new URLSearchParams(window.location.search)
  const paramCode = params.get('pedido') || params.get('codigo')
  if (paramCode) {
    return paramCode.trim()
  }
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '')
  if (!path) {
    return ''
  }
  const parts = path.split('/')
  if (parts[0] === 'rastreio') {
    return parts[1] ?? ''
  }
  return parts[0] ?? ''
}

const buildTrackingPath = (code: string) => {
  if (typeof window === 'undefined') {
    return '/'
  }
  const base = window.location.pathname.startsWith('/rastreio') ? '/rastreio' : ''
  if (!code) {
    return base || '/'
  }
  return `${base}/${code}`.replace(/\/+/g, '/')
}

const resolveSteps = (fulfillment: TrackingOrderPayload['fulfillment']) =>
  fulfillment === 'estoque' ? stockSteps : productionSteps

const resolveStepIndex = (steps: Step[], stage: TrackingStage) => {
  const index = steps.findIndex((step) => step.id === stage)
  if (index >= 0) {
    return index
  }
  if (stage === 'moldagem') {
    return 1
  }
  if (stage === 'cura') {
    return 3
  }
  return 0
}

const resolveSummaryChip = (stage: TrackingSummaryStage) => {
  if (stage === 'entregue') {
    return 'rastreio-chip rastreio-chip--ready'
  }
  if (stage === 'em_rota') {
    return 'rastreio-chip rastreio-chip--route'
  }
  return 'rastreio-chip'
}

const RastreioApp = () => {
  const initialCode = useMemo(() => parseTrackingCode(), [])
  const [input, setInput] = useState(initialCode)
  const [code, setCode] = useState(initialCode)
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [tracking, setTracking] = useState<TrackingOrderPayload | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const fetchTracking = async (nextCode: string) => {
    if (!nextCode) {
      setStatus('idle')
      setMessage('Informe o codigo do pedido para rastrear.')
      setTracking(null)
      return
    }
    if (!supabaseNoPersist) {
      setStatus('error')
      setMessage('Supabase nao configurado.')
      return
    }
    setStatus('loading')
    setMessage(null)
    setTracking(null)
    setUpdatedAt(null)
    const { data, error } = await supabaseNoPersist
      .rpc('get_tracking_order', { p_order_id: nextCode })
      .maybeSingle()
    if (error || !data?.payload) {
      setStatus('error')
      setMessage('Pedido nao encontrado.')
      return
    }
    setTracking(data.payload as TrackingOrderPayload)
    setUpdatedAt(data.updated_at ?? null)
    setStatus('success')
  }

  useEffect(() => {
    if (code) {
      void fetchTracking(code)
    }
  }, [code])

  useEffect(() => {
    const baseTitle = document.title || 'Umoya Rastreio'
    if (tracking) {
      const shortCode = tracking.orderId.slice(0, 6)
      document.title = `${baseTitle} - Pedido ${shortCode}`
      return
    }
    document.title = baseTitle
  }, [tracking])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) {
      setMessage('Informe o codigo do pedido para rastrear.')
      setStatus('idle')
      return
    }
    const nextPath = buildTrackingPath(trimmed)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', nextPath)
    }
    setCode(trimmed)
  }

  const steps = tracking ? resolveSteps(tracking.fulfillment) : productionSteps
  const summaryLabel = tracking ? summaryLabels[tracking.summary.stage] : ''
  const summaryChipClass = tracking ? resolveSummaryChip(tracking.summary.stage) : 'rastreio-chip'
  const summaryMeta = tracking
    ? `${tracking.summary.deliveredQuantity} de ${tracking.summary.totalQuantity} itens entregues`
    : ''

  return (
    <main className="rastreio-app">
      <div className="rastreio-shell">
        <section className="rastreio-hero">
          <div>
            <span className="rastreio-brand">Umoya</span>
            <h1 className="rastreio-title">Rastreio Umoya</h1>
            <p className="rastreio-subtitle">
              Acompanhe cada etapa da sua entrega, da producao ate a chegada.
            </p>
          </div>
          <form className="rastreio-search" onSubmit={handleSubmit}>
            <p className="rastreio-search__label">Codigo do pedido</p>
            <div className="rastreio-search__row">
              <input
                className="rastreio-search__input"
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ex: 6f2b9e"
              />
              <button className="rastreio-search__button" type="submit">
                Rastrear
              </button>
            </div>
            <p className="rastreio-search__hint">
              Use o numero do pedido que voce recebeu por mensagem.
            </p>
          </form>
        </section>

        {message && (
          <p
            className={`rastreio-status ${
              status === 'error' ? 'rastreio-status--error' : ''
            }`}
          >
            {message}
          </p>
        )}

        {status === 'loading' && (
          <p className="rastreio-status">Carregando informacoes do pedido...</p>
        )}

        {tracking && (
          <section className="rastreio-card">
            <header className="rastreio-card__header">
              <div>
                <h2 className="rastreio-card__title">
                  Pedido #{tracking.orderId.slice(0, 6)}
                </h2>
                <p className="rastreio-card__meta">
                  {summaryLabel}
                  {tracking.clientName ? ` • ${tracking.clientName}` : ''}
                  {updatedAt ? ` • Atualizado em ${formatDateShort(updatedAt)}` : ''}
                </p>
              </div>
              <span className={summaryChipClass}>{summaryLabel}</span>
            </header>

            <div className="rastreio-summary">
              <div className="rastreio-summary__item">
                <span className="rastreio-summary__label">Resumo geral</span>
                <strong className="rastreio-summary__value">{summaryLabel}</strong>
              </div>
              <div className="rastreio-summary__item">
                <span className="rastreio-summary__label">Entrega</span>
                <strong className="rastreio-summary__value">{summaryMeta}</strong>
              </div>
              <div className="rastreio-summary__item">
                <span className="rastreio-summary__label">Itens no pedido</span>
                <strong className="rastreio-summary__value">
                  {tracking.items.length}
                </strong>
              </div>
            </div>

            <div className="rastreio-items">
              {tracking.items.map((item, index) => {
                const stepIndex = resolveStepIndex(steps, item.stage)
                const progressStyle = {
                  '--step-count': steps.length,
                  '--step-progress': stepIndex,
                } as CSSProperties
                const delayStyle = {
                  '--delay': `${index * 0.06}s`,
                } as CSSProperties
                return (
                  <article key={item.key} className="rastreio-item" style={delayStyle}>
                    <header className="rastreio-item__header">
                      <div>
                        <h3 className="rastreio-item__title">{item.label}</h3>
                        <p className="rastreio-item__meta">
                          Quantidade: {item.quantity}
                          {item.deliveredQuantity > 0
                            ? ` • Entregue: ${item.deliveredQuantity}`
                            : ''}
                        </p>
                      </div>
                      <div>
                        <span className="rastreio-item__status">
                          {stageLabels[item.stage]}
                        </span>
                        {item.isPartial && (
                          <div className="rastreio-tag rastreio-tag--partial">
                            Entrega parcial
                          </div>
                        )}
                      </div>
                    </header>
                    <div className="rastreio-steps-scroll">
                      <div className="rastreio-steps" style={progressStyle}>
                        {steps.map((step, stepIndexValue) => (
                          <div
                            key={`${item.key}-${step.id}`}
                            className={`rastreio-step ${
                              stepIndexValue <= stepIndex ? 'is-active' : ''
                            }`}
                          >
                            <span className="rastreio-step__dot" />
                            <span className="rastreio-step__label">{step.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

export default RastreioApp
