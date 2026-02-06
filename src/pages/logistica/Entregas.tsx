import { useMemo, useState, type FormEvent } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '../../components/Modal'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { Delivery } from '../../types/erp'
import { formatDateShort } from '../../utils/format'

type ProofOption = 'nenhum' | 'foto' | 'assinatura'

type DeliveryForm = {
  scheduledAt: string
  address: string
  vehicle: string
  driver: string
  isPartial: boolean
  proofType: ProofOption
  proofNote: string
  occurrence: string
  status: Delivery['status']
}

const statusLabels: Record<Delivery['status'], string> = {
  pendente: 'Pendente',
  em_rota: 'Em rota',
  entregue: 'Entregue',
}

const proofLabels: Record<Exclude<ProofOption, 'nenhum'>, string> = {
  foto: 'Foto',
  assinatura: 'Assinatura',
}

const defaultForm: DeliveryForm = {
  scheduledAt: '',
  address: '',
  vehicle: '',
  driver: '',
  isPartial: false,
  proofType: 'nenhum',
  proofNote: '',
  occurrence: '',
  status: 'pendente',
}

const Entregas = () => {
  const { data, refresh } = useERPData()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<DeliveryForm>(defaultForm)
  const deliveryFormId = 'entrega-form'

  const deliveries = useMemo(
    () =>
      [...data.entregas].sort((a, b) => {
        const aDate = a.scheduledAt ?? a.createdAt
        const bDate = b.scheduledAt ?? b.createdAt
        return aDate.localeCompare(bDate)
      }),
    [data.entregas],
  )

  const summary = useMemo(() => {
    return deliveries.reduce(
      (acc, delivery) => {
        acc.total += 1
        if (delivery.status === 'pendente') {
          acc.pending += 1
        }
        if (delivery.status === 'em_rota') {
          acc.inRoute += 1
        }
        if (delivery.status === 'entregue') {
          acc.delivered += 1
        }
        return acc
      },
      { total: 0, pending: 0, inRoute: 0, delivered: 0 },
    )
  }, [deliveries])

  const agenda = useMemo(() => deliveries.slice(0, 6), [deliveries])
  const occurrences = useMemo(
    () => deliveries.filter((delivery) => delivery.occurrence).slice(0, 6),
    [deliveries],
  )

  const findClient = (clientId: string) =>
    data.clientes.find((client) => client.id === clientId)

  const findObra = (obraId?: string | null) => {
    if (!obraId) {
      return null
    }
    for (const client of data.clientes) {
      const obra = client.obras?.find((item) => item.id === obraId)
      if (obra) {
        return obra
      }
    }
    return null
  }

  const getAddress = (delivery: Delivery, fallback = '-') => {
    if (delivery.address) {
      return delivery.address
    }
    const obra = findObra(delivery.obraId)
    return obra?.address ?? fallback
  }

  const openEdit = (delivery: Delivery) => {
    const scheduled = delivery.scheduledAt ? delivery.scheduledAt.slice(0, 10) : ''
    setEditingId(delivery.id)
    setForm({
      scheduledAt: scheduled,
      address: delivery.address ?? getAddress(delivery, ''),
      vehicle: delivery.vehicle ?? '',
      driver: delivery.driver ?? '',
      isPartial: delivery.isPartial ?? false,
      proofType: delivery.proofType ?? 'nenhum',
      proofNote: delivery.proofNote ?? '',
      occurrence: delivery.occurrence ?? '',
      status: delivery.status,
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingId(null)
    setStatus(null)
    setForm(defaultForm)
  }

  const updateForm = (patch: Partial<DeliveryForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId) {
      return
    }
    const payload = dataService.getAll()
    const current = payload.entregas.find((delivery) => delivery.id === editingId)
    if (!current) {
      setStatus('Entrega nao encontrada.')
      return
    }
    const updated: Delivery = {
      ...current,
      scheduledAt: form.scheduledAt || undefined,
      address: form.address.trim() || undefined,
      vehicle: form.vehicle.trim() || undefined,
      driver: form.driver.trim() || undefined,
      isPartial: form.isPartial,
      proofType: form.proofType === 'nenhum' ? undefined : form.proofType,
      proofNote: form.proofNote.trim() || undefined,
      occurrence: form.occurrence.trim() || undefined,
      status: form.status,
    }
    payload.entregas = payload.entregas.map((delivery) =>
      delivery.id === updated.id ? updated : delivery,
    )
    if (updated.status === 'entregue') {
      const relatedDeliveries = payload.entregas.filter(
        (delivery) => delivery.orderId === updated.orderId,
      )
      const allDelivered = relatedDeliveries.every((delivery) =>
        delivery.id === updated.id ? updated.status === 'entregue' : delivery.status === 'entregue',
      )
      if (allDelivered) {
        payload.pedidos = payload.pedidos.map((order) =>
          order.id === updated.orderId && order.status !== 'entregue'
            ? { ...order, status: 'entregue' }
            : order,
        )
      }
    }
    dataService.replaceAll(payload)
    refresh()
    setStatus('Entrega atualizada.')
    setIsModalOpen(false)
    setEditingId(null)
    setForm(defaultForm)
  }

  const deliveryToDelete = deleteId
    ? data.entregas.find((delivery) => delivery.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.entregas = payload.entregas.filter((delivery) => delivery.id !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Entrega excluida.')
    setDeleteId(null)
  }

  return (
    <Page className="entregas">
      <PageHeader />

      {status && <p className="form__status">{status}</p>}

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Total de entregas</span>
          <strong className="summary__value">{summary.total}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Pendentes</span>
          <strong className="summary__value">{summary.pending}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Em rota</span>
          <strong className="summary__value">{summary.inRoute}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Entregues</span>
          <strong className="summary__value">{summary.delivered}</strong>
        </article>
      </div>

      <div className="grid grid--two">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Agenda de entrega</h2>
              <p className="panel__subtitle">Proximas entregas registradas</p>
            </div>
          </div>
          <div className="list">
            {agenda.length === 0 && (
              <div className="list__empty">Nenhuma entrega programada.</div>
            )}
            {agenda.map((delivery) => {
              const client = findClient(delivery.clientId)
              const obra = findObra(delivery.obraId)
              const schedule = delivery.scheduledAt
                ? formatDateShort(delivery.scheduledAt)
                : 'Sem agenda'
              return (
                <div key={delivery.id} className="list__item">
                  <div>
                    <strong>{client?.name ?? 'Cliente'}</strong>
                    <span className="list__meta">
                      {obra?.name ?? 'Obra'} • {schedule}
                    </span>
                  </div>
                  <span className={`badge badge--${delivery.status}`}>
                    {statusLabels[delivery.status]}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Ocorrencias recentes</h2>
              <p className="panel__subtitle">Atrasos, quebras e pendencias</p>
            </div>
          </div>
          <div className="list">
            {occurrences.length === 0 && (
              <div className="list__empty">Nenhuma ocorrencia registrada.</div>
            )}
            {occurrences.map((delivery) => {
              const client = findClient(delivery.clientId)
              const obra = findObra(delivery.obraId)
              return (
                <div key={delivery.id} className="list__item">
                  <div>
                    <strong>{delivery.occurrence}</strong>
                    <span className="list__meta">
                      {client?.name ?? 'Cliente'} • {obra?.name ?? 'Obra'}
                    </span>
                  </div>
                  <span className={`badge badge--${delivery.status}`}>
                    {statusLabels[delivery.status]}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <section className="panel panel--full">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Entregas detalhadas</h2>
            <p className="panel__subtitle">Enderecos, veiculos e comprovantes</p>
          </div>
        </div>
        <div className="card-grid">
          {deliveries.length === 0 && (
            <div className="list__empty">Nenhuma entrega registrada ainda.</div>
          )}
          {deliveries.map((delivery) => {
            const client = findClient(delivery.clientId)
            const obra = findObra(delivery.obraId)
            const schedule = delivery.scheduledAt
              ? formatDateShort(delivery.scheduledAt)
              : 'Sem agenda'
            const address = getAddress(delivery)
            const proofLabel = delivery.proofType
              ? proofLabels[delivery.proofType]
              : 'Nao informado'
            const proofDetail = delivery.proofNote ? ` • ${delivery.proofNote}` : ''
            const partialLabel = delivery.isPartial ? 'Parcial' : 'Completa'
            const vehicleLabel =
              delivery.vehicle || delivery.driver
                ? `${delivery.vehicle || 'Veiculo a definir'} • ${delivery.driver || 'Motorista a definir'}`
                : 'Nao definido'
            return (
              <article key={delivery.id} className="card">
                <header className="card__header">
                  <div>
                    <h3 className="card__title">
                      {client?.name ?? 'Cliente'} • {obra?.name ?? 'Obra'}
                    </h3>
                    <span className="card__meta">
                      Pedido #{delivery.orderId.slice(0, 6)}
                    </span>
                  </div>
                  <span className={`badge badge--${delivery.status}`}>
                    {statusLabels[delivery.status]}
                  </span>
                </header>

                <div className="card__grid">
                  <div className="card__detail">
                    <span className="card__detail-label">Agenda de entrega</span>
                    <strong className="card__detail-value">{schedule}</strong>
                  </div>
                  <div className="card__detail">
                    <span className="card__detail-label">Endereco da obra</span>
                    <strong className="card__detail-value">{address}</strong>
                  </div>
                  <div className="card__detail">
                    <span className="card__detail-label">Veiculo e motorista</span>
                    <strong className="card__detail-value">{vehicleLabel}</strong>
                  </div>
                  <div className="card__detail">
                    <span className="card__detail-label">Entrega parcial</span>
                    <strong className="card__detail-value">{partialLabel}</strong>
                  </div>
                  <div className="card__detail">
                    <span className="card__detail-label">Comprovante</span>
                    <strong className="card__detail-value">
                      {proofLabel}
                      {proofDetail}
                    </strong>
                  </div>
                  <div className="card__detail">
                    <span className="card__detail-label">Ocorrencias</span>
                    <strong className="card__detail-value">
                      {delivery.occurrence || 'Sem ocorrencias'}
                    </strong>
                  </div>
                </div>

                <div className="card__actions card__actions--end">
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => openEdit(delivery)}
                  >
                    Atualizar
                  </button>
                  <button
                    className="button button--danger"
                    type="button"
                    onClick={() => setDeleteId(delivery.id)}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title="Atualizar entrega"
        size="lg"
        actions={
          <button className="button button--primary" type="submit" form={deliveryFormId}>
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              save
            </span>
            <span className="modal__action-label">Salvar ajustes</span>
          </button>
        }
      >
        <form id={deliveryFormId} className="modal__form" onSubmit={handleSubmit}>
          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="delivery-date">
                Agenda de entrega
              </label>
              <input
                id="delivery-date"
                className="modal__input"
                type="date"
                value={form.scheduledAt}
                onChange={(event) => updateForm({ scheduledAt: event.target.value })}
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="delivery-status">
                Status
              </label>
              <select
                id="delivery-status"
                className="modal__input"
                value={form.status}
                onChange={(event) =>
                  updateForm({ status: event.target.value as Delivery['status'] })
                }
              >
                <option value="pendente">Pendente</option>
                <option value="em_rota">Em rota</option>
                <option value="entregue">Entregue</option>
              </select>
            </div>
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="delivery-address">
              Endereco da obra
            </label>
            <input
              id="delivery-address"
              className="modal__input"
              type="text"
              value={form.address}
              onChange={(event) => updateForm({ address: event.target.value })}
              placeholder="Rua, numero, bairro"
            />
          </div>

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="delivery-vehicle">
                Veiculo
              </label>
              <input
                id="delivery-vehicle"
                className="modal__input"
                type="text"
                value={form.vehicle}
                onChange={(event) => updateForm({ vehicle: event.target.value })}
                placeholder="Ex: Caminhao 01"
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="delivery-driver">
                Motorista
              </label>
              <input
                id="delivery-driver"
                className="modal__input"
                type="text"
                value={form.driver}
                onChange={(event) => updateForm({ driver: event.target.value })}
                placeholder="Nome do motorista"
              />
            </div>
          </div>

          <label className="toggle modal__checkbox">
            <input
              type="checkbox"
              checked={form.isPartial}
              onChange={(event) => updateForm({ isPartial: event.target.checked })}
            />
            <span className="toggle__track" aria-hidden="true">
              <span className="toggle__thumb" />
            </span>
            <span className="toggle__label">Entrega parcial</span>
          </label>

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="delivery-proof">
                Comprovante
              </label>
              <select
                id="delivery-proof"
                className="modal__input"
                value={form.proofType}
                onChange={(event) => updateForm({ proofType: event.target.value as ProofOption })}
              >
                <option value="nenhum">Nao informado</option>
                <option value="foto">Foto</option>
                <option value="assinatura">Assinatura</option>
              </select>
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="delivery-proof-note">
                Detalhe do comprovante
              </label>
              <input
                id="delivery-proof-note"
                className="modal__input"
                type="text"
                value={form.proofNote}
                onChange={(event) => updateForm({ proofNote: event.target.value })}
                placeholder="Ex: Foto enviada no WhatsApp"
              />
            </div>
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="delivery-occurrence">
              Ocorrencias
            </label>
            <textarea
              id="delivery-occurrence"
              className="modal__input modal__textarea"
              value={form.occurrence}
              onChange={(event) => updateForm({ occurrence: event.target.value })}
              placeholder="Atraso, quebra ou cliente nao recebeu"
            />
          </div>

          {status && <p className="modal__status">{status}</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir entrega?"
        description={
          deliveryToDelete
            ? `A entrega do pedido ${deliveryToDelete.orderId.slice(0, 6)} sera removida.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </Page>
  )
}

export default Entregas
