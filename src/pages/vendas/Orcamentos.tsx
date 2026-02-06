import { useEffect, useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import CurrencyInput from '../../components/CurrencyInput'
import DimensionInput from '../../components/DimensionInput'
import Modal from '../../components/Modal'
import { Page, PageHeader } from '../../components/ui'
import logotipo from '../../assets/brand/logotipo.svg'
import {
  getPaymentMethodId,
  getPaymentMethodLabel,
  getPaymentMethodOptions,
} from '../../data/paymentMethods'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { Client, FulfillmentMode, ProductVariant, Quote } from '../../types/erp'
import type { PageIntentAction } from '../../types/ui'
import { formatCurrency, formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'
import { getBasePrice, getMaxDiscountSummary, getMinUnitPrice } from '../../utils/pricing'
import { getProductUnitLabel } from '../../utils/units'

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
  obraId: string
  paymentMethod: string
  validUntil: string
  status: Quote['status']
  fulfillment: FulfillmentMode
  items: QuoteItemForm[]
  discountType: '' | 'percent' | 'value'
  discountValue: number
  discountPercent: string
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

type OrcamentosProps = {
  pageIntent?: PageIntentAction
  onConsumeIntent?: () => void
}

const Orcamentos = ({ pageIntent, onConsumeIntent }: OrcamentosProps) => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [printId, setPrintId] = useState<string | null>(null)
  const [form, setForm] = useState<QuoteForm>({
    clientId: '',
    clientName: '',
    obraId: '',
    paymentMethod: 'a_definir',
    validUntil: createDefaultDate(),
    status: 'rascunho',
    fulfillment: 'producao',
    items: [createEmptyItem()],
    discountType: '',
    discountValue: 0,
    discountPercent: '',
  })
  const quoteFormId = 'orcamento-form'

  const paymentOptions = useMemo(
    () => getPaymentMethodOptions(data.tabelas?.paymentMethods),
    [data.tabelas?.paymentMethods],
  )

  const subtotal = useMemo(
    () => form.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0),
    [form.items],
  )
  const pricingItems = useMemo(
    () =>
      form.items
        .map((item) => {
          const product = data.produtos.find((entry) => entry.id === item.productId)
          if (!product) {
            return null
          }
          const variant = product.variants?.find((entry) => entry.id === item.variantId)
          return {
            product,
            variant,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            customLength: item.customLength,
            customWidth: item.customWidth,
          }
        })
        .filter((item): item is NonNullable<typeof item> => !!item),
    [data.produtos, form.items],
  )
  const discountSummary = useMemo(
    () => getMaxDiscountSummary(pricingItems, data.materiais),
    [pricingItems, data.materiais],
  )
  const maxDiscountPercent = discountSummary.maxDiscountPercent
  const maxDiscountValue = Math.min(discountSummary.maxDiscountValue, subtotal)
  const parsedDiscountPercent = form.discountPercent.trim()
    ? Number(form.discountPercent.replace(',', '.'))
    : 0
  const safeDiscountValue = Number.isFinite(form.discountValue) ? form.discountValue : 0
  const safeDiscountPercent = Number.isNaN(parsedDiscountPercent) ? 0 : parsedDiscountPercent
  const rawDiscount =
    form.discountType === 'percent'
      ? subtotal * (safeDiscountPercent / 100)
      : form.discountType === 'value'
        ? safeDiscountValue
        : 0
  const appliedDiscount = Math.min(rawDiscount, maxDiscountValue)
  const total = Math.max(subtotal - appliedDiscount, 0)
  const appliedDiscountPercent = subtotal > 0 ? (appliedDiscount / subtotal) * 100 : 0
  const quoteSummary = useMemo(() => {
    return data.orcamentos.reduce(
      (acc, quote) => {
        acc.total += 1
        if (quote.status === 'aprovado') {
          acc.approved += 1
        }
        if (quote.status === 'rascunho' || quote.status === 'enviado') {
          acc.pending += 1
          acc.pendingValue += quote.total
        }
        return acc
      },
      { total: 0, pending: 0, approved: 0, pendingValue: 0 },
    )
  }, [data.orcamentos])
  const availableProducts = data.produtos.filter((product) => product.active !== false)
  const hasProducts = availableProducts.length > 0
  const availableClients = useMemo(
    () => [...data.clientes].sort((a, b) => a.name.localeCompare(b.name)),
    [data.clientes],
  )
  const selectedClient = form.clientId
    ? data.clientes.find((client) => client.id === form.clientId)
    : null
  const clientObras = selectedClient?.obras ?? []

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
      obraId: '',
      paymentMethod: 'a_definir',
      validUntil: createDefaultDate(),
      status: 'rascunho',
      fulfillment: 'producao',
      items: [createEmptyItem()],
      discountType: '',
      discountValue: 0,
      discountPercent: '',
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

  useEffect(() => {
    if (pageIntent !== 'new') {
      return
    }
    openNewModal()
    onConsumeIntent?.()
  }, [pageIntent, onConsumeIntent])

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
    if (product.hasVariants) {
      return variant?.priceOverride ?? 0
    }
    return getBasePrice(product, variant)
  }

  const resolveLinearLength = (
    product: (typeof data.produtos)[number],
    customLength?: number,
  ) => {
    const length = customLength && customLength > 0 ? customLength : product.length ?? 1
    return length > 0 ? length : 1
  }

  const resolveUnitPrice = (
    product: (typeof data.produtos)[number] | null,
    variant?: ProductVariant,
    item?: QuoteItemForm,
  ) => {
    if (!product) {
      return 0
    }
    const basePrice = getBasePrice(product, variant)
    if (product.unit === 'metro_linear') {
      const length = resolveLinearLength(product, item?.customLength)
      return basePrice * length
    }
    return basePrice
  }

  const validatePriceRules = (
    item: QuoteItemForm,
    product: (typeof data.produtos)[number],
    variant?: ProductVariant,
  ) => {
    const minPrice = getMinUnitPrice(product, variant, {
      materials: data.materiais,
      customLength: item.customLength,
      customWidth: item.customWidth,
    })
    if (item.unitPrice < minPrice) {
      return `Valor unitario abaixo do minimo sem prejuizo (${formatCurrency(minPrice)}).`
    }
    return null
  }

  const handleProductChange = (index: number, productId: string) => {
    const product = data.produtos.find((item) => item.id === productId)
    if (product?.unit === 'metro_linear') {
      const baseLength = product.length && product.length > 0 ? product.length : 1
      updateItem(index, {
        productId,
        variantId: '',
        customLength: baseLength,
        customWidth: 0,
        customHeight: 0,
        unitPrice: resolveUnitPrice(product, undefined, {
          ...form.items[index],
          customLength: baseLength,
        }),
      })
      return
    }
    if (product && !product.hasVariants) {
      updateItem(index, {
        productId,
        variantId: '',
        customLength: 0,
        customWidth: 0,
        customHeight: 0,
        unitPrice: resolveUnitPrice(product, undefined, form.items[index]),
      })
      return
    }
    const firstVariant = product?.variants?.[0]
    const nextVariantId = firstVariant?.id ?? 'custom'
    updateItem(index, {
      productId,
      variantId: nextVariantId,
      unitPrice: product ? resolveVariantPrice(product, nextVariantId) : 0,
      customLength: 0,
      customWidth: 0,
      customHeight: 0,
    })
  }

  const handleVariantChange = (index: number, variantId: string) => {
    const product = data.produtos.find((item) => item.id === form.items[index]?.productId)
    if (product?.unit === 'metro_linear') {
      updateItem(index, {
        variantId: '',
        unitPrice: resolveUnitPrice(product, undefined, form.items[index]),
      })
      return
    }
    if (product && !product.hasVariants) {
      updateItem(index, {
        variantId: '',
        unitPrice: resolveUnitPrice(product, undefined, form.items[index]),
      })
      return
    }
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

  const handleLinearLengthChange = (index: number, lengthMeters: number) => {
    const product = data.produtos.find((item) => item.id === form.items[index]?.productId)
    updateItem(index, {
      customLength: lengthMeters,
      unitPrice: resolveUnitPrice(product ?? null, undefined, {
        ...form.items[index],
        customLength: lengthMeters,
      }),
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
      const product = data.produtos.find((current) => current.id === item.productId)
      if (!item.productId || !product) {
        setStatus('Selecione um produto valido para todos os itens.')
        return
      }
      if (product.hasVariants && !item.variantId) {
        setStatus('Selecione produto e variacao para todos os itens.')
        return
      }
      if (product.unit === 'metro_linear' && item.customLength <= 0) {
        setStatus('Informe o comprimento em cm para os itens por metro linear.')
        return
      }
      if (item.quantity <= 0 || item.unitPrice <= 0) {
        setStatus('Quantidade e valor unitario devem ser maiores que zero.')
        return
      }
    }
    if (form.discountType === 'percent') {
      if (Number.isNaN(parsedDiscountPercent)) {
        setStatus('Informe um desconto percentual valido.')
        return
      }
      if (parsedDiscountPercent < 0 || parsedDiscountPercent > 100) {
        setStatus('O desconto percentual deve ficar entre 0 e 100.')
        return
      }
    }
    if (form.discountType === 'value') {
      if (!Number.isFinite(form.discountValue)) {
        setStatus('Informe um desconto em dinheiro valido.')
        return
      }
      if (form.discountValue < 0) {
        setStatus('O desconto nao pode ser negativo.')
        return
      }
    }
    if (rawDiscount > maxDiscountValue + 0.01) {
      setStatus(
        `Desconto acima do maximo sugerido (${formatCurrency(maxDiscountValue)}).`,
      )
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
    const existingQuote = editingId
      ? payload.orcamentos.find((quote) => quote.id === editingId)
      : undefined

    const items = [] as Quote['items']
    for (let index = 0; index < form.items.length; index += 1) {
      const item = form.items[index]
      const productIndex = payload.produtos.findIndex((product) => product.id === item.productId)
      if (productIndex < 0) {
        setStatus('Produto nao encontrado.')
        return
      }
      const product = payload.produtos[productIndex]
      const variant =
        product.unit === 'metro_linear'
          ? undefined
          : product.variants?.find((entry) => entry.id === item.variantId)
      const priceRuleError = validatePriceRules(item, product, variant)
      if (priceRuleError) {
        setStatus(`Item ${index + 1}: ${priceRuleError}`)
        return
      }
      let variantId = item.variantId
      if (product.hasVariants && item.variantId === 'custom') {
        const result = ensureCustomVariant(payload.produtos[productIndex], item)
        if (result.error) {
          setStatus(result.error)
          return
        }
        variantId = result.variant!.id
      }
      items.push({
        productId: item.productId,
        variantId: product.unit === 'metro_linear' ? undefined : variantId || undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        customLength: item.customLength > 0 ? item.customLength : undefined,
        customWidth: item.customWidth > 0 ? item.customWidth : undefined,
        customHeight: item.customHeight > 0 ? item.customHeight : undefined,
      })
    }

    const discountType = form.discountType || undefined
    const normalizedPayment =
      getPaymentMethodId(form.paymentMethod, data.tabelas?.paymentMethods) ||
      form.paymentMethod
    const quote: Quote = {
      id: existingQuote?.id ?? createId(),
      clientId: resolvedClient.id,
      obraId: form.clientId ? form.obraId || undefined : undefined,
      items,
      total,
      discountType,
      discountValue: discountType ? appliedDiscount : undefined,
      discountPercent: discountType ? appliedDiscountPercent : undefined,
      paymentMethod: normalizedPayment || undefined,
      validUntil: form.validUntil,
      status: form.status,
      fulfillment: form.fulfillment,
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
          obraId: quote.obraId,
          items: quote.items,
          total: quote.total,
          paymentMethod: quote.paymentMethod ?? 'a_definir',
          fulfillment: quote.fulfillment ?? 'producao',
          discountType: quote.discountType,
          discountValue: quote.discountValue,
          discountPercent: quote.discountPercent,
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

    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: existingQuote ? 'Orcamento atualizado' : 'Orcamento criado',
        description: `${resolvedClient.name} · ${items.length} item(ns)`,
      },
    })
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
    getProductUnitLabel(
      data.produtos.find((product) => product.id === productId)?.unit,
      data.tabelas,
    )

  const formatMeasurement = (value: number) =>
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)

  const buildDimensionLabel = (values: number[]) => {
    const filtered = values.filter((value) => Number.isFinite(value) && value > 0)
    if (filtered.length === 0) {
      return null
    }
    const m = filtered.map((value) => formatMeasurement(value)).join(' x ')
    return `${m} m`
  }

  const getItemDimensions = (item: Quote['items'][number]) => {
    const product = data.produtos.find((entry) => entry.id === item.productId)
    const variant = item.variantId ? getVariant(item.productId, item.variantId) : undefined
    const length = item.customLength ?? variant?.length ?? product?.length ?? 0
    const width = item.customWidth ?? variant?.width ?? product?.width ?? 0
    const height = item.customHeight ?? variant?.height ?? product?.height ?? 0
    if (product?.unit === 'metro_linear') {
      return buildDimensionLabel([length])
    }
    return buildDimensionLabel([length, width, height])
  }

  const getProductNameLabel = (item: Quote['items'][number]) => {
    const product = data.produtos.find((entry) => entry.id === item.productId)
    const productName = getProductName(item.productId)
    if (product && !product.hasVariants) {
      return productName
    }
    const variant = getVariant(item.productId, item.variantId)
    if (!variant) {
      return productName
    }
    return `${productName} - ${variant.name}`
  }

  const printQuote = printId ? data.orcamentos.find((quote) => quote.id === printId) : null
  const printDiscountInfo = printQuote ? getQuoteDiscountInfo(printQuote) : null
  const company = data.empresa
  const companyName = company.name?.trim() || company.tradeName?.trim() || ''
  const companyDocument = company.document?.trim() || ''
  const addressLine = [company.street, company.number, company.neighborhood]
    .filter(Boolean)
    .join(', ')
  const cityLine = [company.city, company.state, company.zip].filter(Boolean).join(' - ')
  const contactLine = [company.phone, company.email, company.website].filter(Boolean).join(' • ')
  const companyLines = [companyName, companyDocument, addressLine, cityLine, contactLine].filter(
    (value) => value && value.trim().length > 0,
  )
  const printClient = printQuote
    ? data.clientes.find((client) => client.id === printQuote.clientId)
    : null
  const printObra =
    printQuote && printClient?.obras
      ? printClient.obras.find((obra) => obra.id === printQuote.obraId)
      : null
  const clientDocument = printClient?.document?.trim() || ''
  const clientContactLine = [printClient?.phone, printClient?.email].filter(Boolean).join(' • ')
  const clientAddressLine = [printObra?.address, printObra?.city ?? printClient?.city]
    .filter(Boolean)
    .join(' - ')
  const clientNotes = [printObra?.notes, printClient?.notes].filter(Boolean).join(' • ')
  const seller =
    data.usuarios.find((user) => user.active !== false) ?? data.usuarios[0]
  const sellerName = seller?.displayName?.trim() || seller?.name?.trim() || ''

  useEffect(() => {
    if (!printId || typeof window === 'undefined') {
      return
    }
    let cancelled = false
    const runPrint = async () => {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve())
        })
      })
      if (document.fonts?.ready) {
        await document.fonts.ready
      }
      if (!cancelled) {
        window.print()
      }
    }
    void runPrint()
    return () => {
      cancelled = true
    }
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

  const formatPercent = (value: number) =>
    Number.isFinite(value) ? (value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)) : '0'

  function getQuoteDiscountInfo(quote: Quote) {
    const subtotalValue = quote.items.reduce(
      (acc, item) => acc + item.quantity * item.unitPrice,
      0,
    )
    const valueFromPercent = quote.discountPercent
      ? subtotalValue * (quote.discountPercent / 100)
      : 0
    const discountValue = quote.discountValue ?? valueFromPercent
    const discountPercent =
      quote.discountPercent ??
      (subtotalValue > 0 ? (discountValue / subtotalValue) * 100 : 0)
    return { subtotalValue, discountValue, discountPercent }
  }

  const handleEdit = (quote: Quote) => {
    setEditingId(quote.id)
    const inferredDiscountType =
      quote.discountType ??
      (quote.discountPercent ? 'percent' : quote.discountValue ? 'value' : '')
    setForm({
      clientId: quote.clientId,
      clientName: getClientName(quote.clientId),
      obraId: quote.obraId ?? '',
      paymentMethod:
        getPaymentMethodId(quote.paymentMethod, data.tabelas?.paymentMethods) ||
        quote.paymentMethod ||
        'a_definir',
      validUntil: quote.validUntil,
      status: quote.status,
      items: quote.items.map((item) => {
        const product = data.produtos.find((entry) => entry.id === item.productId)
        const variant = item.variantId ? getVariant(item.productId, item.variantId) : undefined
        const isLinear = product?.unit === 'metro_linear'
        const customLength =
          item.customLength ?? variant?.length ?? product?.length ?? 0
        const customWidth =
          item.customWidth ?? variant?.width ?? product?.width ?? 0
        const customHeight =
          item.customHeight ?? variant?.height ?? product?.height ?? 0
        const unitPrice = isLinear
          ? resolveUnitPrice(product ?? null, undefined, {
              productId: item.productId,
              variantId: '',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              customLength,
              customWidth,
              customHeight,
            })
          : item.unitPrice
        return {
          productId: item.productId,
          variantId: isLinear ? '' : item.variantId ?? '',
          quantity: item.quantity,
          unitPrice,
          customLength,
          customWidth,
          customHeight,
        }
      }),
      discountType: inferredDiscountType as QuoteForm['discountType'],
      discountValue: quote.discountValue ?? 0,
      discountPercent:
        quote.discountPercent !== undefined ? String(quote.discountPercent) : '',
      fulfillment: quote.fulfillment ?? 'producao',
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const quoteToDelete = deleteId
    ? data.orcamentos.find((quote) => quote.id === deleteId)
    : null
  const editingQuote = editingId
    ? data.orcamentos.find((quote) => quote.id === editingId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.orcamentos = payload.orcamentos.filter((quote) => quote.id !== deleteId)
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Orcamento excluido',
        description: quoteToDelete ? getClientName(quoteToDelete.clientId) : undefined,
      },
    })
    refresh()
    setIsModalOpen(false)
    resetForm()
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
          obraId: target.obraId,
          items: target.items,
          total: target.total,
          paymentMethod: target.paymentMethod ?? 'a_definir',
          fulfillment: target.fulfillment ?? 'producao',
          discountType: target.discountType,
          discountValue: target.discountValue,
          discountPercent: target.discountPercent,
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
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'alteracao',
        title: 'Status do orcamento atualizado',
        description: `${getClientName(updated.clientId)} → ${statusLabels[nextStatus]}`,
      },
    })
    refresh()
  }

  const handlePrint = (quote: Quote) => {
    setPrintId(quote.id)
  }

  return (
    <Page className="orcamentos">
      {printQuote && (
        <div id="quote-print" className="quote-print">
          {[
            { id: 'cliente', label: 'Via do cliente' },
            { id: 'empresa', label: 'Via da empresa' },
          ].map((copy) => (
            <section key={copy.id} className="quote-print__copy">
              <header className="quote-print__header">
                <div className="quote-print__brand">
                  <img className="quote-print__logo" src={logotipo} alt={companyName} />
                  {companyLines.length > 0 && (
                    <div className="quote-print__company">
                      {companyLines.map((line, index) => {
                        const isNameLine = index === 0 && companyName && line === companyName
                        return isNameLine ? (
                          <strong key={`${copy.id}-company-${index}`}>{line}</strong>
                        ) : (
                          <span key={`${copy.id}-company-${index}`}>{line}</span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="quote-print__meta">
                  <span>Emissao: {formatDateShort(printQuote.createdAt)}</span>
                  <span>Validade: {formatDateShort(printQuote.validUntil)}</span>
                  <span>Status: {statusLabels[printQuote.status]}</span>
                  {printQuote.paymentMethod && (
                    <span>
                      Pagamento:{' '}
                      {getPaymentMethodLabel(
                        printQuote.paymentMethod,
                        data.tabelas?.paymentMethods,
                      )}
                    </span>
                  )}
                  <span>Vendedor: {sellerName || '________________'}</span>
                  <span>Orcamento #{printQuote.id.slice(0, 8)}</span>
                  <span className="quote-print__copy-tag">{copy.label}</span>
                </div>
              </header>

              <section className="quote-print__client">
                <div className="quote-print__client-block">
                  <span>Cliente</span>
                  <strong>{getClientName(printQuote.clientId)}</strong>
                  {clientDocument && <span>Documento: {clientDocument}</span>}
                  {clientContactLine && <span>{clientContactLine}</span>}
                </div>
                <div className="quote-print__client-block">
                  <span>Obra / Endereco</span>
                  <strong>{printObra?.name || '—'}</strong>
                  <span>{clientAddressLine || '—'}</span>
                </div>
              </section>

              <table className="quote-print__table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Medidas (m)</th>
                    <th>Qtd</th>
                    <th>Unidade</th>
                    <th>Valor unitario</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {printQuote.items.map((item, index) => {
                    const dimensions = getItemDimensions(item)
                    return (
                      <tr key={`${printQuote.id}-${copy.id}-item-${index}`}>
                        <td>{getProductNameLabel(item)}</td>
                        <td>
                          {dimensions ? (
                            <span className="quote-print__dimension">{dimensions}</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{item.quantity}</td>
                        <td>{getProductUnit(item.productId) || '-'}</td>
                        <td>{formatCurrency(item.unitPrice)}</td>
                        <td>{formatCurrency(item.quantity * item.unitPrice)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="quote-print__total">
                {printDiscountInfo && (
                  <div className="quote-print__total-row">
                    <span>Subtotal</span>
                    <strong>{formatCurrency(printDiscountInfo.subtotalValue)}</strong>
                  </div>
                )}
                {printDiscountInfo && printDiscountInfo.discountValue > 0 && (
                  <div className="quote-print__total-row">
                    <span>
                      Desconto ({formatPercent(printDiscountInfo.discountPercent)}%)
                    </span>
                    <strong>-{formatCurrency(printDiscountInfo.discountValue)}</strong>
                  </div>
                )}
                <div className="quote-print__total-row quote-print__total-main">
                  <span>Total do orcamento</span>
                  <strong>{formatCurrency(printQuote.total)}</strong>
                </div>
              </div>

              <section className="quote-print__notes">
                <span>Observacoes</span>
                {clientNotes ? (
                  <p>{clientNotes}</p>
                ) : (
                  <div className="quote-print__notes-line" />
                )}
              </section>

              <section className="quote-print__signatures">
                <div className="quote-print__signature">
                  <span>Assinatura do cliente</span>
                  <div className="quote-print__line" />
                  <span>Data: ____/____/______</span>
                </div>
                <div className="quote-print__signature">
                  <span>
                    {companyName ? `Responsavel ${companyName}` : 'Responsavel'}
                  </span>
                  <div className="quote-print__line" />
                  <span>Data: ____/____/______</span>
                </div>
              </section>
            </section>
          ))}
        </div>
      )}
      <PageHeader
        actions={
          <button
            className="button button--primary"
            type="button"
            onClick={openNewModal}
            disabled={!hasProducts}
            aria-label="Novo orcamento"
          >
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              request_quote
            </span>
            <span className="page-header__action-label">Novo orcamento</span>
          </button>
        }
      />
      {status && <p className="form__status">{status}</p>}

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Total</span>
          <strong className="summary__value">{quoteSummary.total}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Pendentes</span>
          <strong className="summary__value">{quoteSummary.pending}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Aprovados</span>
          <strong className="summary__value">{quoteSummary.approved}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Valor em aberto</span>
          <strong className="summary__value">
            {formatCurrency(quoteSummary.pendingValue)}
          </strong>
        </article>
      </div>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar orcamento' : 'Novo orcamento'}
        size="lg"
        actions={
          <>
            {editingQuote && (
              <button
                className="button button--ghost"
                type="button"
                onClick={() => handlePrint(editingQuote)}
              >
                <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                  print
                </span>
                <span className="modal__action-label">Imprimir</span>
              </button>
            )}
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
            <button
              className="button button--primary"
              type="submit"
              form={quoteFormId}
              disabled={!hasProducts}
            >
              <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                save
              </span>
              <span className="modal__action-label">
                {editingId ? 'Atualizar orcamento' : 'Salvar orcamento'}
              </span>
            </button>
          </>
        }
      >
        <form id={quoteFormId} className="modal__form" onSubmit={handleSubmit}>
          <div className="modal__group">
            <label className="modal__label" htmlFor="quote-client-select">
              Cliente cadastrado
            </label>
            <select
              id="quote-client-select"
              className="modal__input"
              value={form.clientId}
              onChange={(event) => {
                const value = event.target.value
                const selected = data.clientes.find((client) => client.id === value)
                const obraId =
                  selected && selected.obras && selected.obras.length === 1
                    ? selected.obras[0].id
                    : ''
                updateForm({
                  clientId: value,
                  clientName: value ? selected?.name ?? '' : '',
                  obraId,
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

          <div className="modal__group">
            <label className="modal__label" htmlFor="quote-client">
              Novo cliente
            </label>
            <input
              id="quote-client"
              className="modal__input"
              type="text"
              value={form.clientName}
              onChange={(event) => updateForm({ clientName: event.target.value })}
              placeholder={form.clientId ? 'Cliente selecionado' : 'Nome do cliente'}
              disabled={!!form.clientId}
            />
            {form.clientId && (
              <p className="modal__help">Limpe o cliente cadastrado para digitar outro.</p>
            )}
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="quote-obra">
              Obra do cliente
            </label>
            <select
              id="quote-obra"
              className="modal__input"
              value={form.obraId}
              onChange={(event) => updateForm({ obraId: event.target.value })}
              disabled={!form.clientId || clientObras.length === 0}
            >
              <option value="">Selecionar obra</option>
              {clientObras.map((obra) => (
                <option key={obra.id} value={obra.id}>
                  {obra.name}
                </option>
              ))}
            </select>
            {form.clientId && clientObras.length === 0 && (
              <p className="modal__help">Nenhuma obra cadastrada para este cliente.</p>
            )}
          </div>

          {form.items.map((item, index) => {
            const itemProduct = data.produtos.find((product) => product.id === item.productId)
            const itemVariants = itemProduct?.variants ?? []
            const isLinear = itemProduct?.unit === 'metro_linear'
            const usesVariants = !!itemProduct?.hasVariants && !isLinear
            const itemVariant = usesVariants
              ? itemVariants.find((variant) => variant.id === item.variantId)
              : undefined
            const basePrice = itemProduct ? resolveUnitPrice(itemProduct, itemVariant, item) : 0
            const minPrice = itemProduct
              ? getMinUnitPrice(itemProduct, itemVariant, {
                  materials: data.materiais,
                  customLength: item.customLength,
                  customWidth: item.customWidth,
                })
              : 0
            return (
              <div key={`item-${index}`} className="modal__section">
                <div className="modal__row">
                  <div className="modal__group">
                    <label className="modal__label" htmlFor={`quote-product-${index}`}>
                      Produto
                    </label>
                    <select
                      id={`quote-product-${index}`}
                      className="modal__input"
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
                  {isLinear ? (
                    <div className="modal__group">
                      <label className="modal__label" htmlFor={`quote-length-${index}`}>
                        Comprimento
                      </label>
                      <DimensionInput
                        id={`quote-length-${index}`}
                        className="modal__input"
                        min="0"
                        step={0.01}
                        value={item.customLength}
                        onValueChange={(value) => handleLinearLengthChange(index, value)}
                        disabled={!item.productId}
                      />
                    </div>
                  ) : usesVariants ? (
                    <div className="modal__group">
                      <label className="modal__label" htmlFor={`quote-variant-${index}`}>
                        Variacao
                      </label>
                      <select
                        id={`quote-variant-${index}`}
                        className="modal__input"
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
                  ) : (
                    <div className="modal__group">
                      <label className="modal__label">Variacao</label>
                      <input
                        className="modal__input"
                        type="text"
                        value="Produto sem variacoes"
                        disabled
                      />
                    </div>
                  )}
                </div>

                {usesVariants && item.variantId === 'custom' && (
                  <div className="modal__row">
                    <div className="modal__group">
                      <label className="modal__label" htmlFor={`quote-length-${index}`}>
                        Comprimento
                      </label>
                      <DimensionInput
                        id={`quote-length-${index}`}
                        className="modal__input"
                        min="0"
                        value={item.customLength}
                        step={0.01}
                        onValueChange={(value) => updateItem(index, { customLength: value })}
                      />
                    </div>
                    <div className="modal__group">
                      <label className="modal__label" htmlFor={`quote-width-${index}`}>
                        Largura
                      </label>
                      <DimensionInput
                        id={`quote-width-${index}`}
                        className="modal__input"
                        min="0"
                        value={item.customWidth}
                        step={0.01}
                        onValueChange={(value) => updateItem(index, { customWidth: value })}
                      />
                    </div>
                    <div className="modal__group">
                      <label className="modal__label" htmlFor={`quote-height-${index}`}>
                        Altura
                      </label>
                      <DimensionInput
                        id={`quote-height-${index}`}
                        className="modal__input"
                        min="0"
                        value={item.customHeight}
                        step={0.01}
                        onValueChange={(value) => updateItem(index, { customHeight: value })}
                      />
                    </div>
                  </div>
                )}

                <div className="modal__row">
                  <div className="modal__group">
                    <label className="modal__label" htmlFor={`quote-quantity-${index}`}>
                      Quantidade
                    </label>
                    <input
                      id={`quote-quantity-${index}`}
                      className="modal__input"
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(index, { quantity: Number(event.target.value) })
                      }
                    />
                  </div>
                  <div className="modal__group">
                    <label className="modal__label" htmlFor={`quote-price-${index}`}>
                      Valor unitario
                    </label>
                    <CurrencyInput
                      id={`quote-price-${index}`}
                      className="modal__input"
                      value={item.unitPrice}
                      onValueChange={(value) => updateItem(index, { unitPrice: value ?? 0 })}
                      disabled={isLinear}
                    />
                    {itemProduct && (
                      <p className="modal__help">
                        Base {formatCurrency(basePrice)} | Min sem prejuizo{' '}
                        {formatCurrency(minPrice)}
                      </p>
                    )}
                  </div>
                </div>

                {form.items.length > 1 && (
                  <div className="modal__form-actions">
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

          <div className="modal__section">
            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="quote-discount-type">
                  Desconto
                </label>
                <select
                  id="quote-discount-type"
                  className="modal__input"
                  value={form.discountType}
                  onChange={(event) =>
                    updateForm({ discountType: event.target.value as QuoteForm['discountType'] })
                  }
                >
                  <option value="">Sem desconto</option>
                  <option value="percent">Percentual</option>
                  <option value="value">Valor</option>
                </select>
              </div>
              {form.discountType === 'percent' && (
                <div className="modal__group">
                  <label className="modal__label" htmlFor="quote-discount-percent">
                    Percentual
                  </label>
                  <input
                    id="quote-discount-percent"
                    className="modal__input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.discountPercent}
                    onChange={(event) => updateForm({ discountPercent: event.target.value })}
                    placeholder={`Max ${maxDiscountPercent.toFixed(1)}%`}
                  />
                </div>
              )}
              {form.discountType === 'value' && (
                <div className="modal__group">
                  <label className="modal__label" htmlFor="quote-discount-value">
                    Valor
                  </label>
                  <CurrencyInput
                    id="quote-discount-value"
                    className="modal__input"
                    value={form.discountValue}
                    onValueChange={(value) => updateForm({ discountValue: value ?? 0 })}
                    placeholder={`Max ${formatCurrency(maxDiscountValue)}`}
                  />
                </div>
              )}
            </div>
            {subtotal > 0 ? (
              <p className="modal__help">
                Desconto maximo sugerido: {formatCurrency(maxDiscountValue)} (
                {maxDiscountPercent.toFixed(1)}%).
              </p>
            ) : (
              <p className="modal__help">Preencha os itens para calcular o desconto sugerido.</p>
            )}
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="quote-payment">
              Forma de pagamento
            </label>
            <select
              id="quote-payment"
              className="modal__input"
              value={form.paymentMethod}
              onChange={(event) => updateForm({ paymentMethod: event.target.value })}
            >
              {form.paymentMethod &&
                !paymentOptions.some((method) => method.id === form.paymentMethod) && (
                  <option value={form.paymentMethod}>
                    Outro ({form.paymentMethod})
                  </option>
                )}
              {paymentOptions.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.label}
                </option>
              ))}
            </select>
            <p className="modal__help">
              O pagamento escolhido direciona o caixa correto quando o pedido for pago.
            </p>
          </div>

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="quote-fulfillment">
                Atendimento
              </label>
              <select
                id="quote-fulfillment"
                className="modal__input"
                value={form.fulfillment}
                onChange={(event) =>
                  updateForm({ fulfillment: event.target.value as FulfillmentMode })
                }
              >
                <option value="producao">Enviar para producao</option>
                <option value="estoque">Retirar do estoque</option>
              </select>
              <p className="modal__help">
                Defina se o pedido vira producao ou sai direto do estoque.
              </p>
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="quote-valid">
                Validade
              </label>
              <input
                id="quote-valid"
                className="modal__input"
                type="date"
                value={form.validUntil}
                onChange={(event) => updateForm({ validUntil: event.target.value })}
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="quote-status">
                Status
              </label>
              <select
                id="quote-status"
                className="modal__input"
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

          <div className="modal__row">
            <div className="summary">
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="summary">
              <span>Desconto aplicado</span>
              <strong>{formatCurrency(appliedDiscount)}</strong>
            </div>
          </div>

          <div className="summary">
            <span>Total do orcamento</span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          {status && <p className="modal__status">{status}</p>}
          {!hasProducts && (
            <p className="modal__help">Cadastre produtos para liberar orcamentos.</p>
          )}
        </form>
      </Modal>

      <div className="orcamentos__layout">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Ultimos orcamentos</h2>
              <p>Atualize status e transforme em pedidos com 1 clique.</p>
            </div>
            <span className="panel__meta">{quotes.length} registros</span>
          </div>
          <div className="table-card">
            <table className="table">
              <thead className="table__head table__head--mobile-hide">
                <tr>
                  <th>Cliente</th>
                  <th>Itens</th>
                  <th>Pagamento</th>
                  <th>Desconto</th>
                  <th>Total</th>
                  <th>Validade</th>
                  <th>Pedido</th>
                  <th className="table__actions table__actions--end">Status / Editar</th>
                </tr>
              </thead>
              <tbody>
                {quotes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="table__empty">
                      Nenhum orcamento cadastrado ainda.
                    </td>
                  </tr>
                )}
                {quotes.map((quote) => {
                  const discountInfo = getQuoteDiscountInfo(quote)
                  return (
                    <tr key={quote.id}>
                      <td className="table__cell--truncate">
                        <div className="table__stack">
                          <strong>{getClientName(quote.clientId)}</strong>
                          <span className="table__sub table__sub--mobile">
                            {formatCurrency(quote.total)}
                          </span>
                        </div>
                      </td>
                      <td className="table__cell--mobile-hide">{formatItemsSummary(quote.items)}</td>
                      <td className="table__cell--mobile-hide">
                        {getPaymentMethodLabel(
                          quote.paymentMethod,
                          data.tabelas?.paymentMethods,
                        )}
                      </td>
                      <td className="table__cell--mobile-hide">
                        {discountInfo.discountValue > 0
                          ? `${formatCurrency(discountInfo.discountValue)} (${formatPercent(
                              discountInfo.discountPercent,
                            )}%)`
                          : '-'}
                      </td>
                      <td className="table__cell--mobile-hide">{formatCurrency(quote.total)}</td>
                      <td className="table__cell--mobile-hide">{formatDateShort(quote.validUntil)}</td>
                      <td className="table__cell--mobile-hide">
                        {quote.convertedOrderId ? `#${quote.convertedOrderId.slice(0, 6)}` : '-'}
                      </td>
                      <td className="table__actions table__actions--end">
                        <div className="table__end">
                          <select
                            className="table__select"
                            data-status={quote.status}
                            value={quote.status}
                            onChange={(event) =>
                              handleInlineStatusChange(
                                quote,
                                event.target.value as Quote['status'],
                              )
                            }
                          >
                            {Object.entries(statusLabels).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <ActionMenu
                            items={[
                              { label: 'Editar', onClick: () => handleEdit(quote) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
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
    </Page>
  )
}

export default Orcamentos
