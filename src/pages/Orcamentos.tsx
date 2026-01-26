import { useEffect, useMemo, useState, type FormEvent } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import logotipo from '../assets/brand/logotipo.svg'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'
import type { Client, ProductVariant, Quote } from '../types/erp'
import { formatCurrency, formatDateShort } from '../utils/format'
import { createId } from '../utils/ids'

type QuoteItemForm = {
  productId: string
  variantId: string
  quantity: number
  unitPrice: number
  customLength: number
  customWidth: number
  customHeight: number
}

type QuoteForm = {
  clientId: string
  clientName: string
  validUntil: string
  status: Quote['status']
  items: QuoteItemForm[]
}

const statusLabels: Record<Quote['status'], string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
}

const createDefaultDate = () => {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().slice(0, 10)
}

const createEmptyItem = (): QuoteItemForm => ({
  productId: '',
  variantId: '',
  quantity: 1,
  unitPrice: 0,
  customLength: 0,
  customWidth: 0,
  customHeight: 0,
})

const Orcamentos = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [printId, setPrintId] = useState<string | null>(null)
  const [form, setForm] = useState<QuoteForm>({
    clientId: '',
    clientName: '',
    validUntil: createDefaultDate(),
    status: 'rascunho',
    items: [createEmptyItem()],
  })

  const total = useMemo(
    () =>
      form.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0),
    [form.items],
  )
  const availableProducts = data.produtos.filter((product) => product.active !== false)
  const hasProducts = availableProducts.length > 0
  const availableClients = useMemo(
    () => [...data.clientes].sort((a, b) => a.name.localeCompare(b.name)),
    [data.clientes],
  )

  const updateForm = (patch: Partial<QuoteForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const updateItem = (index: number, patch: Partial<QuoteItemForm>) => {
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
    setEditingId(null)
    setForm({
      clientId: '',
      clientName: '',
      validUntil: createDefaultDate(),
      status: 'rascunho',
      items: [createEmptyItem()],
    })
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

  const buildCustomVariantName = (item: QuoteItemForm) => {
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
    item: QuoteItemForm,
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
      isCustom: true,
    }

    product.variants = [...(product.variants ?? []), variant]
    return { variant }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!hasProducts) {
      setStatus('Cadastre produtos antes de criar orcamentos.')
      return
    }
    if (!form.clientId && !form.clientName.trim()) {
      setStatus('Informe o cliente ou selecione um cadastrado.')
      return
    }
    if (form.items.length === 0) {
      setStatus('Adicione ao menos um item no orcamento.')
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

    const payload = dataService.getAll()
    const client = form.clientId
      ? payload.clientes.find((item) => item.id === form.clientId)
      : undefined

    if (form.clientId && !client) {
      setStatus('Cliente selecionado nao encontrado.')
      return
    }

    const resolvedClient = client ?? findOrCreateClient(form.clientName, payload.clientes)
    const existingQuote = editingId
      ? payload.orcamentos.find((quote) => quote.id === editingId)
      : undefined

    const items = [] as Quote['items']
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

    const quote: Quote = {
      id: existingQuote?.id ?? createId(),
      clientId: resolvedClient.id,
      items,
      total,
      validUntil: form.validUntil,
      status: form.status,
      createdAt: existingQuote?.createdAt ?? new Date().toISOString(),
      convertedOrderId: existingQuote?.convertedOrderId,
    }

    let conversionMessage = ''
    if (quote.status === 'aprovado' && !quote.convertedOrderId) {
      const orderId = createId()
      payload.pedidos = [
        ...payload.pedidos,
        {
          id: orderId,
          clientId: quote.clientId,
          items: quote.items,
          total: quote.total,
          paymentMethod: 'a definir',
          status: 'aguardando_pagamento',
          createdAt: new Date().toISOString(),
          sourceQuoteId: quote.id,
        },
      ]
      quote.convertedOrderId = orderId
      conversionMessage = ` Pedido ${orderId.slice(0, 6)} criado automaticamente.`
    }

    if (existingQuote) {
      payload.orcamentos = payload.orcamentos.map((item) =>
        item.id === quote.id ? quote : item,
      )
    } else {
      payload.orcamentos = [...payload.orcamentos, quote]
    }

    dataService.replaceAll(payload)
    refresh()
    setStatus(
      `${existingQuote ? 'Orcamento atualizado' : 'Orcamento salvo'} com sucesso.${conversionMessage}`,
    )
    setIsModalOpen(false)
    resetForm()
  }

  const quotes = useMemo(
    () => [...data.orcamentos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.orcamentos],
  )

  const getClientName = (id: string) =>
    data.clientes.find((client) => client.id === id)?.name ?? 'Cliente'

  const getProductName = (id: string) =>
    data.produtos.find((product) => product.id === id)?.name ?? 'Produto'

  const getVariant = (productId: string, variantId?: string) =>
    data.produtos
      .find((product) => product.id === productId)
      ?.variants?.find((variant) => variant.id === variantId)

  const getProductUnit = (productId: string) =>
    data.produtos.find((product) => product.id === productId)?.unit ?? ''

  const getProductNameLabel = (item: Quote['items'][number]) => {
    const productName = getProductName(item.productId)
    const variant = getVariant(item.productId, item.variantId)
    if (!variant) {
      return productName
    }
    return `${productName} - ${variant.name}`
  }

  const printQuote = printId ? data.orcamentos.find((quote) => quote.id === printId) : null

  useEffect(() => {
    if (!printId || typeof window === 'undefined') {
      return
    }
    const timer = window.setTimeout(() => {
      window.print()
    }, 50)
    return () => window.clearTimeout(timer)
  }, [printId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const handleAfterPrint = () => setPrintId(null)
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  const formatItemsSummary = (items: Quote['items']) => {
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

  const handleEdit = (quote: Quote) => {
    setEditingId(quote.id)
    setForm({
      clientId: quote.clientId,
      clientName: getClientName(quote.clientId),
      validUntil: quote.validUntil,
      status: quote.status,
      items: quote.items.map((item) => {
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
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const quoteToDelete = deleteId
    ? data.orcamentos.find((quote) => quote.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.orcamentos = payload.orcamentos.filter((quote) => quote.id !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Orcamento excluido.')
    setDeleteId(null)
  }

  const handleInlineStatusChange = (quote: Quote, nextStatus: Quote['status']) => {
    const payload = dataService.getAll()
    const target = payload.orcamentos.find((item) => item.id === quote.id)
    if (!target) {
      return
    }
    const updated: Quote = { ...target, status: nextStatus }
    if (nextStatus === 'aprovado' && !target.convertedOrderId) {
      const orderId = createId()
      payload.pedidos = [
        ...payload.pedidos,
        {
          id: orderId,
          clientId: target.clientId,
          items: target.items,
          total: target.total,
          paymentMethod: 'a definir',
          status: 'aguardando_pagamento',
          createdAt: new Date().toISOString(),
          sourceQuoteId: target.id,
        },
      ]
      updated.convertedOrderId = orderId
    }
    payload.orcamentos = payload.orcamentos.map((item) =>
      item.id === updated.id ? updated : item,
    )
    dataService.replaceAll(payload)
    refresh()
  }

  const handlePrint = (quote: Quote) => {
    setPrintId(quote.id)
  }

  return (
    <section className="orcamentos">
      <div className="orcamentos__header">
        <div className="orcamentos__header-content">
          <h1 className="orcamentos__title">Orcamentos</h1>
          <p className="orcamentos__subtitle">Crie, acompanhe e aprove propostas rapidamente.</p>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={openNewModal}
          disabled={!hasProducts}
        >
          Novo orcamento
        </button>
      </div>
      {status && <p className="form__status">{status}</p>}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar orcamento' : 'Novo orcamento'}
        size="lg"
      >
        <form className="form" onSubmit={handleSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="quote-client-select">
              Cliente cadastrado
            </label>
            <select
              id="quote-client-select"
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
            <label className="form__label" htmlFor="quote-client">
              Novo cliente
            </label>
            <input
              id="quote-client"
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
                    <label className="form__label" htmlFor={`quote-product-${index}`}>
                      Produto
                    </label>
                    <select
                      id={`quote-product-${index}`}
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
                    <label className="form__label" htmlFor={`quote-variant-${index}`}>
                      Variacao
                    </label>
                    <select
                      id={`quote-variant-${index}`}
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
                      <label className="form__label" htmlFor={`quote-length-${index}`}>
                        Comprimento
                      </label>
                      <input
                        id={`quote-length-${index}`}
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
                      <label className="form__label" htmlFor={`quote-width-${index}`}>
                        Largura
                      </label>
                      <input
                        id={`quote-width-${index}`}
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
                      <label className="form__label" htmlFor={`quote-height-${index}`}>
                        Altura
                      </label>
                      <input
                        id={`quote-height-${index}`}
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
                    <label className="form__label" htmlFor={`quote-quantity-${index}`}>
                      Quantidade
                    </label>
                    <input
                      id={`quote-quantity-${index}`}
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
                    <label className="form__label" htmlFor={`quote-price-${index}`}>
                      Valor unitario
                    </label>
                    <input
                      id={`quote-price-${index}`}
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

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="quote-valid">
                Validade
              </label>
              <input
                id="quote-valid"
                className="form__input"
                type="date"
                value={form.validUntil}
                onChange={(event) => updateForm({ validUntil: event.target.value })}
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="quote-status">
                Status
              </label>
              <select
                id="quote-status"
                className="form__input"
                value={form.status}
                onChange={(event) => updateForm({ status: event.target.value as Quote['status'] })}
              >
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form__summary">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          <div className="form__actions">
            <button className="button button--primary" type="submit" disabled={!hasProducts}>
              {editingId ? 'Atualizar orcamento' : 'Salvar orcamento'}
            </button>
            {editingId && (
              <button className="button button--ghost" type="button" onClick={closeModal}>
                Cancelar
              </button>
            )}
          </div>
          {status && <p className="form__status">{status}</p>}
          {!hasProducts && (
            <p className="form__help">Cadastre produtos para liberar orcamentos.</p>
          )}
        </form>
      </Modal>

      <div className="orcamentos__layout">
        <div className="orcamentos__panel orcamentos__panel--list">
          <div className="orcamentos__panel-header">
            <h2>Ultimos orcamentos</h2>
            <span>{quotes.length} registros</span>
          </div>
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Itens</th>
                  <th>Total</th>
                  <th>Validade</th>
                  <th>Status</th>
                  <th>Pedido</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {quotes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table__empty">
                      Nenhum orcamento cadastrado ainda.
                    </td>
                  </tr>
                )}
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>{getClientName(quote.clientId)}</td>
                    <td>{formatItemsSummary(quote.items)}</td>
                    <td>{formatCurrency(quote.total)}</td>
                    <td>{formatDateShort(quote.validUntil)}</td>
                    <td>
                      <select
                        className="table__select"
                        value={quote.status}
                        onChange={(event) =>
                          handleInlineStatusChange(quote, event.target.value as Quote['status'])
                        }
                      >
                        {Object.entries(statusLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{quote.convertedOrderId ? `#${quote.convertedOrderId.slice(0, 6)}` : '-'}</td>
                    <td>
                      <div className="table__actions">
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => handleEdit(quote)}
                        >
                          Editar
                        </button>
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => handlePrint(quote)}
                        >
                          Imprimir
                        </button>
                        <button
                          className="button button--danger"
                          type="button"
                          onClick={() => setDeleteId(quote.id)}
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
        </div>
      </div>
      <ConfirmDialog
        open={!!deleteId}
        title="Excluir orcamento?"
        description={
          quoteToDelete
            ? `O orcamento de ${getClientName(quoteToDelete.clientId)} sera removido.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
      {printQuote && (
        <div id="quote-print" className="quote-print">
          <header className="quote-print__header">
            <div className="quote-print__brand">
              <img className="quote-print__logo" src={logotipo} alt="Umoya" />
              <div>
                <strong>Umoya</strong>
                <span>Orcamento #{printQuote.id.slice(0, 8)}</span>
              </div>
            </div>
            <div className="quote-print__meta">
              <span>Emissao: {formatDateShort(printQuote.createdAt)}</span>
              <span>Validade: {formatDateShort(printQuote.validUntil)}</span>
              <span>Status: {statusLabels[printQuote.status]}</span>
            </div>
          </header>

          <section className="quote-print__client">
            <div>
              <span>Cliente:</span>
              <strong>{getClientName(printQuote.clientId)}</strong>
            </div>
            <div>
              <span>Contato:</span>
              <span>______________________________________</span>
            </div>
          </section>

          <table className="quote-print__table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qtd</th>
                <th>Unidade</th>
                <th>Valor unitario</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {printQuote.items.map((item, index) => (
                <tr key={`${printQuote.id}-item-${index}`}>
                  <td>{getProductNameLabel(item)}</td>
                  <td>{item.quantity}</td>
                  <td>{getProductUnit(item.productId) || '-'}</td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td>{formatCurrency(item.quantity * item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="quote-print__total">
            <span>Total do orcamento</span>
            <strong>{formatCurrency(printQuote.total)}</strong>
          </div>

          <section className="quote-print__signatures">
            <div className="quote-print__signature">
              <span>Assinatura do cliente</span>
              <div className="quote-print__line" />
              <span>Data: ____/____/______</span>
            </div>
            <div className="quote-print__signature">
              <span>Responsavel Umoya</span>
              <div className="quote-print__line" />
              <span>Data: ____/____/______</span>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default Orcamentos
