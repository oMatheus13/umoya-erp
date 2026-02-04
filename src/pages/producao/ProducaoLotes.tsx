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
        title="Lotes"
        actions={
          <button className="button button--primary" type="button" onClick={openModal}>
            Novo lote
          </button>
        }
      />

      {status && <p className="form__status">{status}</p>}

      <div className="lotes__summary summary-card">
        <article className="lotes__stat">
          <span className="lotes__stat-label">Lotes ativos</span>
          <strong className="lotes__stat-value">{summary.total}</strong>
        </article>
        <article className="lotes__stat">
          <span className="lotes__stat-label">Aguardando</span>
          <strong className="lotes__stat-value">{summary.waiting}</strong>
        </article>
        <article className="lotes__stat">
          <span className="lotes__stat-label">Produzindo</span>
          <strong className="lotes__stat-value">{summary.producing}</strong>
        </article>
        <article className="lotes__stat">
          <span className="lotes__stat-label">Curando</span>
          <strong className="lotes__stat-value">{summary.curing}</strong>
        </article>
        <article className="lotes__stat">
          <span className="lotes__stat-label">Pronto</span>
          <strong className="lotes__stat-value">{summary.ready}</strong>
        </article>
      </div>

      <div className="lotes__filters">
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
          <thead>
            <tr>
              <th>Lote</th>
              <th>Produto</th>
              <th>Variante</th>
              <th>Qtd.</th>
              <th>Comprimento</th>
              <th>Moldagem</th>
              <th>Desforma</th>
              <th>Status</th>
              <th>Obs.</th>
              <th className="table__actions">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {filteredLots.length === 0 ? (
              <tr>
                <td className="table__empty" colSpan={10}>
                  Nenhum lote registrado.
                </td>
              </tr>
            ) : (
              filteredLots.map((lot) => (
                <tr key={lot.id}>
                  <td>#{lot.id.slice(-6)}</td>
                  <td>{getProductName(lot.productId)}</td>
                  <td>
                    {data.produtos.find((item) => item.id === lot.productId)?.hasVariants
                      ? getVariantName(lot.productId, lot.variantId)
                      : '-'}
                  </td>
                  <td>{lot.quantity}</td>
                  <td>
                    {lot.customLength && lot.customLength > 0
                      ? `${lot.customLength.toFixed(2)} m`
                      : '-'}
                  </td>
                  <td>{formatDateShort(lot.moldedAt ?? '')}</td>
                  <td>{formatDateShort(lot.demoldedAt ?? lot.curingUntil ?? '')}</td>
                  <td>
                    <span className={`badge badge--${lot.status}`}>{statusLabels[lot.status]}</span>
                  </td>
                  <td>{lot.notes ?? '-'}</td>
                  <td className="table__actions">
                    <ActionMenu
                      items={[
                        { label: 'Editar', onClick: () => handleEdit(lot) },
                        { label: 'Excluir', onClick: () => setDeleteId(lot.id) },
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
        title={editingId ? 'Editar lote' : 'Novo lote'}
        onClose={closeModal}
      >
        <form className="form" onSubmit={handleSubmit}>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="lote-product">
                Produto
              </label>
              <select
                id="lote-product"
                className="form__input"
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
                <div className="form__group">
                  <label className="form__label" htmlFor="lote-variant">
                    Variante
                  </label>
                  <select
                    id="lote-variant"
                    className="form__input"
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
            <div className="form__group">
              <label className="form__label" htmlFor="lote-length">
                Comprimento base (m)
              </label>
              <input
                id="lote-length"
                className="form__input"
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

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="lote-quantity">
                Quantidade
              </label>
              <input
                id="lote-quantity"
                className="form__input"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(event) =>
                  updateForm({ quantity: Number(event.target.value) })
                }
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="lote-status">
                Status
              </label>
              <select
                id="lote-status"
                className="form__input"
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

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="lote-molded">
                Data de moldagem
              </label>
              <input
                id="lote-molded"
                className="form__input"
                type="date"
                value={form.moldedAt}
                onChange={(event) => updateForm({ moldedAt: event.target.value })}
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="lote-demolded">
                Desforma
              </label>
              <input
                id="lote-demolded"
                className="form__input"
                type="date"
                value={form.demoldedAt}
                onChange={(event) => updateForm({ demoldedAt: event.target.value })}
              />
            </div>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="lote-notes">
              Observacoes
            </label>
            <textarea
              id="lote-notes"
              className="form__input form__textarea"
              value={form.notes}
              onChange={(event) => updateForm({ notes: event.target.value })}
            />
          </div>

          {status && <p className="form__status">{status}</p>}

          <div className="form__actions">
            <button className="button button--primary" type="submit">
              {editingId ? 'Salvar lote' : 'Registrar lote'}
            </button>
            <button className="button button--ghost" type="button" onClick={closeModal}>
              Cancelar
            </button>
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
