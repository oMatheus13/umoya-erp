import { useMemo, useState, type FormEvent } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'
import type { Client, Order, ProductVariant, ProductionOrder } from '../types/erp'
import { formatCurrency } from '../utils/format'
import { createId } from '../utils/ids'

type OrderItemForm = {
  productId: string
  variantId: string
  quantity: number
  unitPrice: number
  customLength: number
  customWidth: number
  customHeight: number
}

type OrderForm = {
  clientId: string
  clientName: string
  items: OrderItemForm[]
  paymentMethod: string
  status: Order['status']
}

const statusLabels: Record<Order['status'], string> = {
  aguardando_pagamento: 'Aguardando',
  pago: 'Pago',
  em_producao: 'Em producao',
  entregue: 'Entregue',
}

const createEmptyItem = (): OrderItemForm => ({
  productId: '',
  variantId: '',
  quantity: 1,
  unitPrice: 0,
  customLength: 0,
  customWidth: 0,
  customHeight: 0,
})

const Pedidos = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<OrderForm>({
    clientId: '',
    clientName: '',
    items: [createEmptyItem()],
    paymentMethod: '',
    status: 'aguardando_pagamento',
  })

  const total = useMemo(
    () =>
      form.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0),
    [form.items],
  )
  const orderSummary = useMemo(() => {
    return data.pedidos.reduce(
      (acc, order) => {
        acc.total += 1
        if (order.status === 'aguardando_pagamento') {
          acc.awaiting += 1
        }
        if (order.status === 'em_producao') {
          acc.inProduction += 1
        }
        if (order.status !== 'aguardando_pagamento') {
          acc.confirmedValue += order.total
        }
        return acc
      },
      { total: 0, awaiting: 0, inProduction: 0, confirmedValue: 0 },
    )
  }, [data.pedidos])
  const availableProducts = data.produtos.filter((product) => product.active !== false)
  const hasProducts = availableProducts.length > 0
  const availableClients = useMemo(
    () => [...data.clientes].sort((a, b) => a.name.localeCompare(b.name)),
    [data.clientes],
  )

  const updateForm = (patch: Partial<OrderForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const updateItem = (index: number, patch: Partial<OrderItemForm>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    }))
  }

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }))
  }

  const removeItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }))
  }

  const resetForm = () => {
    setForm({
      clientId: '',
      clientName: '',
      items: [createEmptyItem()],
      paymentMethod: '',
      status: 'aguardando_pagamento',
    })
    setEditingId(null)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setStatus(null)
    resetForm()
  }

  const openNewModal = () => {
    setStatus(null)
    resetForm()
    setIsModalOpen(true)
  }

  const normalize = (value: string) => value.trim().toLowerCase()

  const findOrCreateClient = (name: string, clients: Client[]) => {
    const normalized = normalize(name)
    const existing = clients.find((client) => normalize(client.name) === normalized)
    if (existing) {
      return existing
    }
    const next: Client = {
      id: createId(),
      name: name.trim(),
    }
    clients.push(next)
    return next
  }

  const resolveVariantPrice = (product: (typeof data.produtos)[number] | null, variantId: string) => {
    if (!product) {
      return 0
    }
    const variant = product.variants?.find((item) => item.id === variantId)
    return variant?.priceOverride ?? product.price
  }

  const handleProductChange = (index: number, productId: string) => {
    const product = data.produtos.find((item) => item.id === productId)
    const firstVariant = product?.variants?.[0]
    const nextVariantId = firstVariant?.id ?? 'custom'
    updateItem(index, {
      productId,
      variantId: nextVariantId,
      unitPrice: product ? resolveVariantPrice(product, nextVariantId) : 0,
    })
  }

  const handleVariantChange = (index: number, variantId: string) => {
    const product = data.produtos.find((item) => item.id === form.items[index]?.productId)
    if (variantId === 'custom') {
      updateItem(index, {
        variantId,
        unitPrice: product?.price ?? 0,
      })
      return
    }
    updateItem(index, {
      variantId,
      unitPrice: resolveVariantPrice(product ?? null, variantId),
    })
  }

  const buildCustomVariantName = (item: OrderItemForm) => {
    const parts = [item.customLength, item.customWidth, item.customHeight]
      .filter((value) => value > 0)
      .map((value) => value.toString())
    if (parts.length === 0) {
      return 'Personalizada'
    }
    return `Personalizada ${parts.join('x')}`
  }

  const ensureCustomVariant = (
    product: { id: string; variants?: ProductVariant[] },
    item: OrderItemForm,
  ) => {
    const hasDimensions =
      item.customLength > 0 || item.customWidth > 0 || item.customHeight > 0
    if (!hasDimensions) {
      return { error: 'Informe as medidas para a variacao personalizada.' }
    }
    const variant: ProductVariant = {
      id: createId(),
      productId: product.id,
      name: buildCustomVariantName(item),
      length: item.customLength || undefined,
      width: item.customWidth || undefined,
      height: item.customHeight || undefined,
      stock: 0,
      priceOverride: undefined,
      isCustom: true,
    }

    product.variants = [...(product.variants ?? []), variant]
    return { variant }
  }

  const applyOrderUpdate = (payload: ReturnType<typeof dataService.getAll>, nextOrder: Order, previousOrder?: Order) => {
    const movingToProduction = nextOrder.status === 'em_producao' || nextOrder.status === 'entregue'
    if (movingToProduction && (!previousOrder || previousOrder.status === 'aguardando_pagamento')) {
      return { error: 'O pedido precisa estar pago antes de iniciar a producao.' }
    }

    const existingProductions: ProductionOrder[] = payload.ordensProducao.filter(
      (production) => production.orderId === nextOrder.id,
    )


    if (nextOrder.status === 'entregue' && previousOrder?.status !== 'entregue') {
      const allFinalized =
        existingProductions.length > 0 &&
        existingProductions.every((production) => production.status === 'finalizada')
      if (!allFinalized) {
        return { error: 'Finalize todas as ordens de producao antes de entregar.' }
      }

      for (const item of nextOrder.items) {
        const product = payload.produtos.find((current) => current.id === item.productId)
        const variant = product?.variants?.find((current) => current.id === item.variantId)
        if (!variant) {
          return { error: 'Variacao nao encontrada para entrega.' }
        }
        if ((variant.stock ?? 0) < item.quantity) {
          return { error: 'Estoque insuficiente para entregar este pedido.' }
        }
      }
    }

    payload.pedidos = payload.pedidos.map((item) => (item.id === nextOrder.id ? nextOrder : item))

    if (!previousOrder) {
      payload.pedidos = [...payload.pedidos, nextOrder]
    }

    if (nextOrder.status === 'pago' && previousOrder?.status !== 'pago') {
      payload.recibos = [
        ...payload.recibos,
        {
          id: createId(),
          orderId: nextOrder.id,
          amount: nextOrder.total,
          paymentMethod: nextOrder.paymentMethod,
          issuedAt: new Date().toISOString(),
        },
      ]
      payload.financeiro = [
        ...payload.financeiro,
        {
          id: createId(),
          type: 'entrada',
          description: `Pedido ${nextOrder.id.slice(0, 8)}`,
          amount: nextOrder.total,
          createdAt: new Date().toISOString(),
        },
      ]
    }

    if (nextOrder.status === 'pago' || nextOrder.status === 'em_producao' || nextOrder.status === 'entregue') {
      const existingByKey = new Map(
        existingProductions.map((production) => [
          `${production.productId}:${production.variantId ?? ''}`,
          production,
        ]),
      )

      const nextProductions: ProductionOrder[] = nextOrder.items.map((item) => {
      const key = `${item.productId}:${item.variantId ?? ''}`
      const existing = existingByKey.get(key)

      if (existing) {
        existingByKey.delete(key)

        const nextStatus: ProductionOrder['status'] =
          nextOrder.status === 'entregue'
            ? 'finalizada'
            : nextOrder.status === 'em_producao'
              ? 'em_producao'
              : existing.status

        return {
          ...existing,
          quantity: item.quantity,
          productId: item.productId,
          variantId: item.variantId,
          status: nextStatus,
          plannedAt: existing.plannedAt ?? new Date().toISOString(),
          finishedAt:
            nextOrder.status === 'entregue'
              ? existing.finishedAt ?? new Date().toISOString()
              : existing.finishedAt,
        }
      }

      const status: ProductionOrder['status'] =
        nextOrder.status === 'entregue'
          ? 'finalizada'
          : nextOrder.status === 'em_producao'
            ? 'em_producao'
            : 'aberta'

      return {
        id: createId(),
        orderId: nextOrder.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        status,
        plannedAt: new Date().toISOString(),
        finishedAt: nextOrder.status === 'entregue' ? new Date().toISOString() : undefined,
      }
    })

      const preserved = Array.from(existingByKey.values()).filter(
        (production) => production.status === 'finalizada',
      )

      payload.ordensProducao = [
        ...payload.ordensProducao.filter((production) => production.orderId !== nextOrder.id),
        ...nextProductions,
        ...preserved,
      ]
    }

    if (nextOrder.status === 'entregue' && previousOrder?.status !== 'entregue') {
      nextOrder.items.forEach((item) => {
        const productIndex = payload.produtos.findIndex(
          (product) => product.id === item.productId,
        )
        if (productIndex >= 0) {
          const current = payload.produtos[productIndex]
          const variants = current.variants ?? []
          payload.produtos[productIndex] = {
            ...current,
            variants: variants.map((variant) =>
              variant.id === item.variantId
                ? { ...variant, stock: (variant.stock ?? 0) - item.quantity }
                : variant,
            ),
          }
        }
      })
    }

    return { error: null }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!hasProducts) {
      setStatus('Cadastre produtos antes de criar pedidos.')
      return
    }
    if (!form.clientId && !form.clientName.trim()) {
      setStatus('Informe o cliente ou selecione um cadastrado.')
      return
    }
    if (form.items.length === 0) {
      setStatus('Adicione ao menos um item no pedido.')
      return
    }

    for (const item of form.items) {
      if (!item.productId || !item.variantId) {
        setStatus('Selecione produto e variacao para todos os itens.')
        return
      }
      if (item.quantity <= 0 || item.unitPrice <= 0) {
        setStatus('Quantidade e valor unitario devem ser maiores que zero.')
        return
      }
    }

    if (!form.paymentMethod.trim()) {
      setStatus('Informe a forma de pagamento.')
      return
    }

    const payload = dataService.getAll()
    const client = form.clientId
      ? payload.clientes.find((item) => item.id === form.clientId)
      : undefined

    if (form.clientId && !client) {
      setStatus('Cliente selecionado nao encontrado.')
      return
    }

    const resolvedClient = client ?? findOrCreateClient(form.clientName, payload.clientes)
    const existingOrder = editingId
      ? payload.pedidos.find((order) => order.id === editingId)
      : undefined

    const items: Order['items'] = []
    for (const item of form.items) {
      const productIndex = payload.produtos.findIndex((product) => product.id === item.productId)
      if (productIndex < 0) {
        setStatus('Produto nao encontrado.')
        return
      }
      let variantId = item.variantId
      if (item.variantId === 'custom') {
        const result = ensureCustomVariant(payload.produtos[productIndex], item)
        if (result.error) {
          setStatus(result.error)
          return
        }
        variantId = result.variant!.id
      }
      items.push({
        productId: item.productId,
        variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })
    }

    const order: Order = {
      id: existingOrder?.id ?? createId(),
      clientId: resolvedClient.id,
      items,
      total,
      paymentMethod: form.paymentMethod,
      status: form.status,
      createdAt: existingOrder?.createdAt ?? new Date().toISOString(),
      sourceQuoteId: existingOrder?.sourceQuoteId,
    }

    if (!existingOrder) {
      payload.pedidos = [...payload.pedidos, order]
    } else {
      payload.pedidos = payload.pedidos.map((item) => (item.id === order.id ? order : item))
    }

    const result = applyOrderUpdate(payload, order, existingOrder)
    if (result.error) {
      setStatus(result.error)
      return
    }

    dataService.replaceAll(payload)
    refresh()
    setStatus(existingOrder ? 'Pedido atualizado com sucesso.' : 'Pedido salvo com sucesso.')
    setIsModalOpen(false)
    resetForm()
  }

  const orders = useMemo(
    () => [...data.pedidos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.pedidos],
  )

  const getClientName = (id: string) =>
    data.clientes.find((client) => client.id === id)?.name ?? 'Cliente'

  const getProductName = (id: string) =>
    data.produtos.find((product) => product.id === id)?.name ?? 'Produto'

  const getVariant = (productId: string, variantId?: string) =>
    data.produtos
      .find((product) => product.id === productId)
      ?.variants?.find((variant) => variant.id === variantId)

  const formatItemsSummary = (items: Order['items']) => {
    if (items.length === 0) {
      return '-'
    }
    const first = items[0]
    const firstName = getProductName(first.productId)
    if (items.length === 1) {
      return firstName
    }
    return `${firstName} +${items.length - 1}`
  }

  const handleEdit = (order: Order) => {
    setEditingId(order.id)
    setForm({
      clientId: order.clientId,
      clientName: getClientName(order.clientId),
      items: order.items.map((item) => {
        const variant = item.variantId ? getVariant(item.productId, item.variantId) : undefined
        return {
          productId: item.productId,
          variantId: item.variantId ?? '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          customLength: variant?.length ?? 0,
          customWidth: variant?.width ?? 0,
          customHeight: variant?.height ?? 0,
        }
      }),
      paymentMethod: order.paymentMethod,
      status: order.status,
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const orderToDelete = deleteId
    ? data.pedidos.find((order) => order.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.pedidos = payload.pedidos.filter((order) => order.id !== deleteId)
    payload.ordensProducao = payload.ordensProducao.filter(
      (order) => order.orderId !== deleteId,
    )
    payload.recibos = payload.recibos.filter((receipt) => receipt.orderId !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Pedido excluido.')
    setDeleteId(null)
  }

  const handleInlineStatusChange = (order: Order, nextStatus: Order['status']) => {
    const payload = dataService.getAll()
    const target = payload.pedidos.find((item) => item.id === order.id)
    if (!target) {
      return
    }
    const updated: Order = { ...target, status: nextStatus }
    const result = applyOrderUpdate(payload, updated, target)
    if (result.error) {
      setStatus(result.error)
      return
    }
    payload.pedidos = payload.pedidos.map((item) => (item.id === updated.id ? updated : item))
    dataService.replaceAll(payload)
    refresh()
  }

  return (
    <section className="pedidos">
      <header className="pedidos__header">
        <div className="pedidos__headline">
          <span className="pedidos__eyebrow">Comercial</span>
          <h1 className="pedidos__title">Pedidos</h1>
          <p className="pedidos__subtitle">
            Pedidos sao gerados automaticamente quando um orcamento e aprovado.
          </p>
        </div>
        <div className="pedidos__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={openNewModal}
            disabled={!hasProducts}
          >
            Novo pedido
          </button>
        </div>
      </header>
      {status && <p className="form__status">{status}</p>}

      <div className="pedidos__summary">
        <article className="pedidos__stat">
          <span className="pedidos__stat-label">Total</span>
          <strong className="pedidos__stat-value">{orderSummary.total}</strong>
        </article>
        <article className="pedidos__stat">
          <span className="pedidos__stat-label">Aguardando</span>
          <strong className="pedidos__stat-value">{orderSummary.awaiting}</strong>
        </article>
        <article className="pedidos__stat">
          <span className="pedidos__stat-label">Em producao</span>
          <strong className="pedidos__stat-value">{orderSummary.inProduction}</strong>
        </article>
        <article className="pedidos__stat">
          <span className="pedidos__stat-label">Receita confirmada</span>
          <strong className="pedidos__stat-value">
            {formatCurrency(orderSummary.confirmedValue)}
          </strong>
        </article>
      </div>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar pedido' : 'Novo pedido'}
        size="lg"
      >
        <form className="form" onSubmit={handleSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="order-client-select">
              Cliente cadastrado
            </label>
            <select
              id="order-client-select"
              className="form__input"
              value={form.clientId}
              onChange={(event) => {
                const value = event.target.value
                const selected = data.clientes.find((client) => client.id === value)
                updateForm({
                  clientId: value,
                  clientName: value ? selected?.name ?? '' : '',
                })
              }}
            >
              <option value="">Selecionar cliente</option>
              {availableClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="order-client">
              Novo cliente
            </label>
            <input
              id="order-client"
              className="form__input"
              type="text"
              value={form.clientName}
              onChange={(event) => updateForm({ clientName: event.target.value })}
              placeholder={form.clientId ? 'Cliente selecionado' : 'Nome do cliente'}
              disabled={!!form.clientId}
            />
            {form.clientId && (
              <p className="form__help">Limpe o cliente cadastrado para digitar outro.</p>
            )}
          </div>

          {form.items.map((item, index) => {
            const itemProduct = data.produtos.find((product) => product.id === item.productId)
            const itemVariants = itemProduct?.variants ?? []
            return (
              <div key={`item-${index}`} className="form__section">
                <div className="form__row">
                  <div className="form__group">
                    <label className="form__label" htmlFor={`order-product-${index}`}>
                      Produto
                    </label>
                    <select
                      id={`order-product-${index}`}
                      className="form__input"
                      value={item.productId}
                      onChange={(event) => handleProductChange(index, event.target.value)}
                      disabled={!hasProducts}
                    >
                      <option value="">Selecione um produto</option>
                      {availableProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form__group">
                    <label className="form__label" htmlFor={`order-variant-${index}`}>
                      Variacao
                    </label>
                    <select
                      id={`order-variant-${index}`}
                      className="form__input"
                      value={item.variantId}
                      onChange={(event) => handleVariantChange(index, event.target.value)}
                      disabled={!item.productId}
                    >
                      <option value="">Selecione uma variacao</option>
                      {itemVariants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.name}
                          {variant.isCustom ? ' (Custom)' : ''}
                        </option>
                      ))}
                      <option value="custom">Personalizada</option>
                    </select>
                  </div>
                </div>

                {item.variantId === 'custom' && (
                  <div className="form__row">
                    <div className="form__group">
                      <label className="form__label" htmlFor={`order-length-${index}`}>
                        Comprimento
                      </label>
                      <input
                        id={`order-length-${index}`}
                        className="form__input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.customLength}
                        onChange={(event) =>
                          updateItem(index, { customLength: Number(event.target.value) })
                        }
                      />
                    </div>
                    <div className="form__group">
                      <label className="form__label" htmlFor={`order-width-${index}`}>
                        Largura
                      </label>
                      <input
                        id={`order-width-${index}`}
                        className="form__input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.customWidth}
                        onChange={(event) =>
                          updateItem(index, { customWidth: Number(event.target.value) })
                        }
                      />
                    </div>
                    <div className="form__group">
                      <label className="form__label" htmlFor={`order-height-${index}`}>
                        Altura
                      </label>
                      <input
                        id={`order-height-${index}`}
                        className="form__input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.customHeight}
                        onChange={(event) =>
                          updateItem(index, { customHeight: Number(event.target.value) })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="form__row">
                  <div className="form__group">
                    <label className="form__label" htmlFor={`order-quantity-${index}`}>
                      Quantidade
                    </label>
                    <input
                      id={`order-quantity-${index}`}
                      className="form__input"
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(index, { quantity: Number(event.target.value) })
                      }
                    />
                  </div>
                  <div className="form__group">
                    <label className="form__label" htmlFor={`order-price-${index}`}>
                      Valor unitario
                    </label>
                    <input
                      id={`order-price-${index}`}
                      className="form__input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) =>
                        updateItem(index, { unitPrice: Number(event.target.value) })
                      }
                    />
                  </div>
                </div>

                {form.items.length > 1 && (
                  <div className="form__actions">
                    <button
                      className="button button--danger"
                      type="button"
                      onClick={() => removeItem(index)}
                    >
                      Remover item
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          <button className="button button--ghost" type="button" onClick={addItem}>
            Adicionar item
          </button>

          <div className="form__group">
            <label className="form__label" htmlFor="order-payment">
              Forma de pagamento
            </label>
            <input
              id="order-payment"
              className="form__input"
              type="text"
              value={form.paymentMethod}
              onChange={(event) => updateForm({ paymentMethod: event.target.value })}
              placeholder="Pix, boleto, cartao..."
            />
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="order-status">
              Status
            </label>
            <select
              id="order-status"
              className="form__input"
              value={form.status}
              onChange={(event) => updateForm({ status: event.target.value as Order['status'] })}
            >
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <p className="form__help">
              Status pago gera recibo e entrada automatica no financeiro.
            </p>
          </div>

          <div className="form__summary">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          <div className="form__actions">
            <button className="button button--primary" type="submit" disabled={!hasProducts}>
              {editingId ? 'Atualizar pedido' : 'Salvar pedido'}
            </button>
            {editingId && (
              <button className="button button--ghost" type="button" onClick={closeModal}>
                Cancelar
              </button>
            )}
          </div>
          {status && <p className="form__status">{status}</p>}
          {!hasProducts && <p className="form__help">Cadastre produtos para liberar pedidos.</p>}
        </form>
      </Modal>

      <div className="pedidos__layout">
        <section className="pedidos__panel">
          <div className="pedidos__panel-header">
            <div>
              <h2>Pedidos recentes</h2>
              <p>Atualize status e gere producao sem abrir o pedido.</p>
            </div>
            <span className="pedidos__panel-meta">{orders.length} registros</span>
          </div>
          <div className="table-card pedidos__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Itens</th>
                  <th>Total</th>
                  <th>Pagamento</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table__empty">
                      Nenhum pedido cadastrado ainda.
                    </td>
                  </tr>
                )}
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{getClientName(order.clientId)}</td>
                    <td>{formatItemsSummary(order.items)}</td>
                    <td>{formatCurrency(order.total)}</td>
                    <td>{order.paymentMethod}</td>
                    <td>
                      <select
                        className="table__select"
                        value={order.status}
                        onChange={(event) =>
                          handleInlineStatusChange(order, event.target.value as Order['status'])
                        }
                      >
                        {Object.entries(statusLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="table__actions">
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => handleEdit(order)}
                        >
                          Editar
                        </button>
                        <button
                          className="button button--danger"
                          type="button"
                          onClick={() => setDeleteId(order.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={!!deleteId}
        title="Excluir pedido?"
        description={
          orderToDelete
            ? `O pedido de ${getClientName(orderToDelete.clientId)} sera removido.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </section>
  )
}

export default Pedidos
