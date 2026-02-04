import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '../../components/Modal'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { FiscalNote, FiscalNoteStatus, FiscalNoteType } from '../../types/erp'
import { formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'

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

  const clients = useMemo(
    () => [...data.clientes].sort((a, b) => a.name.localeCompare(b.name)),
    [data.clientes],
  )

  const orders = useMemo(
    () => [...data.pedidos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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
  const getOrderLabel = (id?: string) => (id ? `#${id.slice(-6)}` : '-')

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
    setStatus('Nota fiscal removida.')
    setDeleteId(null)
  }

  return (
    <Page className="fiscal">
      <PageHeader
        title="Notas fiscais"
        actions={
          <button className="button button--primary" type="button" onClick={openModal}>
            Nova nota
          </button>
        }
      />

      {status && <p className="form__status">{status}</p>}

      <div className="fiscal__summary summary-card">
        <article className="fiscal__stat">
          <span className="fiscal__stat-label">Registros</span>
          <strong className="fiscal__stat-value">{summary.total}</strong>
        </article>
        <article className="fiscal__stat">
          <span className="fiscal__stat-label">Pendentes</span>
          <strong className="fiscal__stat-value">{summary.pending}</strong>
        </article>
        <article className="fiscal__stat">
          <span className="fiscal__stat-label">Autorizadas</span>
          <strong className="fiscal__stat-value">{summary.approved}</strong>
        </article>
        <article className="fiscal__stat">
          <span className="fiscal__stat-label">Canceladas</span>
          <strong className="fiscal__stat-value">{summary.canceled}</strong>
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
              <th>Status</th>
              <th>XML</th>
              <th className="table__actions">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 ? (
              <tr>
                <td className="table__empty" colSpan={9}>
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
                  <td>
                    <span className={`badge badge--${note.status}`}>
                      {statusLabels[note.status]}
                    </span>
                  </td>
                  <td>{note.xmlStored ? 'Sim' : 'Nao'}</td>
                  <td className="table__actions">
                    <ActionMenu
                      items={[
                        { label: 'Editar', onClick: () => handleEdit(note) },
                        { label: 'Excluir', onClick: () => setDeleteId(note.id) },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={isModalOpen} title={editingId ? 'Editar nota' : 'Nova nota'} onClose={closeModal}>
        <form className="form" onSubmit={handleSubmit}>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="fiscal-type">
                Tipo de nota
              </label>
              <select
                id="fiscal-type"
                className="form__input"
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
            <div className="form__group">
              <label className="form__label" htmlFor="fiscal-status">
                Status
              </label>
              <select
                id="fiscal-status"
                className="form__input"
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

          <div className="form__group">
            <label className="form__label" htmlFor="fiscal-order">
              Pedido vinculado
            </label>
            <select
              id="fiscal-order"
              className="form__input"
              value={form.orderId}
              onChange={(event) => handleOrderChange(event.target.value)}
            >
              <option value="">Sem pedido</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  #{order.id.slice(-6)} · {getClientName(order.clientId)} ·{' '}
                  {order.total.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="fiscal-client">
              Cliente
            </label>
            <select
              id="fiscal-client"
              className="form__input"
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

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="fiscal-number">
                Numero
              </label>
              <input
                id="fiscal-number"
                className="form__input"
                type="text"
                value={form.number}
                onChange={(event) => updateForm({ number: event.target.value })}
                placeholder="Numero da nota"
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="fiscal-series">
                Serie
              </label>
              <input
                id="fiscal-series"
                className="form__input"
                type="text"
                value={form.series}
                onChange={(event) => updateForm({ series: event.target.value })}
                placeholder="Serie"
              />
            </div>
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="fiscal-date">
                Data de emissao
              </label>
              <input
                id="fiscal-date"
                className="form__input"
                type="date"
                value={form.issueDate}
                onChange={(event) => updateForm({ issueDate: event.target.value })}
              />
            </div>
            <label className="form__checkbox">
              <input
                type="checkbox"
                checked={form.xmlStored}
                onChange={(event) => updateForm({ xmlStored: event.target.checked })}
              />
              XML armazenado
            </label>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="fiscal-notes">
              Observacoes
            </label>
            <textarea
              id="fiscal-notes"
              className="form__input form__textarea"
              value={form.notes}
              onChange={(event) => updateForm({ notes: event.target.value })}
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
