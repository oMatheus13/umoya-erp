import { useEffect, useMemo, useState } from 'react'
import ActionMenu from '../../components/ActionMenu'
import Modal from '@shared/components/Modal'
import QuickNotice from '@shared/components/QuickNotice'
import { Page, PageHeader } from '@ui/components'
import { supabase } from '@shared/services/supabaseClient'
import { useERPData } from '@shared/store/appStore'
import { formatDateShort } from '@shared/utils/format'
import Placeholder from '../shared/Placeholder'

type QuoteStatus = 'novo' | 'em_atendimento' | 'aguardando_cliente' | 'aprovado' | 'recusado'

const statusLabels: Record<QuoteStatus, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando cliente',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
}

const modeLabels: Record<string, string> = {
  laje: 'Laje',
  m2: 'm2',
  metro_linear: 'Metro linear',
  quantidade: 'Quantidade',
  pingadeira_calc: 'Pingadeira (calculo)',
}

type QuotePayload = {
  product?: {
    title?: string
    slug?: string | null
    unit?: string | null
    variant?: {
      label?: string
    }
  }
  rooms?: Array<{
    label?: string
    largura?: number
    comprimento?: number
    area?: number
  }>
  lineItems?: Array<{
    label?: string
    comprimento?: number
    quantidade?: number
    total?: number
  }>
  segments?: Array<{
    label?: string
    comprimento?: number
    quantidade?: number
  }>
  totals?: {
    areaTotal?: number
    vigotasTotal?: number
    lajotasTotal?: number
    metrosTotal?: number
    quantidadeTotal?: number
  }
  message?: string
}

type SiteQuote = {
  id: string
  created_at: string
  name: string
  email?: string | null
  phone?: string | null
  message?: string | null
  source?: string | null
  status?: QuoteStatus | null
  quote_type?: string | null
  quote_mode?: string | null
  product_title?: string | null
  product_slug?: string | null
  product_unit?: string | null
  variant_label?: string | null
  payload?: QuotePayload | null
}

const formatNumber = (value?: number, digits = 2) => {
  if (!Number.isFinite(value)) {
    return '-'
  }
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits })
}

const buildSummaryLines = (payload?: QuotePayload | null) => {
  if (!payload?.totals) {
    return []
  }
  const lines: string[] = []
  if (payload.totals.areaTotal) {
    lines.push(`Area ${formatNumber(payload.totals.areaTotal)} m2`)
  }
  if (payload.totals.vigotasTotal) {
    lines.push(`Vigotas ${payload.totals.vigotasTotal}`)
  }
  if (payload.totals.lajotasTotal) {
    lines.push(`Lajotas ${payload.totals.lajotasTotal}`)
  }
  if (payload.totals.metrosTotal) {
    lines.push(`Metros ${formatNumber(payload.totals.metrosTotal)} m`)
  }
  if (payload.totals.quantidadeTotal) {
    lines.push(`Qtd ${payload.totals.quantidadeTotal}`)
  }
  return lines
}

