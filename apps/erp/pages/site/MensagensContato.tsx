import { useEffect, useState } from 'react'
import { Page, PageHeader } from '@ui/components'
import QuickNotice from '@shared/components/QuickNotice'
import { supabase } from '@shared/services/supabaseClient'
import { formatDateShort } from '@shared/utils/format'
import Placeholder from '../shared/Placeholder'

type ContatoMensagem = {
  id: string
  created_at: string
  name: string
  email?: string | null
  phone?: string | null
  message: string
  source?: string | null
}

const MensagensContato = () => {
  const [messages, setMessages] = useState<ContatoMensagem[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadMessages = async () => {
    if (!supabase) {
      setStatus('Supabase nao configurado.')
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('site_contact_messages')
      .select('id, created_at, name, email, phone, message, source')
      .order('created_at', { ascending: false })
    if (error) {
      setStatus(`Falha ao carregar mensagens (${error.message}).`)
    } else {
      setMessages(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadMessages()
  }, [])

  if (!supabase) {
    return (
      <Placeholder
        title="Supabase nao configurado"
        description="Configure as variaveis de ambiente para carregar mensagens do site."
      />
    )
  }

  return (
    <Page className="site-contatos">
      <PageHeader
        actions={
          <button
            className="button button--ghost"
            type="button"
            onClick={() => void loadMessages()}
          >
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              refresh
            </span>
            <span className="page-header__action-label">Atualizar</span>
          </button>
        }
      />

      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Mensagens de contato</h2>
            <p>Solicitacoes enviadas pelo site institucional.</p>
          </div>
          <span className="panel__meta">
            {loading ? 'Carregando...' : `${messages.length} registros`}
          </span>
        </div>
        <div className="table-card">
          <table className="table">
            <thead className="table__head table__head--mobile-hide">
              <tr>
                <th>Contato</th>
                <th>Mensagem</th>
                <th>Recebido em</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {!loading && messages.length === 0 && (
                <tr>
                  <td colSpan={4} className="table__empty">
                    Nenhuma mensagem recebida ainda.
                  </td>
                </tr>
              )}
              {messages.map((message) => (
                <tr key={message.id}>
                  <td className="table__cell--truncate">
                    <div className="table__stack">
                      <strong>{message.name || 'Sem nome'}</strong>
                      <span className="table__sub">{message.email ?? '-'}</span>
                      {message.phone && (
                        <span className="table__sub">{message.phone}</span>
                      )}
                    </div>
                  </td>
                  <td className="table__cell--truncate">
                    <div className="table__stack">
                      <span>{message.message}</span>
                    </div>
                  </td>
                  <td>{formatDateShort(message.created_at)}</td>
                  <td>{message.source ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  )
}

export default MensagensContato
