import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import CurrencyInput from '../../components/CurrencyInput'
import DimensionInput from '../../components/DimensionInput'
import Modal from '../../components/Modal'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { Product, ProductUnit, ProductVariant } from '../../types/erp'
import type { PageIntentAction } from '../../types/ui'
import { formatCurrency } from '../../utils/format'
import { createId } from '../../utils/ids'
import { formatDimensionsMm } from '../../utils/dimensions'
import { getBaseCost, getLaborUnitCost, getMaxDiscountPercentForItem, getMinUnitPrice } from '../../utils/pricing'
import { formatSkuWithVariant } from '../../utils/sku'
import { getProductUnitOptions } from '../../utils/units'

type ProductForm = {
  name: string
  sku: string
  price: number
  priceMin: number | null
  costPrice: number
  laborCost: number
  laborBasis: 'unidade' | 'metro'
  stock: number
  unit: ProductUnit | ''
  length: number
  width: number
  height: number
  active: boolean
  producedInternally: boolean
  hasVariants: boolean
}

type VariantForm = {
  name: string
  sku: string
  length: number
  width: number
  height: number
  stock: number
  priceOverride: number | null
  costOverride: number | null
  active: boolean
}

type ProdutosProps = {
  pageIntent?: PageIntentAction
  onConsumeIntent?: () => void
}

const createEmptyVariantForm = (): VariantForm => ({
  name: '',
  sku: '',
  length: 0,
  width: 0,
  height: 0,
  stock: 0,
  priceOverride: null,
  costOverride: null,
  active: true,
})

