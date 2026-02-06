import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '../../components/Modal'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { ProductionLot, ProductionLotStatus } from '../../types/erp'
import { formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'

type LotForm = {
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

  const handleProductChange = (productId: string) => {
    const product = products.find((item) => item.id === productId)
    const firstVariant = product?.variants?.[0]
    updateForm({
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
    if (editingId) {
      payload.lotesProducao = payload.lotesProducao.map((item) =>
        item.id === editingId ? next : item,
      )
    } else {
      payload.lotesProducao = [...payload.lotesProducao, next]
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

      {status && <p className="form__status">{status}</p>}

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
                    <td className="table__cell--mobile-hide">#{lot.id.slice(-6)}</td>
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
                Comprimento base (m)
              </label>
              <input
                id="lote-length"
                className="modal__input"
                type="number"
                step="0.01"
                min="0"
                value={form.customLength}
                onChange={(event) =>
                  updateForm({ customLength: Number(event.target.value) })
                }
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

          {status && <p className="modal__status">{status}</p>}
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
