import { useEffect, useState } from 'react'
import { Page, PageHeader } from '@ui/components'
import QuickNotice from '@shared/components/QuickNotice'
import { supabase } from '@shared/services/supabaseClient'
import { useERPData } from '@shared/store/appStore'
import Placeholder from '../shared/Placeholder'

type SiteProductRow = {
  id: string
  product_id: string
  title: string
  slug: string
  tag?: string | null
  enabled?: boolean | null
  order_index?: number | null
}

const sortByOrder = (items: SiteProductRow[]) =>
  [...items].sort((a, b) => {
    const orderA = a.order_index ?? Number.POSITIVE_INFINITY
    const orderB = b.order_index ?? Number.POSITIVE_INFINITY
    if (orderA !== orderB) {
      return orderA - orderB
    }
    return a.title.localeCompare(b.title)
  })

const ProdutosSite = () => {
  const { data } = useERPData()
  const [items, setItems] = useState<SiteProductRow[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const workspaceId = data.meta?.workspaceId

  const loadItems = async () => {
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
      .from('site_products')
      .select('id, product_id, title, slug, tag, enabled, order_index')
      .eq('workspace_id', workspaceId)
      .order('order_index', { ascending: true })
    if (error) {
      setStatus(`Falha ao carregar produtos (${error.message}).`)
    } else {
      setItems(sortByOrder(rows ?? []))
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadItems()
  }, [workspaceId])

  const persistOrder = async (next: SiteProductRow[]) => {
    if (!supabase) {
      setStatus('Supabase nao configurado.')
      return
    }
    if (!workspaceId) {
      setStatus('Workspace ID nao configurado.')
      return
    }
    const updates = next.map((item, index) => ({
      id: item.id,
      workspace_id: workspaceId,
      order_index: index + 1,
    }))
    const { error } = await supabase
      .from('site_products')
      .upsert(updates, { onConflict: 'id' })
    if (error) {
      setStatus(`Falha ao salvar ordem (${error.message}).`)
      return
    }
    setStatus('Ordenacao atualizada.')
  }

  const handleDrop = async (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      return
    }
    const fromIndex = items.findIndex((item) => item.id === draggingId)
    const toIndex = items.findIndex((item) => item.id === targetId)
    if (fromIndex === -1 || toIndex === -1) {
      return
    }
    const next = [...items]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    const withOrder = next.map((item, index) => ({
      ...item,
      order_index: index + 1,
    }))
    setItems(withOrder)
    setDraggingId(null)
    await persistOrder(withOrder)
  }

  if (!supabase) {
    return (
      <Placeholder
        title="Supabase nao configurado"
        description="Configure as variaveis de ambiente para ordenar os produtos do site."
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
    <Page className="site-produtos">
      <PageHeader
        actions={
          <button
            className="button button--ghost"
            type="button"
            onClick={() => void loadItems()}
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
            <h2>Ordenar produtos do site</h2>
            <p>Arraste para reorganizar a ordem exibida no catalogo.</p>
          </div>
          <span className="panel__meta">
            {loading ? 'Carregando...' : `${items.length} registros`}
          </span>
        </div>
        <div className="list list--soft">
          {!loading && items.length === 0 && (
            <div className="list__empty">Nenhum produto publicado ainda.</div>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className={`list__item list__item--center ${draggingId === item.id ? 'is-dragging' : ''}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                setDraggingId(item.id)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void handleDrop(item.id)}
              onDragEnd={() => setDraggingId(null)}
            >
              <div>
                <strong>{item.title}</strong>
                <span className="list__meta">/{item.slug}</span>
                {item.tag && <span className="list__meta">Tag: {item.tag}</span>}
              </div>
              <div className="list__actions">
                <span
                  className={`badge ${item.enabled ? 'badge--aprovado' : 'badge--rascunho'}`}
                >
                  {item.enabled ? 'No site' : 'Oculto'}
                </span>
                <span className="material-symbols-outlined" aria-hidden="true">
                  drag_indicator
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Page>
  )
}

export default ProdutosSite