const Produtos = ({ pageIntent, onConsumeIntent }: ProdutosProps) => {
  const { data, refresh } = useERPData()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [variantStatus, setVariantStatus] = useState<string | null>(null)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false)
  const [isVariantListOpen, setIsVariantListOpen] = useState(false)
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null)
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null)
  const productSubmitModeRef = useRef<'close' | 'keep'>('close')
  const variantSubmitModeRef = useRef<'close' | 'keep'>('close')
  const [form, setForm] = useState<ProductForm>({
    name: '',
    sku: '',
    price: 0,
    priceMin: null,
    costPrice: 0,
    laborCost: 0,
    laborBasis: 'unidade',
    stock: 0,
    unit: '',
    length: 0,
    width: 0,
    height: 0,
    active: true,
    producedInternally: true,
    hasVariants: false,
  })
  const [variantForm, setVariantForm] = useState<VariantForm>(createEmptyVariantForm())
  const productFormId = 'produto-form'
  const variantFormId = 'produto-variacao-form'

  useEffect(() => {
    if (!selectedProductId && data.produtos.length > 0) {
      setSelectedProductId(data.produtos[0].id)
    }
  }, [selectedProductId, data.produtos])

  const selectedProduct = useMemo(
    () => data.produtos.find((product) => product.id === selectedProductId) ?? null,
    [data.produtos, selectedProductId],
  )
  const productSummary = useMemo(() => {
    return data.produtos.reduce(
      (acc, product) => {
        acc.total += 1
        if (product.active !== false) {
          acc.active += 1
        }
        const variants = product.variants ?? []
        const usesVariants = product.hasVariants ?? false
        const hasLinearVariants =
          product.unit === 'metro_linear' && variants.length > 0
        acc.variants += usesVariants ? variants.length : 0
        const variantStock = usesVariants || hasLinearVariants
          ? variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0)
          : 0
        const stock = usesVariants || hasLinearVariants ? variantStock : product.stock ?? 0
        acc.stock += stock
        return acc
      },
      { total: 0, active: 0, variants: 0, stock: 0 },
    )
  }, [data.produtos])

  const updateForm = (patch: Partial<ProductForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const updateVariantForm = (patch: Partial<VariantForm>) => {
    setVariantForm((prev) => ({ ...prev, ...patch }))
  }

  const resetForm = () => {
    setForm({
      name: '',
      sku: '',
      price: 0,
      priceMin: null,
      costPrice: 0,
      laborCost: 0,
      laborBasis: 'unidade',
      stock: 0,
      unit: '',
      length: 0,
      width: 0,
      height: 0,
      active: true,
      producedInternally: true,
      hasVariants: false,
    })
    setEditingId(null)
  }

  const resetVariantForm = () => {
    setVariantForm(createEmptyVariantForm())
    setEditingVariantId(null)
    setVariantStatus(null)
  }

  const closeProductModal = () => {
    productSubmitModeRef.current = 'close'
    setIsProductModalOpen(false)
    setStatus(null)
    resetForm()
  }

  const openProductModal = () => {
    setStatus(null)
    resetForm()
    productSubmitModeRef.current = 'close'
    setIsProductModalOpen(true)
  }

  const openVariantList = (product: Product) => {
    if (!product.hasVariants) {
      return
    }
    setSelectedProductId(product.id)
    setVariantStatus(null)
    setIsVariantListOpen(true)
  }

  const closeVariantList = () => {
    setIsVariantListOpen(false)
  }

  const closeVariantModal = () => {
    variantSubmitModeRef.current = 'close'
    setIsVariantModalOpen(false)
    resetVariantForm()
  }

  const openVariantModal = () => {
    if (!selectedProduct) {
      setVariantStatus('Selecione um produto para adicionar variacoes.')
      return
    }
    if (!selectedProduct.hasVariants) {
      setVariantStatus('Ative o uso de variacoes para este produto.')
      return
    }
    setVariantStatus(null)
    resetVariantForm()
    variantSubmitModeRef.current = 'close'
    setIsVariantModalOpen(true)
  }

  const handleEdit = useCallback((product: Product) => {
    productSubmitModeRef.current = 'close'
    setEditingId(product.id)
    setForm({
      name: product.name,
      sku: product.sku?.toUpperCase() ?? '',
      price: product.price,
      priceMin: product.priceMin ?? null,
      costPrice: product.costPrice ?? 0,
      laborCost: product.laborCost ?? 0,
      laborBasis: product.laborBasis ?? 'unidade',
      stock: product.stock ?? 0,
      unit: product.unit ?? '',
      length: product.length ?? 0,
      width: product.width ?? 0,
      height: product.height ?? 0,
      active: product.active ?? true,
      producedInternally: product.producedInternally ?? true,
      hasVariants: product.hasVariants ?? false,
    })
    setStatus(null)
    setIsProductModalOpen(true)
  }, [productSubmitModeRef, setEditingId, setForm, setStatus, setIsProductModalOpen])

  const handleVariantEdit = useCallback((variant: ProductVariant) => {
    variantSubmitModeRef.current = 'close'
    setEditingVariantId(variant.id)
    setVariantForm({
      name: variant.name,
      sku: variant.sku?.toUpperCase() ?? '',
      length: variant.length ?? 0,
      width: variant.width ?? 0,
      height: variant.height ?? 0,
      stock: variant.stock ?? 0,
      priceOverride: variant.priceOverride ?? null,
      costOverride: variant.costOverride ?? null,
      active: variant.active ?? true,
    })
    setVariantStatus(null)
    setIsVariantModalOpen(true)
  }, [setEditingVariantId, setIsVariantModalOpen, setVariantForm, setVariantStatus, variantSubmitModeRef])

  useEffect(() => {
    if (!pageIntent) {
      return
    }
    if (pageIntent.type === 'open-product') {
      const product = data.produtos.find((item) => item.id === pageIntent.productId)
      if (!product) {
        setStatus('Produto nao encontrado.')
        onConsumeIntent?.()
        return
      }
      setSelectedProductId(product.id)
      handleEdit(product)
      onConsumeIntent?.()
      return
    }
    if (pageIntent.type === 'open-variant') {
      const product = data.produtos.find((item) => item.id === pageIntent.productId)
      const variant = product?.variants?.find((item) => item.id === pageIntent.variantId)
      if (!product || !variant) {
        setVariantStatus('Variacao nao encontrada.')
        onConsumeIntent?.()
        return
      }
      setSelectedProductId(product.id)
      handleVariantEdit(variant)
      onConsumeIntent?.()
    }
  }, [
    data.produtos,
    handleEdit,
    handleVariantEdit,
    onConsumeIntent,
    pageIntent,
    setSelectedProductId,
    setStatus,
    setVariantStatus,
  ])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setStatus('Informe o nome do produto.')
      return
    }
    if (!form.unit) {
      setStatus('Selecione a unidade de medida.')
      return
    }
    if (!form.hasVariants && form.price <= 0) {
      setStatus('O preco base do produto deve ser maior que zero.')
      return
    }
    if (form.costPrice < 0) {
      setStatus('O preco de custo nao pode ser negativo.')
      return
    }
    if (form.laborCost < 0) {
      setStatus('O custo de mao de obra nao pode ser negativo.')
      return
    }
    const priceMinValue = form.priceMin ?? undefined
    if (!form.hasVariants && priceMinValue !== undefined && !Number.isFinite(priceMinValue)) {
      setStatus('Informe um preco minimo valido.')
      return
    }
    if (!form.hasVariants && priceMinValue !== undefined && priceMinValue < 0) {
      setStatus('O preco minimo nao pode ser negativo.')
      return
    }
    if (!form.hasVariants && priceMinValue !== undefined && priceMinValue > form.price) {
      setStatus('O preco minimo nao pode ser maior que o preco base.')
      return
    }
    const shouldClose = productSubmitModeRef.current !== 'keep'
    productSubmitModeRef.current = 'close'

    const payload = dataService.getAll()
    const existingProduct = editingId
      ? payload.produtos.find((product) => product.id === editingId)
      : undefined
    const next: Product = {
      id: editingId ?? createId(),
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase() || undefined,
      price: form.price,
      priceMin: form.hasVariants ? undefined : priceMinValue,
      maxDiscountPercent: existingProduct?.maxDiscountPercent,
      costPrice: form.costPrice,
      laborCost: form.laborCost,
      laborBasis: form.laborBasis,
      stock: form.stock,
      unit: form.unit,
      length: form.length || undefined,
      width: form.width || undefined,
      height: form.height || undefined,
      active: form.active,
      producedInternally: form.producedInternally,
      hasVariants: form.hasVariants,
      variants: existingProduct?.variants ?? [],
      materialUsages: existingProduct?.materialUsages ?? [],
      batchRecipe: existingProduct?.batchRecipe,
    }

    if (editingId) {
      payload.produtos = payload.produtos.map((product) =>
        product.id === editingId ? next : product,
      )
    } else {
      payload.produtos = [...payload.produtos, next]
      setSelectedProductId(next.id)
    }

    dataService.replaceAll(payload)
    refresh()
    setStatus(editingId ? 'Produto atualizado.' : 'Produto cadastrado.')
    if (shouldClose) {
      setIsProductModalOpen(false)
      resetForm()
      return
    }
    if (!editingId) {
      resetForm()
    }
  }

  const buildVariantLabel = (variant: VariantForm) => {
    if (variant.name.trim()) {
      return variant.name.trim()
    }
    const dimensions = formatDimensionsMm(
      [variant.length, variant.width, variant.height],
      { separator: 'x', emptyLabel: '' },
    )
    if (dimensions) {
      return dimensions
    }
    return 'Variacao'
  }

  const resolveDimensionValue = (variantValue?: number, productValue?: number) => {
    if (variantValue && variantValue > 0) {
      return variantValue
    }
    if (productValue && productValue > 0) {
      return productValue
    }
    return 0
  }

  const formatDimensions = (length?: number, width?: number, height?: number) =>
    formatDimensionsMm([length, width, height])

  const resolveCostForDisplay = (product: Product, variant?: ProductVariant) => {
    const isLinear = product.unit === 'metro_linear'
    const isArea = product.unit === 'm2'
    if (variant) {
      const hasVariantCostData =
        (variant.costOverride ?? 0) > 0 ||
        (variant.materialUsages?.length ?? 0) > 0 ||
        (!!variant.batchRecipe &&
          variant.batchRecipe.items.length > 0 &&
          variant.batchRecipe.yieldQuantity > 0)
      if (!hasVariantCostData) {
        return '-'
      }
    }
    const customLength = isLinear || isArea ? 1 : variant?.length ?? product.length
    const customWidth = isArea ? 1 : variant?.width ?? product.width
    const baseCost = getBaseCost(product, variant, {
      materials: data.materiais,
      customLength,
      customWidth,
    })
    const laborCost = getLaborUnitCost(product, variant, customLength)
    const total = baseCost + laborCost
    return total > 0 ? formatCurrency(total) : '-'
  }

  const formatLaborBasis = (basis?: Product['laborBasis']) =>
    basis === 'metro' ? 'metro linear' : 'unidade'

  const formatPercent = (value: number) =>
    Number.isFinite(value) ? (value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)) : '0'

  const getProductPricingSummary = (product: Product) => {
    const isLinear = product.unit === 'metro_linear'
    const isArea = product.unit === 'm2'
    const context = {
      materials: data.materiais,
      customLength: isLinear || isArea ? 1 : product.length,
      customWidth: isArea ? 1 : product.width,
    }
    const unitCost =
      getBaseCost(product, undefined, context) +
      getLaborUnitCost(product, undefined, context.customLength)
    const minUnit = getMinUnitPrice(product, undefined, context)
    const maxPercent = getMaxDiscountPercentForItem(
      {
        product,
        unitPrice: product.price,
        quantity: 1,
        customLength: context.customLength,
        customWidth: context.customWidth,
      },
      data.materiais,
    )
    const maxValue = product.price * (maxPercent / 100)
    return { unitCost, minUnit, maxPercent, maxValue }
  }

  const formatVariantDimensions = (variant: ProductVariant, product?: Product) => {
    const length = resolveDimensionValue(variant.length, product?.length)
    const width = resolveDimensionValue(variant.width, product?.width)
    const height = resolveDimensionValue(variant.height, product?.height)
    return formatDimensions(length, width, height)
  }

  const previewPriceMin = form.priceMin ?? undefined
  const previewProduct: Product = {
    id: 'preview',
    name: 'preview',
    price: form.price,
    priceMin: Number.isNaN(previewPriceMin ?? 0) ? undefined : previewPriceMin,
    costPrice: form.costPrice,
    laborCost: form.laborCost,
    laborBasis: form.laborBasis,
    unit: form.unit || undefined,
    length: form.length,
    width: form.width,
  }
  const previewSummary = getProductPricingSummary(previewProduct)

  const handleVariantSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProduct) {
      setVariantStatus('Selecione um produto para adicionar variacoes.')
      return
    }
    if (variantForm.stock < 0) {
      setVariantStatus('Estoque nao pode ser negativo.')
      return
    }

    const payload = dataService.getAll()
    const productIndex = payload.produtos.findIndex((product) => product.id === selectedProduct.id)
    if (productIndex < 0) {
      setVariantStatus('Produto nao encontrado.')
      return
    }

    const priceOverride = variantForm.priceOverride
    const costOverride = variantForm.costOverride

    if (selectedProduct.hasVariants && priceOverride === null) {
      setVariantStatus('Informe o preco da variacao.')
      return
    }
    const shouldClose = variantSubmitModeRef.current !== 'keep'
    variantSubmitModeRef.current = 'close'

    const nextVariant: ProductVariant = {
      id: editingVariantId ?? createId(),
      productId: selectedProduct.id,
      name: buildVariantLabel(variantForm),
      length: variantForm.length || undefined,
      width: variantForm.width || undefined,
      height: variantForm.height || undefined,
      stock: variantForm.stock,
      sku: variantForm.sku.trim().toUpperCase() || undefined,
      priceOverride: priceOverride ?? undefined,
      costOverride: costOverride ?? undefined,
      active: variantForm.active,
      isCustom: false,
    }

    const product = payload.produtos[productIndex]
    const variants = product.variants ?? []

    if (editingVariantId) {
      payload.produtos[productIndex] = {
        ...product,
        variants: variants.map((variant) =>
          variant.id === editingVariantId ? nextVariant : variant,
        ),
      }
    } else {
      payload.produtos[productIndex] = {
        ...product,
        variants: [...variants, nextVariant],
      }
    }

    dataService.replaceAll(payload)
    refresh()
    setVariantStatus(editingVariantId ? 'Variacao atualizada.' : 'Variacao cadastrada.')
    if (shouldClose) {
      setIsVariantModalOpen(false)
      resetVariantForm()
      return
    }
    if (!editingVariantId) {
      setVariantForm(createEmptyVariantForm())
      setEditingVariantId(null)
    }
  }

  const products = useMemo(
    () => [...data.produtos].sort((a, b) => a.name.localeCompare(b.name)),
    [data.produtos],
  )

  const selectedUsesVariants = !!selectedProduct?.hasVariants
  const variants = selectedUsesVariants ? selectedProduct?.variants ?? [] : []

  const productToDelete = deleteProductId
    ? data.produtos.find((product) => product.id === deleteProductId)
    : null

  const variantToDelete =
    deleteVariantId && selectedUsesVariants
      ? selectedProduct?.variants?.find((variant) => variant.id === deleteVariantId)
      : null

  const handleDeleteProduct = () => {
    if (!deleteProductId) {
      return
    }
    const payload = dataService.getAll()
    payload.produtos = payload.produtos.filter((product) => product.id !== deleteProductId)
    dataService.replaceAll(payload)
    refresh()
    if (selectedProductId === deleteProductId) {
      const nextProduct = payload.produtos[0]
      setSelectedProductId(nextProduct ? nextProduct.id : null)
    }
    productSubmitModeRef.current = 'close'
    setIsProductModalOpen(false)
    resetForm()
    setStatus('Produto excluido.')
    setDeleteProductId(null)
  }

  const handleDeleteVariant = () => {
    if (!deleteVariantId || !selectedProduct || !selectedProduct.hasVariants) {
      return
    }
    const payload = dataService.getAll()
    const index = payload.produtos.findIndex((product) => product.id === selectedProduct.id)
    if (index >= 0) {
      const current = payload.produtos[index]
      payload.produtos[index] = {
        ...current,
        variants: (current.variants ?? []).filter((variant) => variant.id !== deleteVariantId),
      }
    }
    dataService.replaceAll(payload)
    refresh()
    variantSubmitModeRef.current = 'close'
    setIsVariantModalOpen(false)
    resetVariantForm()
    setVariantStatus('Variacao excluida.')
    setDeleteVariantId(null)
  }

  return (
    <Page className="produtos">
      <PageHeader
        actions={
          <button className="button button--primary" type="button" onClick={openProductModal}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              inventory_2
            </span>
            <span className="page-header__action-label">Novo produto</span>
          </button>
        }
      />
      {status && <p className="form__status">{status}</p>}

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Total</span>
          <strong className="summary__value">{productSummary.total}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Ativos</span>
          <strong className="summary__value">{productSummary.active}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Variacoes</span>
          <strong className="summary__value">{productSummary.variants}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Estoque total</span>
          <strong className="summary__value">{productSummary.stock}</strong>
        </article>
      </div>

      <Modal
        open={isProductModalOpen}
        onClose={closeProductModal}
        title={editingId ? 'Editar produto' : 'Novo produto'}
        size="lg"
        actions={
          <>
            {editingId && (
              <button
                className="button button--danger"
                type="button"
                onClick={() => setDeleteProductId(editingId)}
              >
                <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                  delete
                </span>
                <span className="modal__action-label">Excluir</span>
              </button>
            )}
            <button
              className="button button--secondary"
              type="submit"
              form={productFormId}
              onClick={() => {
                productSubmitModeRef.current = 'keep'
              }}
            >
              <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                save_as
              </span>
              <span className="modal__action-label">
                {editingId ? 'Atualizar e continuar' : 'Salvar e novo'}
              </span>
            </button>
            <button
              className="button button--primary"
              type="submit"
              form={productFormId}
              onClick={() => {
                productSubmitModeRef.current = 'close'
              }}
            >
              <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                save
              </span>
              <span className="modal__action-label">
                {editingId ? 'Atualizar' : 'Salvar produto'}
              </span>
            </button>
          </>
        }
      >
        <form id={productFormId} className="modal__form" onSubmit={handleSubmit}>
            <div className="modal__group">
              <label className="modal__label" htmlFor="product-name">
                Nome
              </label>
              <input
                id="product-name"
                className="modal__input"
                type="text"
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                placeholder="Nome do produto"
              />
            </div>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="product-sku">
                  SKU
                </label>
                <input
                  id="product-sku"
                  className="modal__input"
                  type="text"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={form.sku}
                  onChange={(event) =>
                    updateForm({ sku: event.target.value.toUpperCase() })
                  }
                  placeholder="SKU opcional"
                />
              </div>
              <div className="modal__group">
              <label className="modal__label" htmlFor="product-unit">
                Unidade
              </label>
              <select
                id="product-unit"
                className="modal__input"
                value={form.unit}
                onChange={(event) =>
                  updateForm({ unit: event.target.value as ProductForm['unit'] })
                }
              >
                <option value="">Selecione</option>
              {getProductUnitOptions(data.tabelas).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              </select>
            </div>
            </div>

            <label className="toggle modal__checkbox">
              <input
                type="checkbox"
                checked={form.hasVariants}
                onChange={(event) => updateForm({ hasVariants: event.target.checked })}
              />
              <span className="toggle__track" aria-hidden="true">
                <span className="toggle__thumb" />
              </span>
              <span className="toggle__label">
                Produto com variacoes (precos, medidas e estoque nas variacoes)
              </span>
            </label>

            <label className="toggle modal__checkbox">
              <input
                type="checkbox"
                checked={form.producedInternally}
                onChange={(event) =>
                  updateForm({ producedInternally: event.target.checked })
                }
              />
              <span className="toggle__track" aria-hidden="true">
                <span className="toggle__thumb" />
              </span>
              <span className="toggle__label">
                Produto com linha de producao (aparece no consumo por produto)
              </span>
            </label>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="product-length">
                  Comprimento base
                </label>
                <DimensionInput
                  id="product-length"
                  className="modal__input"
                  min="0"
                  value={form.length}
                  step={0.01}
                  onValueChange={(value) => updateForm({ length: value })}
                  disabled={form.hasVariants}
                />
              </div>
              <div className="modal__group">
                <label className="modal__label" htmlFor="product-width">
                  Largura base
                </label>
                <DimensionInput
                  id="product-width"
                  className="modal__input"
                  min="0"
                  value={form.width}
                  step={0.01}
                  onValueChange={(value) => updateForm({ width: value })}
                  disabled={form.hasVariants}
                />
              </div>
              <div className="modal__group">
                <label className="modal__label" htmlFor="product-height">
                  Altura base
                </label>
                <DimensionInput
                  id="product-height"
                  className="modal__input"
                  min="0"
                  value={form.height}
                  step={0.01}
                  onValueChange={(value) => updateForm({ height: value })}
                  disabled={form.hasVariants}
                />
              </div>
            </div>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="product-price">
                  Preco base
                </label>
                <CurrencyInput
                  id="product-price"
                  className="modal__input"
                  value={form.price}
                  onValueChange={(value) => updateForm({ price: value ?? 0 })}
                  disabled={form.hasVariants}
                />
                {form.hasVariants && (
                  <p className="modal__help">Defina o preco dentro das variacoes.</p>
                )}
              </div>
              <div className="modal__group">
                <label className="modal__label" htmlFor="product-cost">
                  Preco de custo
                </label>
                <CurrencyInput
                  id="product-cost"
                  className="modal__input"
                  value={form.costPrice}
                  onValueChange={(value) => updateForm({ costPrice: value ?? 0 })}
                  disabled={form.hasVariants}
                />
                {form.hasVariants && (
                  <p className="modal__help">Custo pode ser definido por variacao.</p>
                )}
              </div>
            </div>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="product-price-min">
                  Preco minimo (nao negociavel)
                </label>
                <CurrencyInput
                  id="product-price-min"
                  className="modal__input"
                  value={form.priceMin}
                  onValueChange={(value) => updateForm({ priceMin: value })}
                  allowEmpty
                  placeholder={`Base: ${formatCurrency(form.price)}`}
                  disabled={form.hasVariants}
                />
                {!form.hasVariants && form.price > 0 ? (
                  <p className="modal__help">
                    Sugestao: minimo sem prejuizo {formatCurrency(previewSummary.minUnit)} | desconto maximo{' '}
                    {formatPercent(previewSummary.maxPercent)}% ({formatCurrency(previewSummary.maxValue)}).
                  </p>
                ) : (
                  <p className="modal__help">
                    {form.hasVariants
                      ? 'Desconto minimo e definido nas variacoes.'
                      : 'Defina o preco base para calcular o desconto sugerido.'}
                  </p>
                )}
              </div>
            </div>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="product-labor">
                  Mao de obra (por {formatLaborBasis(form.laborBasis)})
                </label>
                <CurrencyInput
                  id="product-labor"
                  className="modal__input"
                  value={form.laborCost}
                  onValueChange={(value) => updateForm({ laborCost: value ?? 0 })}
                />
              </div>
              <div className="modal__group">
                <label className="modal__label" htmlFor="product-labor-basis">
                  Base da mao de obra
                </label>
                <select
                  id="product-labor-basis"
                  className="modal__input"
                  value={form.laborBasis}
                  onChange={(event) =>
                    updateForm({ laborBasis: event.target.value as ProductForm['laborBasis'] })
                  }
                >
                  <option value="unidade">Unidade</option>
                  <option value="metro">Metro linear</option>
                </select>
              </div>
              <div className="modal__group">
                <label className="modal__label" htmlFor="product-stock">
                  Estoque inicial
                </label>
                <input
                  id="product-stock"
                  className="modal__input"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(event) => updateForm({ stock: Number(event.target.value) })}
                  disabled={form.hasVariants}
                />
              </div>
            </div>

            <label className="toggle modal__checkbox">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => updateForm({ active: event.target.checked })}
              />
              <span className="toggle__track" aria-hidden="true">
                <span className="toggle__thumb" />
              </span>
              <span className="toggle__label">Produto ativo</span>
            </label>

            {status && <p className="modal__status">{status}</p>}
        </form>
      </Modal>

      <div className="produtos__layout">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Produtos cadastrados</h2>
              <p>Visao geral de custos, estoque e precos base.</p>
            </div>
            <span className="panel__meta">{products.length} registros</span>
          </div>
          <div className="table-card">
            <table className="table">
              <thead className="table__head table__head--mobile-hide">
                <tr className="table__row">
                  <th>Produto</th>
                  <th className="table__cell--tight table__cell--mobile-hide">SKU</th>
                  <th className="table__cell--mobile-hide">Medidas base (mm)</th>
                  <th className="table__cell--mobile-hide">Preco base</th>
                  <th className="table__cell--mobile-hide">Custo unitario</th>
                  <th className="table__actions table__actions--end">Status / Editar</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr className="table__row">
                    <td colSpan={6} className="table__empty">
                      Nenhum produto cadastrado ainda.
                    </td>
                  </tr>
                )}
                {products.map((product) => {
                  const usesVariants = product.hasVariants ?? false
                  const displayDimensions = usesVariants
                    ? ''
                    : formatDimensions(product.length, product.width, product.height)
                  const displayPrice = usesVariants ? '' : formatCurrency(product.price)
                  const displayCost = usesVariants ? '' : resolveCostForDisplay(product)
                  const nameContent = (
                    <>
                      <strong>{product.name}</strong>
                      {usesVariants ? (
                        <span className="table__sub">Com variacao</span>
                      ) : (
                        <>
                          <span className="table__sub table__sub--mobile">{displayPrice}</span>
                          <span className="table__sub table__sub--mobile">{displayCost}</span>
                        </>
                      )}
                    </>
                  )
                  return (
                    <tr key={product.id} className="table__row">
                      <td className="table__cell--truncate">
                        {usesVariants ? (
                          <button
                            type="button"
                            className="table__stack table__link"
                            onClick={() => openVariantList(product)}
                            aria-label={`Ver variacoes de ${product.name}`}
                          >
                            {nameContent}
                          </button>
                        ) : (
                          <div className="table__stack">{nameContent}</div>
                        )}
                      </td>
                      <td className="table__cell--tight table__cell--mobile-hide">
                        {product.sku ?? '-'}
                      </td>
                      <td className="table__cell--mobile-hide">{displayDimensions}</td>
                      <td className="table__cell--mobile-hide">{displayPrice}</td>
                      <td className="table__cell--mobile-hide">{displayCost}</td>
                      <td className="table__actions table__actions--end">
                        <div className="table__end">
                          <div className="table__status">
                            <span
                              className={`badge ${product.active ? 'badge--aprovado' : 'badge--rascunho'}`}
                            >
                              {product.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <ActionMenu
                            items={[
                              { label: 'Editar', onClick: () => handleEdit(product) },
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

      <Modal
        open={isVariantListOpen}
        onClose={closeVariantList}
        title={selectedProduct ? `Variacoes: ${selectedProduct.name}` : 'Variacoes do produto'}
        size="lg"
        closeLabel="Fechar"
        actions={
          selectedProduct?.hasVariants ? (
            <button className="button button--primary" type="button" onClick={openVariantModal}>
              <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                add
              </span>
              <span className="modal__action-label">Nova variacao</span>
            </button>
          ) : null
        }
      >
        {selectedProduct ? (
          selectedProduct.hasVariants ? (
            <>
              <p className="modal__help">{variants.length} registros</p>
              <div className="table-card">
                <table className="table">
                  <thead className="table__head table__head--mobile-hide">
                    <tr>
                      <th>Variacao</th>
                      <th className="table__cell--tight table__cell--mobile-hide">SKU</th>
                      <th className="table__cell--mobile-hide">Medidas (mm)</th>
                      <th className="table__cell--mobile-hide">Preco</th>
                      <th className="table__cell--mobile-hide">Custo</th>
                      <th className="table__actions table__actions--end">Status / Editar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.length === 0 && (
                      <tr>
                        <td colSpan={6} className="table__empty">
                          Nenhuma variacao cadastrada ainda.
                        </td>
                      </tr>
                    )}
                    {variants.map((variant) => {
                      const displayPrice =
                        variant.priceOverride !== undefined
                          ? formatCurrency(variant.priceOverride)
                          : '-'
                      const displayCost = selectedProduct
                        ? resolveCostForDisplay(selectedProduct, variant)
                        : '-'
                      return (
                        <tr key={variant.id}>
                          <td className="table__cell--truncate">
                            <div className="table__stack">
                              <strong>{variant.name}</strong>
                              <span className="table__sub table__sub--mobile">
                                {displayPrice}
                              </span>
                              <span className="table__sub table__sub--mobile">
                                {displayCost}
                              </span>
                            </div>
                          </td>
                          <td className="table__cell--tight table__cell--mobile-hide">
                            {formatSkuWithVariant(selectedProduct?.sku, variant.sku)}
                          </td>
                          <td className="table__cell--mobile-hide">
                            {formatVariantDimensions(variant, selectedProduct ?? undefined)}
                          </td>
                          <td className="table__cell--mobile-hide">{displayPrice}</td>
                          <td className="table__cell--mobile-hide">{displayCost}</td>
                          <td className="table__actions table__actions--end">
                            <div className="table__end">
                              <div className="table__status">
                                <span
                                  className={`badge ${
                                    variant.active === false
                                      ? 'badge--rascunho'
                                      : 'badge--aprovado'
                                  }`}
                                >
                                  {variant.active === false ? 'Inativa' : 'Ativa'}
                                </span>
                              </div>
                              <ActionMenu
                                items={[
                                  {
                                    label: 'Editar',
                                    onClick: () => handleVariantEdit(variant),
                                    disabled: variant.locked,
                                  },
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
            </>
          ) : (
            <p className="modal__help">
              Este produto esta sem variacoes. Ative a opcao no cadastro para gerenciar
              medidas e estoque por variacao.
            </p>
          )
        ) : (
          <p className="modal__help">Selecione um produto com variacoes para visualizar.</p>
        )}
      </Modal>

      <Modal
        open={isVariantModalOpen}
        onClose={closeVariantModal}
        title={editingVariantId ? 'Editar variacao' : 'Nova variacao'}
        size="lg"
        actions={
          selectedProduct ? (
            <>
              {editingVariantId && (
                <button
                  className="button button--danger"
                  type="button"
                  onClick={() => setDeleteVariantId(editingVariantId)}
                >
                  <span
                    className="material-symbols-outlined modal__action-icon"
                    aria-hidden="true"
                  >
                    delete
                  </span>
                  <span className="modal__action-label">Excluir</span>
                </button>
              )}
              <button
                className="button button--secondary"
                type="submit"
                form={variantFormId}
                onClick={() => {
                  variantSubmitModeRef.current = 'keep'
                }}
              >
                <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                  save_as
                </span>
                <span className="modal__action-label">
                  {editingVariantId ? 'Atualizar e continuar' : 'Salvar e novo'}
                </span>
              </button>
              <button
                className="button button--primary"
                type="submit"
                form={variantFormId}
                onClick={() => {
                  variantSubmitModeRef.current = 'close'
                }}
              >
                <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                  save
                </span>
                <span className="modal__action-label">
                  {editingVariantId ? 'Atualizar variacao' : 'Salvar variacao'}
                </span>
              </button>
            </>
          ) : null
        }
      >
        {selectedProduct ? (
          <form id={variantFormId} className="modal__form" onSubmit={handleVariantSubmit}>
            <div className="modal__group">
              <label className="modal__label" htmlFor="variant-name">
                Nome da variacao
              </label>
              <input
                id="variant-name"
                className="modal__input"
                type="text"
                value={variantForm.name}
                onChange={(event) => updateVariantForm({ name: event.target.value })}
                placeholder="Ex: 1,5m ou Pingadeira 25cm"
              />
            </div>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="variant-length">
                  Comprimento
                </label>
                <DimensionInput
                  id="variant-length"
                  className="modal__input"
                  min="0"
                  value={variantForm.length}
                  step={0.01}
                  onValueChange={(value) => updateVariantForm({ length: value })}
                />
              </div>
              <div className="modal__group">
                <label className="modal__label" htmlFor="variant-width">
                  Largura
                </label>
                <DimensionInput
                  id="variant-width"
                  className="modal__input"
                  min="0"
                  value={variantForm.width}
                  step={0.01}
                  onValueChange={(value) => updateVariantForm({ width: value })}
                />
              </div>
              <div className="modal__group">
                <label className="modal__label" htmlFor="variant-height">
                  Altura
                </label>
                <DimensionInput
                  id="variant-height"
                  className="modal__input"
                  min="0"
                  value={variantForm.height}
                  step={0.01}
                  onValueChange={(value) => updateVariantForm({ height: value })}
                />
              </div>
            </div>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="variant-stock">
                  Estoque
                </label>
                <input
                  id="variant-stock"
                  className="modal__input"
                  type="number"
                  min="0"
                  step="1"
                  value={variantForm.stock}
                  onChange={(event) => updateVariantForm({ stock: Number(event.target.value) })}
                />
              </div>
              <div className="modal__group">
                <label className="modal__label" htmlFor="variant-sku">
                  SKU da variacao
                </label>
                <input
                  id="variant-sku"
                  className="modal__input"
                  type="text"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={variantForm.sku}
                  onChange={(event) =>
                    updateVariantForm({ sku: event.target.value.toUpperCase() })
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="variant-price">
                  Preco sobrescrito
                </label>
                <CurrencyInput
                  id="variant-price"
                  className="modal__input"
                  value={variantForm.priceOverride}
                  onValueChange={(value) => updateVariantForm({ priceOverride: value })}
                  allowEmpty
                  placeholder={`Base: ${formatCurrency(selectedProduct.price)}`}
                />
              </div>
              <div className="modal__group">
                <label className="modal__label" htmlFor="variant-cost">
                  Custo sobrescrito
                </label>
                <CurrencyInput
                  id="variant-cost"
                  className="modal__input"
                  value={variantForm.costOverride}
                  onValueChange={(value) => updateVariantForm({ costOverride: value })}
                  allowEmpty
                  placeholder={
                    selectedProduct.costPrice
                      ? `Base: ${formatCurrency(selectedProduct.costPrice)}`
                      : 'Opcional'
                  }
                />
              </div>
            </div>

            <label className="toggle modal__checkbox">
              <input
                type="checkbox"
                checked={variantForm.active}
                onChange={(event) => updateVariantForm({ active: event.target.checked })}
              />
              <span className="toggle__track" aria-hidden="true">
                <span className="toggle__thumb" />
              </span>
              <span className="toggle__label">Variacao ativa</span>
            </label>

            {variantStatus && <p className="modal__status">{variantStatus}</p>}
          </form>
        ) : (
          <p className="modal__help">Selecione um produto para gerenciar variacoes.</p>
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleteProductId}
        title="Excluir produto?"
        description={
          productToDelete
            ? `O produto ${productToDelete.name} sera removido.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteProductId(null)}
        onConfirm={handleDeleteProduct}
      />
      <ConfirmDialog
        open={!!deleteVariantId}
        title="Excluir variacao?"
        description={
          variantToDelete
            ? `A variacao ${variantToDelete.name} sera removida.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteVariantId(null)}
        onConfirm={handleDeleteVariant}
      />
    </Page>
  )
}

export default Produtos