const CotacoesSite = () => {
  const { data } = useERPData()
  const [quotes, setQuotes] = useState<SiteQuote[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeQuote, setActiveQuote] = useState<SiteQuote | null>(null)
  const [filterStatus, setFilterStatus] = useState<QuoteStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const workspaceId = data.meta?.workspaceId

  const loadQuotes = async () => {
    if (!supabase) {
      setStatus('Supabase nao configurado.')
      return
    }
    if (!workspaceId) {
      setStatus('Workspace ID nao configurado.')
      return
    }
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('site_quotes')
      .select(
        [
          'id',
          'created_at',
          'name',
          'email',
          'phone',
          'message',
          'source',
          'status',
          'quote_type',
          'quote_mode',
          'product_title',
          'product_slug',
          'product_unit',
          'variant_label',
          'payload',
        ].join(','),
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      setStatus(`Falha ao carregar cotacoes (${error.message}).`)
    } else {
      setQuotes((rows ?? []) as SiteQuote[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadQuotes()
  }, [workspaceId])

  const handleStatusChange = async (quote: SiteQuote, nextStatus: QuoteStatus) => {
    if (!supabase) {
      setStatus('Supabase nao configurado.')
      return
    }
    setQuotes((prev) =>
      prev.map((item) => (item.id === quote.id ? { ...item, status: nextStatus } : item)),
    )
    const { error } = await supabase
      .from('site_quotes')
      .update({ status: nextStatus })
      .eq('id', quote.id)
    if (error) {
      setStatus(`Falha ao atualizar status (${error.message}).`)
      void loadQuotes()
      return
    }
    setStatus('Status atualizado.')
  }

  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return quotes.filter((quote) => {
      const statusMatch = filterStatus === 'all' ? true : quote.status === filterStatus
      if (!statusMatch) {
        return false
      }
      if (!query) {
        return true
      }
      const fields = [
        quote.name,
        quote.email,
        quote.phone,
        quote.product_title,
        quote.variant_label,
        quote.message,
      ]
      return fields.some((field) => field?.toLowerCase().includes(query))
    })
  }, [filterStatus, quotes, search])

  if (!supabase) {
    return (
      <Placeholder
        title="Supabase nao configurado"
        description="Configure as variaveis de ambiente para carregar cotacoes do site."
      />
    )
  }

  if (!workspaceId) {
    return (
      <Placeholder
        title="Workspace nao configurado"
        description="Defina o workspace ID nas configuracoes da empresa."
      />
    )
  }

  return (
    <Page className="site-cotacoes">
      <PageHeader
        actions={
          <button
            className="button button--ghost"
            type="button"
            onClick={() => void loadQuotes()}
          >
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              refresh
            </span>
            <span className="page-header__action-label">Atualizar</span>
          </button>
        }
      />

      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <div className="filters">
        <div className="form__group">
          <label className="form__label" htmlFor="quote-filter-status">
            Status
          </label>
          <select
            id="quote-filter-status"
            className="form__input"
            value={filterStatus}
            onChange={(event) =>
              setFilterStatus(event.target.value as QuoteStatus | 'all')
            }
          >
            <option value="all">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="form__group">
          <label className="form__label" htmlFor="quote-filter-search">
            Buscar
          </label>
          <input
            id="quote-filter-search"
            className="form__input"
            type="search"
            placeholder="Nome, produto ou contato"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Cotacoes do site</h2>
            <p>Solicitacoes enviadas pelo formulario de cotacao.</p>
          </div>
          <span className="panel__meta">
            {loading ? 'Carregando...' : `${filteredQuotes.length} registros`}
          </span>
        </div>
        <div className="table-card">
          <table className="table">
            <thead className="table__head table__head--mobile-hide">
              <tr>
                <th>Cliente</th>
                <th>Produto</th>
                <th>Resumo</th>
                <th>Recebido em</th>
                <th>Status</th>
                <th className="table__actions table__actions--end">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredQuotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="table__empty">
                    Nenhuma cotacao recebida ainda.
                  </td>
                </tr>
              )}
              {filteredQuotes.map((quote) => {
                const productTitle =
                  quote.product_title ||
                  quote.payload?.product?.title ||
                  (quote.quote_type === 'laje' ? 'Laje' : 'Produto')
                const variantLabel =
                  quote.variant_label || quote.payload?.product?.variant?.label
                const modeLabel = quote.quote_mode ? modeLabels[quote.quote_mode] : null
                const summaryLines = buildSummaryLines(quote.payload)
                const statusValue = (quote.status ?? 'novo') as QuoteStatus
                return (
                  <tr key={quote.id}>
                    <td className="table__cell--truncate">
                      <div className="table__stack">
                        <strong>{quote.name || 'Sem nome'}</strong>
                        <span className="table__sub">{quote.email ?? '-'}</span>
                        {quote.phone && <span className="table__sub">{quote.phone}</span>}
                      </div>
                    </td>
                    <td className="table__cell--truncate">
                      <div className="table__stack">
                        <strong>{productTitle}</strong>
                        {variantLabel && <span className="table__sub">{variantLabel}</span>}
                        {modeLabel && <span className="table__sub">{modeLabel}</span>}
                      </div>
                    </td>
                    <td className="table__cell--truncate">
                      <div className="table__stack">
                        {summaryLines.length === 0 ? (
                          <span className="table__sub">-</span>
                        ) : (
                          summaryLines.slice(0, 3).map((line, index) => (
                            <span key={`${quote.id}-summary-${index}`} className="table__sub">
                              {line}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td>{formatDateShort(quote.created_at)}</td>
                    <td>
                      <select
                        className="table__select"
                        data-status={statusValue}
                        value={statusValue}
                        onChange={(event) =>
                          handleStatusChange(
                            quote,
                            event.target.value as QuoteStatus,
                          )
                        }
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="table__actions table__actions--end">
                      <div className="table__end">
                        <ActionMenu
                          items={[
                            { label: 'Ver detalhes', onClick: () => setActiveQuote(quote) },
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
        open={!!activeQuote}
        onClose={() => setActiveQuote(null)}
        title="Detalhes da cotacao"
        size="lg"
      >
        {activeQuote ? (
          <div className="modal__form">
            <div className="modal__row">
              <div className="modal__group">
                <span className="modal__label">Cliente</span>
                <div className="modal__summary">{activeQuote.name || 'Sem nome'}</div>
                {activeQuote.email && <p className="modal__help">{activeQuote.email}</p>}
                {activeQuote.phone && <p className="modal__help">{activeQuote.phone}</p>}
              </div>
              <div className="modal__group">
                <span className="modal__label">Recebido em</span>
                <div className="modal__summary">{formatDateShort(activeQuote.created_at)}</div>
                <p className="modal__help">
                  Status:{' '}
                  {statusLabels[(activeQuote.status ?? 'novo') as QuoteStatus] ?? 'Novo'}
                </p>
              </div>
            </div>

            <div className="modal__section">
              <div className="modal__group">
                <span className="modal__label">Produto</span>
                <div className="modal__summary">
                  {activeQuote.product_title ||
                    activeQuote.payload?.product?.title ||
                    (activeQuote.quote_type === 'laje' ? 'Laje' : 'Produto')}
                </div>
                {(activeQuote.variant_label ||
                    activeQuote.payload?.product?.variant?.label) && (
                  <p className="modal__help">
                    Variacao:{' '}
                    {activeQuote.variant_label || activeQuote.payload?.product?.variant?.label}
                  </p>
                )}
                {activeQuote.quote_mode && (
                  <p className="modal__help">
                    Modo: {modeLabels[activeQuote.quote_mode] ?? activeQuote.quote_mode}
                  </p>
                )}
              </div>
            </div>

            {activeQuote.payload?.rooms && activeQuote.payload.rooms.length > 0 && (
              <div className="modal__section">
                <div className="modal__group">
                  <span className="modal__label">Comodos</span>
                </div>
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Largura (m)</th>
                      <th>Comprimento (m)</th>
                      <th>Area (m2)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeQuote.payload.rooms.map((room, index) => (
                      <tr key={`room-${index}`}>
                        <td>{room.label || `Comodo ${index + 1}`}</td>
                        <td>{formatNumber(room.largura, 2)}</td>
                        <td>{formatNumber(room.comprimento, 2)}</td>
                        <td>{formatNumber(room.area, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeQuote.payload?.lineItems && activeQuote.payload.lineItems.length > 0 && (
              <div className="modal__section">
                <div className="modal__group">
                  <span className="modal__label">Itens por metro linear</span>
                </div>
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Identificacao</th>
                      <th>Comprimento (m)</th>
                      <th>Quantidade</th>
                      <th>Total (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeQuote.payload.lineItems.map((item, index) => (
                      <tr key={`line-${index}`}>
                        <td>{item.label || `Item ${index + 1}`}</td>
                        <td>{formatNumber(item.comprimento, 2)}</td>
                        <td>{item.quantidade ?? '-'}</td>
                        <td>{formatNumber(item.total, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeQuote.payload?.segments && activeQuote.payload.segments.length > 0 && (
              <div className="modal__section">
                <div className="modal__group">
                  <span className="modal__label">Trechos / paredes</span>
                </div>
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Identificacao</th>
                      <th>Comprimento (m)</th>
                      <th>Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeQuote.payload.segments.map((segment, index) => (
                      <tr key={`segment-${index}`}>
                        <td>{segment.label || `Trecho ${index + 1}`}</td>
                        <td>{formatNumber(segment.comprimento, 2)}</td>
                        <td>{segment.quantidade ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(activeQuote.message || activeQuote.payload?.message) && (
              <div className="modal__section">
                <div className="modal__group">
                  <span className="modal__label">Mensagem</span>
                  <div className="modal__summary">
                    {activeQuote.message || activeQuote.payload?.message}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="modal__help">Selecione uma cotacao para visualizar.</p>
        )}
      </Modal>
    </Page>
  )
}

export default CotacoesSite
