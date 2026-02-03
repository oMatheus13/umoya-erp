import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '../../components/Modal'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { AuditCategory, AuditEvent } from '../../types/erp'
import { formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'

type AuditoriaPageProps = {
  category: AuditCategory
  title: string
  subtitle: string
  eyebrow: string
}

type AuditForm = {
  title: string
  description: string
  actorName: string
  metadata: string
}

const AuditoriaPage = ({ category, title, subtitle, eyebrow }: AuditoriaPageProps) => {
  const { data, refresh } = useERPData()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<AuditForm>({
    title: '',
    description: '',
    actorName: '',
    metadata: '',
  })

  const entries = useMemo(
    () =>
      data.auditoria
        .filter((item) => item.category === category)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [category, data.auditoria],
  )

  const summary = useMemo(() => {
    const latest = entries[0]
    return {
      total: entries.length,
      latest: latest ? formatDateShort(latest.createdAt) : '-',
      actors: new Set(entries.map((item) => item.actorName).filter(Boolean)).size,
    }
  }, [entries])

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      actorName: '',
      metadata: '',
    })
    setEditingId(null)
    setEditingCreatedAt(null)
  }

  const openModal = (entry?: AuditEvent) => {
    if (entry) {
      setEditingId(entry.id)
      setEditingCreatedAt(entry.createdAt)
      setForm({
        title: entry.title,
        description: entry.description ?? '',
        actorName: entry.actorName ?? '',
        metadata: entry.metadata ?? '',
      })
    } else {
      resetForm()
    }
    setStatus(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setStatus(null)
    resetForm()
  }

  const updateForm = (patch: Partial<AuditForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title.trim()) {
      setStatus('Informe um titulo.')
      return
    }
    const next: AuditEvent = {
      id: editingId ?? createId(),
      category,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      actorName: form.actorName.trim() || undefined,
      metadata: form.metadata.trim() || undefined,
      createdAt: editingCreatedAt ?? new Date().toISOString(),
    }
    const payload = dataService.getAll()
    if (editingId) {
      payload.auditoria = payload.auditoria.map((item) =>
        item.id === editingId ? next : item,
      )
    } else {
      payload.auditoria = [...payload.auditoria, next]
    }
    dataService.replaceAll(payload)
    refresh()
    setStatus(editingId ? 'Registro atualizado.' : 'Registro criado.')
    setIsModalOpen(false)
    resetForm()
  }

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.auditoria = payload.auditoria.filter((item) => item.id !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Registro removido.')
    setDeleteId(null)
  }

  const entryToDelete = deleteId ? data.auditoria.find((item) => item.id === deleteId) : null

  return (
    <section className="auditoria">
      <header className="auditoria__header">
        <div className="auditoria__headline">
          <span className="auditoria__eyebrow">{eyebrow}</span>
          <h1 className="auditoria__title">{title}</h1>
          <p className="auditoria__subtitle">{subtitle}</p>
        </div>
        <div className="auditoria__actions">
          <button className="button button--primary" type="button" onClick={() => openModal()}>
            Novo registro
          </button>
        </div>
      </header>

      {status && <p className="form__status">{status}</p>}

      <div className="auditoria__summary summary-card">
        <article className="auditoria__stat">
          <span className="auditoria__stat-label">Registros</span>
          <strong className="auditoria__stat-value">{summary.total}</strong>
        </article>
        <article className="auditoria__stat">
          <span className="auditoria__stat-label">Ultima atualizacao</span>
          <strong className="auditoria__stat-value">{summary.latest}</strong>
        </article>
        <article className="auditoria__stat">
          <span className="auditoria__stat-label">Responsaveis</span>
          <strong className="auditoria__stat-value">{summary.actors}</strong>
        </article>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Titulo</th>
              <th>Responsavel</th>
              <th>Detalhes</th>
              <th className="table__actions">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td className="table__empty" colSpan={5}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateShort(entry.createdAt)}</td>
                  <td>{entry.title}</td>
                  <td>{entry.actorName ?? '-'}</td>
                  <td>{entry.description ?? entry.metadata ?? '-'}</td>
                  <td className="table__actions">
                    <ActionMenu
                      items={[
                        { label: 'Editar', onClick: () => openModal(entry) },
                        { label: 'Excluir', onClick: () => setDeleteId(entry.id) },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={isModalOpen}
        title={editingId ? 'Editar registro' : 'Novo registro'}
        onClose={closeModal}
      >
        <form className="form" onSubmit={handleSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="audit-title">
              Titulo
            </label>
            <input
              id="audit-title"
              className="form__input"
              type="text"
              value={form.title}
              onChange={(event) => updateForm({ title: event.target.value })}
            />
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="audit-actor">
              Responsavel
            </label>
            <input
              id="audit-actor"
              className="form__input"
              type="text"
              value={form.actorName}
              onChange={(event) => updateForm({ actorName: event.target.value })}
            />
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="audit-description">
              Detalhes
            </label>
            <textarea
              id="audit-description"
              className="form__input form__textarea"
              value={form.description}
              onChange={(event) => updateForm({ description: event.target.value })}
            />
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="audit-metadata">
              Observacoes internas
            </label>
            <input
              id="audit-metadata"
              className="form__input"
              type="text"
              value={form.metadata}
              onChange={(event) => updateForm({ metadata: event.target.value })}
            />
          </div>

          {status && <p className="form__status">{status}</p>}

          <div className="form__actions">
            <button className="button button--primary" type="submit">
              {editingId ? 'Salvar' : 'Registrar'}
            </button>
            <button className="button button--ghost" type="button" onClick={closeModal}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir registro?"
        description={
          entryToDelete
            ? `Registro "${entryToDelete.title}" sera removido.`
            : 'Este registro sera removido.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </section>
  )
}

export default AuditoriaPage
