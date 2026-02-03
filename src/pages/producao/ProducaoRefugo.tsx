import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '../../components/Modal'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { ProductionScrap, ProductionScrapStatus, ProductionScrapType } from '../../types/erp'
import { formatCurrency, formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'

type ScrapForm = {
  productId: string
  variantId: string
  productionOrderId: string
  quantity: number
  type: ProductionScrapType
  reason: string
  estimatedCost: number
  status: ProductionScrapStatus
  notes: string
}

const typeLabels: Record<ProductionScrapType, string> = {
  refugo: 'Refugo',
  retrabalho: 'Retrabalho',
}

const statusLabels: Record<ProductionScrapStatus, string> = {
  aberto: 'Em aberto',
  resolvido: 'Resolvido',
}

const ProducaoRefugo = () => {
  const { data, refresh } = useERPData()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<ProductionScrapType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<ProductionScrapStatus | 'all'>('all')
  const [form, setForm] = useState<ScrapForm>({
    productId: '',
    variantId: '',
    productionOrderId: '',
    quantity: 1,
    type: 'refugo',
    reason: '',
    estimatedCost: 0,
    status: 'aberto',
    notes: '',
  })

  const products = useMemo(
    () => [...data.produtos].filter((item) => item.active !== false),
    [data.produtos],
  )

  const scraps = useMemo(
    () => [...data.refugosProducao].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.refugosProducao],
  )

  const filteredScraps = useMemo(() => {
    return scraps.filter((scrap) => {
      const typeMatch = filterType === 'all' ? true : scrap.type === filterType
      const statusMatch = filterStatus === 'all' ? true : scrap.status === filterStatus
      return typeMatch && statusMatch
    })
  }, [filterStatus, filterType, scraps])

  const summary = useMemo(() => {
    return scraps.reduce(
      (acc, scrap) => {
        acc.total += 1
        acc.items += scrap.quantity
        acc.cost += scrap.estimatedCost ?? 0
        if (scrap.status === 'aberto') acc.open += 1
        if (scrap.status === 'resolvido') acc.done += 1
        return acc
      },
      { total: 0, items: 0, cost: 0, open: 0, done: 0 },
    )
  }, [scraps])

  const resetForm = () => {
    const firstProduct = products[0]
    const firstVariant = firstProduct?.variants?.[0]
    setForm({
      productId: firstProduct?.id ?? '',
      variantId:
        firstProduct?.unit === 'metro_linear' || !firstProduct?.hasVariants
          ? ''
          : firstVariant?.id ?? '',
      productionOrderId: '',
      quantity: 1,
      type: 'refugo',
      reason: '',
      estimatedCost: 0,
      status: 'aberto',
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

  const updateForm = (patch: Partial<ScrapForm>) => {
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
    })
  }

  const handleEdit = (scrap: ProductionScrap) => {
    setEditingId(scrap.id)
    setEditingCreatedAt(scrap.createdAt)
    setForm({
      productId: scrap.productId,
      variantId: scrap.variantId ?? '',
      productionOrderId: scrap.productionOrderId ?? '',
      quantity: scrap.quantity,
      type: scrap.type,
      reason: scrap.reason,
      estimatedCost: scrap.estimatedCost ?? 0,
      status: scrap.status,
      notes: scrap.notes ?? '',
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.productId) {
      setStatus('Selecione um produto.')
      return
    }
    if (!form.reason.trim()) {
      setStatus('Informe o motivo.')
      return
    }
    if (form.quantity <= 0) {
      setStatus('Quantidade precisa ser maior que zero.')
      return
    }

    const product = products.find((item) => item.id === form.productId)
    const isLinear = product?.unit === 'metro_linear'

    const next: ProductionScrap = {
      id: editingId ?? createId(),
      productId: form.productId,
      variantId:
        isLinear || !product?.hasVariants ? undefined : form.variantId || undefined,
      productionOrderId: form.productionOrderId || undefined,
      quantity: form.quantity,
      type: form.type,
      reason: form.reason.trim(),
      estimatedCost: form.estimatedCost > 0 ? form.estimatedCost : undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
      createdAt: editingCreatedAt ?? new Date().toISOString(),
    }

    const payload = dataService.getAll()
    if (editingId) {
      payload.refugosProducao = payload.refugosProducao.map((item) =>
        item.id === editingId ? next : item,
      )
    } else {
      payload.refugosProducao = [...payload.refugosProducao, next]
    }
    const description = `${product?.name ?? 'Produto'} · ${next.quantity} un`
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: editingId ? 'Refugo atualizado' : 'Refugo registrado',
        description,
      },
    })
    refresh()
    setStatus(editingId ? 'Registro atualizado.' : 'Registro criado.')
    setIsModalOpen(false)
    resetForm()
  }

  const scrapToDelete = deleteId
    ? data.refugosProducao.find((item) => item.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.refugosProducao = payload.refugosProducao.filter((item) => item.id !== deleteId)
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Refugo removido',
        description: scrapToDelete ? getProductName(scrapToDelete.productId) : undefined,
      },
    })
    refresh()
    setStatus('Registro removido.')
    setDeleteId(null)
  }

  const getProductName = (id: string) =>
    data.produtos.find((product) => product.id === id)?.name ?? 'Produto'
  const getVariantName = (productId: string, variantId?: string) =>
    data.produtos
      .find((product) => product.id === productId)
      ?.variants?.find((variant) => variant.id === variantId)?.name ?? '-'
  const getOrderLabel = (orderId?: string) => {
    if (!orderId) {
      return '-'
    }
    const order = data.ordensProducao.find((item) => item.id === orderId)
    const resolvedId = order?.id ?? orderId
    return `#${resolvedId.slice(-5)}`
  }

  return (
    <section className="refugo">
      <header className="refugo__header">
        <div className="refugo__headline">
          <span className="refugo__eyebrow">Producao</span>
          <h1 className="refugo__title">Refugo e retrabalho</h1>
          <p className="refugo__subtitle">
            Registre perdas, retrabalhos e custos estimados de producao.
          </p>
        </div>
        <div className="refugo__actions">
          <button className="button button--primary" type="button" onClick={openModal}>
            Novo registro
          </button>
        </div>
      </header>

      {status && <p className="form__status">{status}</p>}

      <div className="refugo__summary summary-card">
        <article className="refugo__stat">
          <span className="refugo__stat-label">Registros</span>
          <strong className="refugo__stat-value">{summary.total}</strong>
        </article>
        <article className="refugo__stat">
          <span className="refugo__stat-label">Itens impactados</span>
          <strong className="refugo__stat-value">{summary.items}</strong>
        </article>
        <article className="refugo__stat">
          <span className="refugo__stat-label">Custo estimado</span>
          <strong className="refugo__stat-value">{formatCurrency(summary.cost)}</strong>
        </article>
        <article className="refugo__stat">
          <span className="refugo__stat-label">Pendentes</span>
          <strong className="refugo__stat-value">{summary.open}</strong>
        </article>
      </div>

      <div className="refugo__filters">
        <div className="form__group">
          <label className="form__label" htmlFor="refugo-filter-type">
            Tipo
          </label>
          <select
            id="refugo-filter-type"
            className="form__input"
            value={filterType}
            onChange={(event) =>
              setFilterType(event.target.value as ProductionScrapType | 'all')
            }
          >
            <option value="all">Todos</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="form__group">
          <label className="form__label" htmlFor="refugo-filter-status">
            Status
          </label>
          <select
            id="refugo-filter-status"
            className="form__input"
            value={filterStatus}
            onChange={(event) =>
              setFilterStatus(event.target.value as ProductionScrapStatus | 'all')
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
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Produto</th>
              <th>Variante</th>
              <th>OP</th>
              <th>Qtd.</th>
              <th>Motivo</th>
              <th>Custo</th>
              <th>Status</th>
              <th className="table__actions">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {filteredScraps.length === 0 ? (
              <tr>
                <td className="table__empty" colSpan={10}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              filteredScraps.map((scrap) => (
                <tr key={scrap.id}>
                  <td>{formatDateShort(scrap.createdAt)}</td>
                  <td>
                    <span className={`badge badge--${scrap.type}`}>{typeLabels[scrap.type]}</span>
                  </td>
                  <td>{getProductName(scrap.productId)}</td>
                  <td>
                    {data.produtos.find((item) => item.id === scrap.productId)?.hasVariants
                      ? getVariantName(scrap.productId, scrap.variantId)
                      : '-'}
                  </td>
                  <td>{getOrderLabel(scrap.productionOrderId)}</td>
                  <td>{scrap.quantity}</td>
                  <td>{scrap.notes ? `${scrap.reason} — ${scrap.notes}` : scrap.reason}</td>
                  <td>{scrap.estimatedCost ? formatCurrency(scrap.estimatedCost) : '-'}</td>
                  <td>
                    <span className={`badge badge--${scrap.status}`}>{statusLabels[scrap.status]}</span>
                  </td>
                  <td className="table__actions">
                    <ActionMenu
                      items={[
                        { label: 'Editar', onClick: () => handleEdit(scrap) },
                        { label: 'Excluir', onClick: () => setDeleteId(scrap.id) },
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
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="refugo-product">
                Produto
              </label>
              <select
                id="refugo-product"
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
                  <label className="form__label" htmlFor="refugo-variant">
                    Variante
                  </label>
                  <select
                    id="refugo-variant"
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

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="refugo-type">
                Tipo
              </label>
              <select
                id="refugo-type"
                className="form__input"
                value={form.type}
                onChange={(event) =>
                  updateForm({ type: event.target.value as ProductionScrapType })
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
              <label className="form__label" htmlFor="refugo-status">
                Status
              </label>
              <select
                id="refugo-status"
                className="form__input"
                value={form.status}
                onChange={(event) =>
                  updateForm({ status: event.target.value as ProductionScrapStatus })
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
              <label className="form__label" htmlFor="refugo-quantity">
                Quantidade
              </label>
              <input
                id="refugo-quantity"
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
              <label className="form__label" htmlFor="refugo-cost">
                Custo estimado (R$)
              </label>
              <input
                id="refugo-cost"
                className="form__input"
                type="number"
                step="0.01"
                min="0"
                value={form.estimatedCost}
                onChange={(event) =>
                  updateForm({ estimatedCost: Number(event.target.value) })
                }
              />
            </div>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="refugo-order">
              Ordem de producao (opcional)
            </label>
            <select
              id="refugo-order"
              className="form__input"
              value={form.productionOrderId}
              onChange={(event) =>
                updateForm({ productionOrderId: event.target.value })
              }
            >
              <option value="">Sem ordem vinculada</option>
              {data.ordensProducao.map((order) => (
                <option key={order.id} value={order.id}>
                  #{order.id.slice(-5)} · {getProductName(order.productId)} · {order.quantity} un
                </option>
              ))}
            </select>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="refugo-reason">
              Motivo
            </label>
            <input
              id="refugo-reason"
              className="form__input"
              type="text"
              value={form.reason}
              onChange={(event) => updateForm({ reason: event.target.value })}
            />
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="refugo-notes">
              Observacoes
            </label>
            <textarea
              id="refugo-notes"
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
        title="Excluir registro?"
        description={
          scrapToDelete
            ? `Registro de ${getProductName(scrapToDelete.productId)} sera removido.`
            : 'Este registro sera removido.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </section>
  )
}

export default ProducaoRefugo
