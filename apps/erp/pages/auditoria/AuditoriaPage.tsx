import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '@shared/components/Modal'
import QuickNotice from '@shared/components/QuickNotice'
import { Page, PageHeader } from '@ui/components'
import { dataService } from '@shared/services/dataService'
import { useERPData } from '@shared/store/appStore'
import type { AuditCategory, AuditEvent } from '@shared/types/erp'
import { formatDateShort } from '@shared/utils/format'
import { createId } from '@shared/utils/ids'

type AuditoriaPageProps = {
  category: AuditCategory
}

type AuditForm = {
  title: string
  description: string
  actorName: string
  metadata: string
}

const AuditoriaPage = ({ category }: AuditoriaPageProps) => {
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
  const auditFormId = 'auditoria-form'

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
    setIsModalOpen(false)
    resetForm()
    setStatus('Registro removido.')
    setDeleteId(null)
  }

  const entryToDelete = deleteId ? data.auditoria.find((item) => item.id === deleteId) : null

  return (
    <Page className="auditoria">
      <PageHeader
        actions={
          <button className="button button--primary" type="button" onClick={() => openModal()}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              note_add
            </span>
            <span className="page-header__action-label">Novo registro</span>
          </button>
        }
      />
      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Registros</span>
          <strong className="summary__value">{summary.total}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Ultima atualizacao</span>
          <strong className="summary__value">{summary.latest}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Responsaveis</span>
          <strong className="summary__value">{summary.actors}</strong>
        </article>
      </div>

      <div className="table-card">
        <table className="table">
          <thead className="table__head table__head--mobile-hide">
            <tr>
              <th>Data</th>
              <th>Titulo</th>
              <th>Responsavel</th>
              <th>Detalhes</th>
              <th className="table__actions table__actions--end">Editar</th>
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
                  <td className="table__cell--mobile-hide">
                    {formatDateShort(entry.createdAt)}
                  </td>
                  <td className="table__cell--truncate">
                    <div className="table__stack">
                      <strong>{entry.title}</strong>
                      <span className="table__sub table__sub--mobile">
                        {entry.actorName ?? '-'}
                      </span>
                      <span className="table__sub table__sub--mobile">
                        {formatDateShort(entry.createdAt)}
                      </span>
                    </div>
                  </td>
                  <td className="table__cell--mobile-hide">{entry.actorName ?? '-'}</td>
                  <td className="table__cell--mobile-hide">
                    {entry.description ?? entry.metadata ?? '-'}
                  </td>
                  <td className="table__actions table__actions--end">
                    <ActionMenu
                      items={[
                        { label: 'Editar', onClick: () => openModal(entry) },
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
            <button className="button button--primary" type="submit" form={auditFormId}>
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
        <form id={auditFormId} className="modal__form" onSubmit={handleSubmit}>
          <div className="modal__group">
            <label className="modal__label" htmlFor="audit-title">
              Titulo
            </label>
            <input
              id="audit-title"
              className="modal__input"
              type="text"
              value={form.title}
              onChange={(event) => updateForm({ title: event.target.value })}
            />
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="audit-actor">
              Responsavel
            </label>
            <input
              id="audit-actor"
              className="modal__input"
              type="text"
              value={form.actorName}
              onChange={(event) => updateForm({ actorName: event.target.value })}
            />
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="audit-description">
              Detalhes
            </label>
            <textarea
              id="audit-description"
              className="modal__input modal__textarea"
              value={form.description}
              onChange={(event) => updateForm({ description: event.target.value })}
            />
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="audit-metadata">
              Observacoes internas
            </label>
            <input
              id="audit-metadata"
              className="modal__input"
              type="text"
              value={form.metadata}
              onChange={(event) => updateForm({ metadata: event.target.value })}
            />
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
    </Page>
  )
}

export default AuditoriaPage
