import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '@shared/components/Modal'
import QuickNotice from '@shared/components/QuickNotice'
import { Page, PageHeader } from '@ui/components'
import { dataService } from '@shared/services/dataService'
import { useERPData } from '@shared/store/appStore'
import type { FiscalNote, FiscalNoteStatus, FiscalNoteType } from '@shared/types/erp'
import { formatDateShort } from '@shared/utils/format'
import { createId } from '@shared/utils/ids'
import { resolveOrderInternalCode } from '@shared/utils/orderCode'

type FiscalForm = {
  type: FiscalNoteType
  orderId: string
  clientId: string
  number: string
  series: string
  issueDate: string
  status: FiscalNoteStatus
  xmlStored: boolean
  notes: string
}

const typeLabels: Record<FiscalNoteType, string> = {
  nfe: 'NF-e',
  nfse: 'NFS-e',
}

const statusLabels: Record<FiscalNoteStatus, string> = {
  pendente: 'Pendente',
  autorizada: 'Autorizada',
  cancelada: 'Cancelada',
}

const Fiscal = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<FiscalForm>({
    type: 'nfe',
    orderId: '',
    clientId: '',
    number: '',
    series: '',
    issueDate: '',
    status: 'pendente',
    xmlStored: false,
    notes: '',
  })
  const fiscalFormId = 'fiscal-form'

  const clients = useMemo(
    () => [...data.clientes].sort((a, b) => a.name.localeCompare(b.name)),
    [data.clientes],
  )

  const orders = useMemo(
    () => [...data.pedidos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.pedidos],
  )
  const orderById = useMemo(
    () => new Map(data.pedidos.map((order) => [order.id, order])),
    [data.pedidos],
  )

  const notes = useMemo(
    () => [...data.fiscalNotas].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.fiscalNotas],
  )

  const summary = useMemo(() => {
    return notes.reduce(
      (acc, note) => {
        acc.total += 1
        if (note.status === 'pendente') acc.pending += 1
        if (note.status === 'autorizada') acc.approved += 1
        if (note.status === 'cancelada') acc.canceled += 1
        return acc
      },
      { total: 0, pending: 0, approved: 0, canceled: 0 },
    )
  }, [notes])

  const getClientName = (id?: string) =>
    clients.find((client) => client.id === id)?.name ?? 'Cliente'
  const getOrderLabel = (id?: string) => {
    if (!id) {
      return '-'
    }
    const order = orderById.get(id)
    const code = order ? resolveOrderInternalCode(order) : id.slice(0, 6)
    return `#${code}`
  }

  const resetForm = () => {
    setForm({
      type: 'nfe',
      orderId: '',
      clientId: '',
      number: '',
      series: '',
      issueDate: '',
      status: 'pendente',
      xmlStored: false,
      notes: '',
    })
    setEditingId(null)
  }

  const openModal = () => {
    resetForm()
    setStatus(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setStatus(null)
    resetForm()
  }

  const updateForm = (patch: Partial<FiscalForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleOrderChange = (orderId: string) => {
    const order = orders.find((item) => item.id === orderId)
    updateForm({
      orderId,
      clientId: order?.clientId ?? form.clientId,
    })
  }

  const handleEdit = (note: FiscalNote) => {
    setEditingId(note.id)
    setForm({
      type: note.type,
      orderId: note.orderId ?? '',
      clientId: note.clientId ?? '',
      number: note.number ?? '',
      series: note.series ?? '',
      issueDate: note.issueDate ?? '',
      status: note.status,
      xmlStored: note.xmlStored ?? false,
      notes: note.notes ?? '',
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.clientId && !form.orderId) {
      setStatus('Selecione um pedido ou cliente.')
      return
    }

    const next: FiscalNote = {
      id: editingId ?? createId(),
      type: form.type,
      orderId: form.orderId || undefined,
      clientId: form.clientId || undefined,
      number: form.number.trim() || undefined,
      series: form.series.trim() || undefined,
      issueDate: form.issueDate || undefined,
      status: form.status,
      xmlStored: form.xmlStored,
      notes: form.notes.trim() || undefined,
      createdAt: editingId
        ? data.fiscalNotas.find((item) => item.id === editingId)?.createdAt ??
          new Date().toISOString()
        : new Date().toISOString(),
    }

    const payload = dataService.getAll()
    if (editingId) {
      payload.fiscalNotas = payload.fiscalNotas.map((item) =>
        item.id === editingId ? next : item,
      )
    } else {
      payload.fiscalNotas = [...payload.fiscalNotas, next]
    }

    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: editingId ? 'Nota fiscal atualizada' : 'Nota fiscal criada',
        description: `${typeLabels[next.type]} · ${getClientName(next.clientId)}`,
      },
    })
    refresh()
    setStatus(editingId ? 'Nota fiscal atualizada.' : 'Nota fiscal registrada.')
    setIsModalOpen(false)
    resetForm()
  }

  const noteToDelete = deleteId ? data.fiscalNotas.find((item) => item.id === deleteId) : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.fiscalNotas = payload.fiscalNotas.filter((item) => item.id !== deleteId)
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Nota fiscal removida',
        description: noteToDelete ? getClientName(noteToDelete.clientId) : undefined,
      },
    })
    refresh()
    setIsModalOpen(false)
    resetForm()
    setStatus('Nota fiscal removida.')
    setDeleteId(null)
  }

  return (
    <Page className="fiscal">
      <PageHeader
        actions={
          <button className="button button--primary" type="button" onClick={openModal}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              receipt
            </span>
            <span className="page-header__action-label">Nova nota</span>
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
          <span className="summary__label">Pendentes</span>
          <strong className="summary__value">{summary.pending}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Autorizadas</span>
          <strong className="summary__value">{summary.approved}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Canceladas</span>
          <strong className="summary__value">{summary.canceled}</strong>
        </article>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Numero</th>
              <th>Serie</th>
              <th>XML</th>
              <th className="table__actions table__actions--end">Status / Editar</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 ? (
              <tr>
                <td className="table__empty" colSpan={8}>
                  Nenhuma nota fiscal registrada.
                </td>
              </tr>
            ) : (
              notes.map((note) => (
                <tr key={note.id}>
                  <td>{formatDateShort(note.issueDate ?? note.createdAt)}</td>
                  <td>{typeLabels[note.type]}</td>
                  <td>{getOrderLabel(note.orderId)}</td>
                  <td>{getClientName(note.clientId)}</td>
                  <td>{note.number ?? '-'}</td>
                  <td>{note.series ?? '-'}</td>
                  <td>{note.xmlStored ? 'Sim' : 'Nao'}</td>
                  <td className="table__actions table__actions--end">
                    <div className="table__end">
                      <div className="table__status">
                        <span className={`badge badge--${note.status}`}>
                          {statusLabels[note.status]}
                        </span>
                      </div>
                      <ActionMenu
                        items={[
                          { label: 'Editar', onClick: () => handleEdit(note) },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={isModalOpen}
        title={editingId ? 'Editar nota' : 'Nova nota'}
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
            <button className="button button--primary" type="submit" form={fiscalFormId}>
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
        <form id={fiscalFormId} className="modal__form" onSubmit={handleSubmit}>
          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="fiscal-type">
                Tipo de nota
              </label>
              <select
                id="fiscal-type"
                className="modal__input"
                value={form.type}
                onChange={(event) =>
                  updateForm({ type: event.target.value as FiscalNoteType })
                }
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="fiscal-status">
                Status
              </label>
              <select
                id="fiscal-status"
                className="modal__input"
                value={form.status}
                onChange={(event) =>
                  updateForm({ status: event.target.value as FiscalNoteStatus })
                }
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="fiscal-order">
              Pedido vinculado
            </label>
            <select
              id="fiscal-order"
              className="modal__input"
              value={form.orderId}
              onChange={(event) => handleOrderChange(event.target.value)}
            >
              <option value="">Sem pedido</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  #{resolveOrderInternalCode(order)} · {getClientName(order.clientId)} ·{' '}
                  {order.total.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="fiscal-client">
              Cliente
            </label>
            <select
              id="fiscal-client"
              className="modal__input"
              value={form.clientId}
              onChange={(event) => updateForm({ clientId: event.target.value })}
            >
              <option value="">Selecionar cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="fiscal-number">
                Numero
              </label>
              <input
                id="fiscal-number"
                className="modal__input"
                type="text"
                value={form.number}
                onChange={(event) => updateForm({ number: event.target.value })}
                placeholder="Numero da nota"
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="fiscal-series">
                Serie
              </label>
              <input
                id="fiscal-series"
                className="modal__input"
                type="text"
                value={form.series}
                onChange={(event) => updateForm({ series: event.target.value })}
                placeholder="Serie"
              />
            </div>
          </div>

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="fiscal-date">
                Data de emissao
              </label>
              <input
                id="fiscal-date"
                className="modal__input"
                type="date"
                value={form.issueDate}
                onChange={(event) => updateForm({ issueDate: event.target.value })}
              />
            </div>
            <label className="toggle modal__checkbox">
              <input
                type="checkbox"
                checked={form.xmlStored}
                onChange={(event) => updateForm({ xmlStored: event.target.checked })}
              />
              <span className="toggle__track" aria-hidden="true">
                <span className="toggle__thumb" />
              </span>
              <span className="toggle__label">XML armazenado</span>
            </label>
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="fiscal-notes">
              Observacoes
            </label>
            <textarea
              id="fiscal-notes"
              className="modal__input modal__textarea"
              value={form.notes}
              onChange={(event) => updateForm({ notes: event.target.value })}
            />
          </div>

        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir nota fiscal?"
        description={
          noteToDelete
            ? `Nota ${noteToDelete.number ?? ''} sera removida.`
            : 'Esta nota sera removida.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </Page>
  )
}

export default Fiscal
