import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import DimensionInput from '../../components/DimensionInput'
import Modal from '../../components/Modal'
import QuickNotice from '../../components/QuickNotice'
import { Page, PageHeader } from '@ui/components'
import { dataService } from '@shared/services/dataService'
import { useERPData } from '@shared/store/appStore'
import type { ProductionLot, ProductionLotStatus, ProductionOrder } from '@shared/types/erp'
import { formatDateShort } from '@shared/utils/format'
import { createId } from '@shared/utils/ids'
import { resolveOrderInternalCode } from '@shared/utils/orderCode'

type LotForm = {
  productionOrderId: string
  productId: string
  variantId: string
  quantity: number
  customLength: number
  moldedAt: string
  demoldedAt: string
  status: ProductionLotStatus
  notes: string
}

const statusLabels: Record<ProductionLotStatus, string> = {
  aguardando: 'Aguardando',
  produzindo: 'Produzindo',
  curando: 'Curando',
  pronto: 'Pronto',
}

const ProducaoLotes = () => {
  const { data, refresh } = useERPData()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<ProductionLotStatus | 'all'>('all')
  const [filterProductId, setFilterProductId] = useState('')
  const [form, setForm] = useState<LotForm>({
    productionOrderId: '',
    productId: '',
    variantId: '',
    quantity: 1,
    customLength: 0,
    moldedAt: '',
    demoldedAt: '',
    status: 'aguardando',
    notes: '',
  })
  const lotFormId = 'lote-form'

  const products = useMemo(
    () => [...data.produtos].filter((item) => item.active !== false),
    [data.produtos],
  )

  const productionOrders = useMemo(() => {
    return [...data.ordensProducao].sort((a, b) => {
      const aDate = a.finishedAt ?? a.plannedAt ?? ''
      const bDate = b.finishedAt ?? b.plannedAt ?? ''
      return bDate.localeCompare(aDate)
    })
  }, [data.ordensProducao])

  const lots = useMemo(
    () => [...data.lotesProducao].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.lotesProducao],
  )

  const filteredLots = useMemo(() => {
    return lots.filter((lot) => {
      const statusMatch = filterStatus === 'all' ? true : lot.status === filterStatus
      const productMatch = filterProductId ? lot.productId === filterProductId : true
      return statusMatch && productMatch
    })
  }, [filterProductId, filterStatus, lots])

  const summary = useMemo(() => {
    return lots.reduce(
      (acc, lot) => {
        acc.total += 1
        if (lot.status === 'aguardando') acc.waiting += 1
        if (lot.status === 'produzindo') acc.producing += 1
        if (lot.status === 'curando') acc.curing += 1
        if (lot.status === 'pronto') acc.ready += 1
        return acc
      },
      { total: 0, waiting: 0, producing: 0, curing: 0, ready: 0 },
    )
  }, [lots])

  const resetForm = () => {
    const firstProduct = products[0]
    const firstVariant = firstProduct?.variants?.[0]
    setForm({
      productionOrderId: '',
      productId: firstProduct?.id ?? '',
      variantId:
        firstProduct?.unit === 'metro_linear' || !firstProduct?.hasVariants
          ? ''
          : firstVariant?.id ?? '',
      quantity: 1,
      customLength:
        firstProduct?.unit === 'metro_linear'
          ? firstProduct.length && firstProduct.length > 0
            ? firstProduct.length
            : 1
          : 0,
      moldedAt: '',
      demoldedAt: '',
      status: 'aguardando',
      notes: '',
    })
    setEditingId(null)
    setEditingCreatedAt(null)
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

  const updateForm = (patch: Partial<LotForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleProductionChange = (productionOrderId: string) => {
    if (!productionOrderId) {
      updateForm({ productionOrderId: '' })
      return
    }
    const production = productionOrders.find((item) => item.id === productionOrderId)
    if (!production) {
      updateForm({ productionOrderId: '' })
      return
    }
    const product = products.find((item) => item.id === production.productId)
    const shouldUseVariant =
      product?.unit !== 'metro_linear' && (product?.hasVariants ?? false)
    const fallbackVariantId = shouldUseVariant ? product?.variants?.[0]?.id : ''
    updateForm({
      productionOrderId,
      productId: production.productId,
      variantId: shouldUseVariant ? production.variantId ?? fallbackVariantId ?? '' : '',
      quantity: production.quantity,
      customLength:
        product?.unit === 'metro_linear'
          ? production.customLength ?? product.length ?? 0
          : 0,
    })
  }

  const handleProductChange = (productId: string) => {
    const product = products.find((item) => item.id === productId)
    const firstVariant = product?.variants?.[0]
    const currentProduction = productionOrders.find(
      (item) => item.id === form.productionOrderId,
    )
    const productionOrderId =
      currentProduction && currentProduction.productId === productId
        ? form.productionOrderId
        : ''
    updateForm({
      productionOrderId,
      productId,
      variantId:
        product?.unit === 'metro_linear' || !product?.hasVariants
          ? ''
          : firstVariant?.id ?? '',
      customLength:
        product?.unit === 'metro_linear'
          ? product.length && product.length > 0
            ? product.length
            : 1
          : 0,
    })
  }

  const handleEdit = (lot: ProductionLot) => {
    setEditingId(lot.id)
    setEditingCreatedAt(lot.createdAt)
    setForm({
      productionOrderId: lot.productionOrderId ?? '',
      productId: lot.productId,
      variantId: lot.variantId ?? '',
      quantity: lot.quantity,
      customLength: lot.customLength ?? 0,
      moldedAt: lot.moldedAt ?? '',
      demoldedAt: lot.demoldedAt ?? lot.curingUntil ?? '',
      status: lot.status,
      notes: lot.notes ?? '',
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.productId) {
      setStatus('Selecione um produto para o lote.')
      return
    }
    if (form.quantity <= 0) {
      setStatus('Quantidade precisa ser maior que zero.')
      return
    }

    const product = products.find((item) => item.id === form.productId)
    const isLinear = product?.unit === 'metro_linear'
    const next: ProductionLot = {
      id: editingId ?? createId(),
      productionOrderId: form.productionOrderId || undefined,
      productId: form.productId,
      variantId:
        isLinear || !product?.hasVariants ? undefined : form.variantId || undefined,
      quantity: form.quantity,
      customLength: isLinear ? form.customLength || 0 : undefined,
      moldedAt: form.moldedAt || undefined,
      demoldedAt: form.demoldedAt || undefined,
      curingUntil: form.demoldedAt || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
      createdAt: editingCreatedAt ?? new Date().toISOString(),
    }

    const payload = dataService.getAll()
    const previousLot = editingId
      ? payload.lotesProducao.find((item) => item.id === editingId)
      : undefined
    if (editingId) {
      payload.lotesProducao = payload.lotesProducao.map((item) =>
        item.id === editingId ? next : item,
      )
    } else {
      payload.lotesProducao = [...payload.lotesProducao, next]
    }
    const shouldCreateDelivery =
      next.status === 'pronto' &&
      (!previousLot || previousLot.status !== 'pronto') &&
      next.productionOrderId
    if (shouldCreateDelivery) {
      const production = payload.ordensProducao.find(
        (item) => item.id === next.productionOrderId,
      )
      if (production) {
        const linkedOrderId = production.linkedOrderId ?? production.orderId
        const linkedOrder = payload.pedidos.find((item) => item.id === linkedOrderId)
        const linkedClient = linkedOrder
          ? payload.clientes.find((client) => client.id === linkedOrder.clientId)
          : undefined
        const linkedObra = linkedOrder?.obraId
          ? linkedClient?.obras?.find((obra) => obra.id === linkedOrder.obraId)
          : undefined
        const hasDelivery = payload.entregas.some(
          (delivery) => delivery.productionOrderId === production.id,
        )
        if (linkedOrder && !hasDelivery) {
          const matchedItem = linkedOrder.items.find(
            (item) =>
              item.productId === production.productId &&
              (item.variantId ?? '') === (production.variantId ?? '') &&
              (item.customLength ?? 0) === (production.customLength ?? 0),
          )
          payload.entregas = [
            ...payload.entregas,
            {
              id: createId(),
              orderId: linkedOrder.id,
              productionOrderId: production.id,
              clientId: linkedOrder.clientId,
              obraId: linkedObra?.id,
              address: linkedObra?.address,
              status: 'pendente',
              items: [
                {
                  productId: production.productId,
                  variantId: production.variantId,
                  customLength: production.customLength ?? matchedItem?.customLength,
                  customWidth: matchedItem?.customWidth,
                  customHeight: matchedItem?.customHeight,
                  unitPrice: matchedItem?.unitPrice,
                  quantity: production.quantity,
                },
              ],
              createdAt: new Date().toISOString(),
              scheduledAt: new Date().toISOString().slice(0, 10),
            },
          ]
        }
      }
    }
    const lengthLabel =
      next.customLength && next.customLength > 0 ? ` · ${next.customLength.toFixed(2)} m` : ''
    const description = `${product?.name ?? 'Produto'} · ${next.quantity} un${lengthLabel}`
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: editingId ? 'Lote atualizado' : 'Lote registrado',
        description,
      },
    })
    refresh()
    setStatus(editingId ? 'Lote atualizado.' : 'Lote registrado.')
    setIsModalOpen(false)
    resetForm()
  }

  const lotToDelete = deleteId ? data.lotesProducao.find((item) => item.id === deleteId) : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.lotesProducao = payload.lotesProducao.filter((item) => item.id !== deleteId)
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Lote removido',
        description: lotToDelete ? getProductName(lotToDelete.productId) : undefined,
      },
    })
    refresh()
    setIsModalOpen(false)
    resetForm()
    setStatus('Lote removido.')
    setDeleteId(null)
  }

  const getProductName = (id: string) =>
    data.produtos.find((product) => product.id === id)?.name ?? 'Produto'
  const getVariantName = (productId: string, variantId?: string) =>
    data.produtos
      .find((product) => product.id === productId)
      ?.variants?.find((variant) => variant.id === variantId)?.name ?? '-'
  const getLotCode = (lot: ProductionLot) => lot.code?.trim() || lot.id.slice(-6)
  const orderById = useMemo(
    () => new Map(data.pedidos.map((order) => [order.id, order])),
    [data.pedidos],
  )
  const getOrderCode = (orderId: string) => {
    const order = orderById.get(orderId)
    return order ? resolveOrderInternalCode(order) : orderId.slice(0, 6)
  }
  const getProductionLabel = (production: ProductionOrder) => {
    const productName = getProductName(production.productId)
    const variantName = production.variantId
      ? getVariantName(production.productId, production.variantId)
      : ''
    const linkedOrderId = production.linkedOrderId ?? production.orderId
    const linkedOrder = data.pedidos.find((item) => item.id === linkedOrderId)
    const sourceLabel = linkedOrder
      ? `Pedido #${getOrderCode(linkedOrder.id)}`
      : 'Ordem interna'
    const productionCode = production.code?.trim() || production.id.slice(0, 6)
    const variantLabel = variantName && variantName !== '-' ? ` · ${variantName}` : ''
    return `OP #${productionCode} · ${productName}${variantLabel} · ${sourceLabel}`
  }

  return (
    <Page className="lotes">
      <PageHeader
        actions={
          <button className="button button--primary" type="button" onClick={openModal}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              layers
            </span>
            <span className="page-header__action-label">Novo lote</span>
          </button>
        }
      />

      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Lotes ativos</span>
          <strong className="summary__value">{summary.total}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Aguardando</span>
          <strong className="summary__value">{summary.waiting}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Produzindo</span>
          <strong className="summary__value">{summary.producing}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Curando</span>
          <strong className="summary__value">{summary.curing}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Pronto</span>
          <strong className="summary__value">{summary.ready}</strong>
        </article>
      </div>

      <div className="filters">
        <div className="form__group">
          <label className="form__label" htmlFor="lotes-filter-status">
            Status
          </label>
          <select
            id="lotes-filter-status"
            className="form__input"
            value={filterStatus}
            onChange={(event) =>
              setFilterStatus(event.target.value as ProductionLotStatus | 'all')
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
          <label className="form__label" htmlFor="lotes-filter-product">
            Produto
          </label>
          <select
            id="lotes-filter-product"
            className="form__input"
            value={filterProductId}
            onChange={(event) => setFilterProductId(event.target.value)}
          >
            <option value="">Todos</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-card">
        <table className="table">
          <thead className="table__head table__head--mobile-hide">
            <tr>
              <th>Lote</th>
              <th>Produto</th>
              <th>Variante</th>
              <th>Qtd.</th>
              <th>Comprimento</th>
              <th>Moldagem</th>
              <th>Desforma</th>
              <th>Obs.</th>
              <th className="table__actions table__actions--end">Status / Editar</th>
            </tr>
          </thead>
          <tbody>
            {filteredLots.length === 0 ? (
              <tr>
                <td className="table__empty" colSpan={9}>
                  Nenhum lote registrado.
                </td>
              </tr>
            ) : (
              filteredLots.map((lot) => {
                const moldedAt = formatDateShort(lot.moldedAt ?? '')
                const demoldedAt = formatDateShort(lot.demoldedAt ?? lot.curingUntil ?? '')
                return (
                  <tr key={lot.id}>
                    <td className="table__cell--mobile-hide">#{getLotCode(lot)}</td>
                    <td className="table__cell--truncate">
                      <div className="table__stack">
                        <strong>{getProductName(lot.productId)}</strong>
                        <span className="table__sub table__sub--mobile">
                          Moldagem: {moldedAt}
                        </span>
                        <span className="table__sub table__sub--mobile">
                          Desenforma: {demoldedAt}
                        </span>
                      </div>
                    </td>
                    <td className="table__cell--mobile-hide">
                      {data.produtos.find((item) => item.id === lot.productId)?.hasVariants
                        ? getVariantName(lot.productId, lot.variantId)
                        : '-'}
                    </td>
                    <td className="table__cell--mobile-hide">{lot.quantity}</td>
                    <td className="table__cell--mobile-hide">
                      {lot.customLength && lot.customLength > 0
                        ? `${lot.customLength.toFixed(2)} m`
                        : '-'}
                    </td>
                    <td className="table__cell--mobile-hide">{moldedAt}</td>
                    <td className="table__cell--mobile-hide">{demoldedAt}</td>
                    <td className="table__cell--mobile-hide">{lot.notes ?? '-'}</td>
                    <td className="table__actions table__actions--end">
                      <div className="table__end">
                        <div className="table__status">
                          <span className={`badge badge--${lot.status}`}>
                            {statusLabels[lot.status]}
                          </span>
                        </div>
                        <ActionMenu
                          items={[
                            { label: 'Editar', onClick: () => handleEdit(lot) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={isModalOpen}
        title={editingId ? 'Editar lote' : 'Novo lote'}
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
            <button className="button button--primary" type="submit" form={lotFormId}>
              <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                save
              </span>
              <span className="modal__action-label">
                {editingId ? 'Salvar lote' : 'Registrar lote'}
              </span>
            </button>
          </>
        }
      >
        <form id={lotFormId} className="modal__form" onSubmit={handleSubmit}>
          <div className="modal__group">
            <label className="modal__label" htmlFor="lote-production">
              Ordem de producao
            </label>
            <select
              id="lote-production"
              className="modal__input"
              value={form.productionOrderId}
              onChange={(event) => handleProductionChange(event.target.value)}
            >
              <option value="">Nao associar</option>
              {productionOrders.map((production) => (
                <option key={production.id} value={production.id}>
                  {getProductionLabel(production)}
                </option>
              ))}
            </select>
          </div>

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="lote-product">
                Produto
              </label>
              <select
                id="lote-product"
                className="modal__input"
                value={form.productId}
                onChange={(event) => handleProductChange(event.target.value)}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            {data.produtos.find((product) => product.id === form.productId)?.hasVariants &&
              data.produtos.find((product) => product.id === form.productId)?.unit !==
                'metro_linear' && (
                <div className="modal__group">
                  <label className="modal__label" htmlFor="lote-variant">
                    Variante
                  </label>
                  <select
                    id="lote-variant"
                    className="modal__input"
                    value={form.variantId}
                    onChange={(event) => updateForm({ variantId: event.target.value })}
                  >
                    {data.produtos
                      .find((product) => product.id === form.productId)
                      ?.variants?.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
          </div>

          {data.produtos.find((product) => product.id === form.productId)?.unit ===
            'metro_linear' && (
            <div className="modal__group">
              <label className="modal__label" htmlFor="lote-length">
                Comprimento base
              </label>
              <DimensionInput
                id="lote-length"
                className="modal__input"
                min="0"
                step={0.01}
                value={form.customLength}
                onValueChange={(value) => updateForm({ customLength: value })}
              />
            </div>
          )}

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="lote-quantity">
                Quantidade
              </label>
              <input
                id="lote-quantity"
                className="modal__input"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(event) =>
                  updateForm({ quantity: Number(event.target.value) })
                }
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="lote-status">
                Status
              </label>
              <select
                id="lote-status"
                className="modal__input"
                value={form.status}
                onChange={(event) =>
                  updateForm({ status: event.target.value as ProductionLotStatus })
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

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="lote-molded">
                Data de moldagem
              </label>
              <input
                id="lote-molded"
                className="modal__input"
                type="date"
                value={form.moldedAt}
                onChange={(event) => updateForm({ moldedAt: event.target.value })}
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="lote-demolded">
                Desforma
              </label>
              <input
                id="lote-demolded"
                className="modal__input"
                type="date"
                value={form.demoldedAt}
                onChange={(event) => updateForm({ demoldedAt: event.target.value })}
              />
            </div>
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="lote-notes">
              Observacoes
            </label>
            <textarea
              id="lote-notes"
              className="modal__input modal__textarea"
              value={form.notes}
              onChange={(event) => updateForm({ notes: event.target.value })}
            />
          </div>

        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir lote?"
        description={
          lotToDelete
            ? `Lote de ${getProductName(lotToDelete.productId)} sera removido.`
            : 'Este lote sera removido.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </Page>
  )
}

export default ProducaoLotes
