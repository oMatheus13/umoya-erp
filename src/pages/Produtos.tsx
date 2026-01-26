import { useEffect, useMemo, useState, type FormEvent } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'
import type { Product, ProductVariant } from '../types/erp'
import { formatCurrency } from '../utils/format'
import { createId } from '../utils/ids'

type ProductForm = {
  name: string
  sku: string
  price: number
  costPrice: number
  laborCost: number
  laborBasis: 'unidade' | 'metro'
  stock: number
  unit: string
  length: number
  width: number
  height: number
  active: boolean
}

type VariantForm = {
  name: string
  sku: string
  length: number
  width: number
  height: number
  stock: number
  priceOverride: string
  costOverride: string
}

const createEmptyVariantForm = (): VariantForm => ({
  name: '',
  sku: '',
  length: 0,
  width: 0,
  height: 0,
  stock: 0,
  priceOverride: '',
  costOverride: '',
})

const Produtos = () => {
  const { data, refresh } = useERPData()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [variantStatus, setVariantStatus] = useState<string | null>(null)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false)
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null)
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>({
    name: '',
    sku: '',
    price: 0,
    costPrice: 0,
    laborCost: 0,
    laborBasis: 'unidade',
    stock: 0,
    unit: '',
    length: 0,
    width: 0,
    height: 0,
    active: true,
  })
  const [variantForm, setVariantForm] = useState<VariantForm>(createEmptyVariantForm())

  useEffect(() => {
    if (!selectedProductId && data.produtos.length > 0) {
      setSelectedProductId(data.produtos[0].id)
    }
  }, [selectedProductId, data.produtos])

  const selectedProduct = useMemo(
    () => data.produtos.find((product) => product.id === selectedProductId) ?? null,
    [data.produtos, selectedProductId],
  )

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
      costPrice: 0,
      laborCost: 0,
      laborBasis: 'unidade',
      stock: 0,
      unit: '',
      length: 0,
      width: 0,
      height: 0,
      active: true,
    })
    setEditingId(null)
  }

  const resetVariantForm = () => {
    setVariantForm(createEmptyVariantForm())
    setEditingVariantId(null)
    setVariantStatus(null)
  }

  const closeProductModal = () => {
    setIsProductModalOpen(false)
    setStatus(null)
    resetForm()
  }

  const openProductModal = () => {
    setStatus(null)
    resetForm()
    setIsProductModalOpen(true)
  }

  const closeVariantModal = () => {
    setIsVariantModalOpen(false)
    resetVariantForm()
  }

  const openVariantModal = () => {
    if (!selectedProduct) {
      setVariantStatus('Selecione um produto para adicionar variacoes.')
      return
    }
    setVariantStatus(null)
    resetVariantForm()
    setIsVariantModalOpen(true)
  }

  const handleEdit = (product: Product) => {
    setEditingId(product.id)
    setForm({
      name: product.name,
      sku: product.sku ?? '',
      price: product.price,
      costPrice: product.costPrice ?? 0,
      laborCost: product.laborCost ?? 0,
      laborBasis: product.laborBasis ?? 'unidade',
      stock: product.stock ?? 0,
      unit: product.unit ?? '',
      length: product.length ?? 0,
      width: product.width ?? 0,
      height: product.height ?? 0,
      active: product.active ?? true,
    })
    setStatus(null)
    setIsProductModalOpen(true)
  }

  const handleVariantEdit = (variant: ProductVariant) => {
    setEditingVariantId(variant.id)
    setVariantForm({
      name: variant.name,
      sku: variant.sku ?? '',
      length: variant.length ?? 0,
      width: variant.width ?? 0,
      height: variant.height ?? 0,
      stock: variant.stock ?? 0,
      priceOverride: variant.priceOverride !== undefined ? String(variant.priceOverride) : '',
      costOverride: variant.costOverride !== undefined ? String(variant.costOverride) : '',
    })
    setVariantStatus(null)
    setIsVariantModalOpen(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setStatus('Informe o nome do produto.')
      return
    }
    if (form.price <= 0) {
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

    const payload = dataService.getAll()
    const existingProduct = editingId
      ? payload.produtos.find((product) => product.id === editingId)
      : undefined
    const next: Product = {
      id: editingId ?? createId(),
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      price: form.price,
      costPrice: form.costPrice,
      laborCost: form.laborCost,
      laborBasis: form.laborBasis,
      stock: form.stock,
      unit: form.unit.trim() || undefined,
      length: form.length || undefined,
      width: form.width || undefined,
      height: form.height || undefined,
      active: form.active,
      variants: existingProduct?.variants ?? [],
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
    setIsProductModalOpen(false)
    resetForm()
  }

  const buildVariantLabel = (variant: VariantForm) => {
    if (variant.name.trim()) {
      return variant.name.trim()
    }
    if (variant.length || variant.width || variant.height) {
      return `${variant.length || 0}x${variant.width || 0}x${variant.height || 0}`
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

  const formatDimensions = (length?: number, width?: number, height?: number) => {
    const values = [length, width, height].map((value) => (value && value > 0 ? value : 0))
    if (values.every((value) => value === 0)) {
      return '-'
    }
    return `${values[0] || 0} x ${values[1] || 0} x ${values[2] || 0}`
  }

  const formatLaborBasis = (basis?: Product['laborBasis']) =>
    basis === 'metro' ? 'metro' : 'unidade'

  const formatVariantDimensions = (variant: ProductVariant, product?: Product) => {
    const length = resolveDimensionValue(variant.length, product?.length)
    const width = resolveDimensionValue(variant.width, product?.width)
    const height = resolveDimensionValue(variant.height, product?.height)
    return formatDimensions(length, width, height)
  }

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

    const priceOverride = variantForm.priceOverride.trim()
    const costOverride = variantForm.costOverride.trim()

    const nextVariant: ProductVariant = {
      id: editingVariantId ?? createId(),
      productId: selectedProduct.id,
      name: buildVariantLabel(variantForm),
      length: variantForm.length || undefined,
      width: variantForm.width || undefined,
      height: variantForm.height || undefined,
      stock: variantForm.stock,
      sku: variantForm.sku.trim() || undefined,
      priceOverride: priceOverride ? Number(priceOverride) : undefined,
      costOverride: costOverride ? Number(costOverride) : undefined,
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
    setIsVariantModalOpen(false)
    resetVariantForm()
  }

  const products = useMemo(
    () => [...data.produtos].sort((a, b) => a.name.localeCompare(b.name)),
    [data.produtos],
  )

  const variants = selectedProduct?.variants ?? []

  const productToDelete = deleteProductId
    ? data.produtos.find((product) => product.id === deleteProductId)
    : null

  const variantToDelete = deleteVariantId
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
    setStatus('Produto excluido.')
    setDeleteProductId(null)
  }

  const handleDeleteVariant = () => {
    if (!deleteVariantId || !selectedProduct) {
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
    setVariantStatus('Variacao excluida.')
    setDeleteVariantId(null)
  }

  return (
    <section className="produtos">
      <div className="produtos__header">
        <div className="produtos__header-content">
          <h1 className="produtos__title">Produtos</h1>
          <p className="produtos__subtitle">
            Cadastre produtos e controle variacoes com estoque independente.
          </p>
        </div>
        <button className="button button--primary" type="button" onClick={openProductModal}>
          Novo produto
        </button>
      </div>
      {status && <p className="form__status">{status}</p>}

      <Modal
        open={isProductModalOpen}
        onClose={closeProductModal}
        title={editingId ? 'Editar produto' : 'Novo produto'}
        size="lg"
      >
        <form className="form" onSubmit={handleSubmit}>
            <div className="form__group">
              <label className="form__label" htmlFor="product-name">
                Nome
              </label>
              <input
                id="product-name"
                className="form__input"
                type="text"
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                placeholder="Nome do produto"
              />
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="product-sku">
                  SKU
                </label>
                <input
                  id="product-sku"
                  className="form__input"
                  type="text"
                  value={form.sku}
                  onChange={(event) => updateForm({ sku: event.target.value })}
                  placeholder="SKU opcional"
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="product-unit">
                  Unidade
                </label>
                <input
                  id="product-unit"
                  className="form__input"
                  type="text"
                  value={form.unit}
                  onChange={(event) => updateForm({ unit: event.target.value })}
                  placeholder="un, kg, m, etc"
                />
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="product-length">
                  Comprimento base
                </label>
                <input
                  id="product-length"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.length}
                  onChange={(event) => updateForm({ length: Number(event.target.value) })}
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="product-width">
                  Largura base
                </label>
                <input
                  id="product-width"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.width}
                  onChange={(event) => updateForm({ width: Number(event.target.value) })}
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="product-height">
                  Altura base
                </label>
                <input
                  id="product-height"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.height}
                  onChange={(event) => updateForm({ height: Number(event.target.value) })}
                />
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="product-price">
                  Preco base
                </label>
                <input
                  id="product-price"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => updateForm({ price: Number(event.target.value) })}
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="product-cost">
                  Preco de custo
                </label>
                <input
                  id="product-cost"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(event) => updateForm({ costPrice: Number(event.target.value) })}
                />
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="product-labor">
                  Mao de obra (por {formatLaborBasis(form.laborBasis)})
                </label>
                <input
                  id="product-labor"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.laborCost}
                  onChange={(event) => updateForm({ laborCost: Number(event.target.value) })}
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="product-labor-basis">
                  Base da mao de obra
                </label>
                <select
                  id="product-labor-basis"
                  className="form__input"
                  value={form.laborBasis}
                  onChange={(event) =>
                    updateForm({ laborBasis: event.target.value as ProductForm['laborBasis'] })
                  }
                >
                  <option value="unidade">Unidade</option>
                  <option value="metro">Metro linear</option>
                </select>
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="product-stock">
                  Estoque inicial
                </label>
                <input
                  id="product-stock"
                  className="form__input"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(event) => updateForm({ stock: Number(event.target.value) })}
                />
              </div>
            </div>

            <label className="form__checkbox">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => updateForm({ active: event.target.checked })}
              />
              Produto ativo
            </label>

            <div className="form__actions">
              <button className="button button--primary" type="submit">
                {editingId ? 'Atualizar' : 'Salvar produto'}
              </button>
              {editingId && (
                <button className="button button--ghost" type="button" onClick={closeProductModal}>
                  Cancelar
                </button>
              )}
            </div>
            {status && <p className="form__status">{status}</p>}
        </form>
      </Modal>

      <div className="produtos__layout">
        <div className="produtos__panel produtos__panel--list">
          <div className="produtos__panel-header">
            <h2>Produtos cadastrados</h2>
            <span>{products.length} registros</span>
          </div>
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>SKU</th>
                  <th>Medidas base</th>
                  <th>Variacoes</th>
                  <th>Estoque total</th>
                  <th>Preco base</th>
                  <th>Custo base</th>
                  <th>Mao de obra</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr>
                    <td colSpan={10} className="table__empty">
                      Nenhum produto cadastrado ainda.
                    </td>
                  </tr>
                )}
                {products.map((product) => {
                  const totalStock = (product.variants ?? []).reduce(
                    (acc, variant) => acc + (variant.stock ?? 0),
                    0,
                  )
                  const displayedStock = product.stock !== undefined ? product.stock : totalStock
                  return (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.sku ?? '-'}</td>
                      <td>{formatDimensions(product.length, product.width, product.height)}</td>
                      <td>{product.variants?.length ?? 0}</td>
                      <td>
                        {displayedStock}
                        {product.unit ? ` ${product.unit}` : ''}
                      </td>
                      <td>{formatCurrency(product.price)}</td>
                      <td>
                        {product.costPrice !== undefined
                          ? formatCurrency(product.costPrice)
                          : '-'}
                      </td>
                      <td>
                        {product.laborCost !== undefined
                          ? `${formatCurrency(product.laborCost)} / ${formatLaborBasis(
                              product.laborBasis,
                            )}`
                          : '-'}
                      </td>
                      <td>
                        <span
                          className={`badge ${product.active ? 'badge--aprovado' : 'badge--rascunho'}`}
                        >
                          {product.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="table__actions">
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => handleEdit(product)}
                        >
                          Editar
                        </button>
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => setSelectedProductId(product.id)}
                        >
                          Variacoes
                        </button>
                        <button
                          className="button button--danger"
                          type="button"
                          onClick={() => setDeleteProductId(product.id)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={isVariantModalOpen}
        onClose={closeVariantModal}
        title={editingVariantId ? 'Editar variacao' : 'Nova variacao'}
        size="lg"
      >
        {selectedProduct ? (
          <form className="form" onSubmit={handleVariantSubmit}>
            <div className="form__group">
              <label className="form__label" htmlFor="variant-name">
                Nome da variacao
              </label>
              <input
                id="variant-name"
                className="form__input"
                type="text"
                value={variantForm.name}
                onChange={(event) => updateVariantForm({ name: event.target.value })}
                placeholder="Ex: 1,5m ou Pingadeira 25cm"
              />
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="variant-length">
                  Comprimento
                </label>
                <input
                  id="variant-length"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={variantForm.length}
                  onChange={(event) => updateVariantForm({ length: Number(event.target.value) })}
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="variant-width">
                  Largura
                </label>
                <input
                  id="variant-width"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={variantForm.width}
                  onChange={(event) => updateVariantForm({ width: Number(event.target.value) })}
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="variant-height">
                  Altura
                </label>
                <input
                  id="variant-height"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={variantForm.height}
                  onChange={(event) => updateVariantForm({ height: Number(event.target.value) })}
                />
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="variant-stock">
                  Estoque
                </label>
                <input
                  id="variant-stock"
                  className="form__input"
                  type="number"
                  min="0"
                  step="1"
                  value={variantForm.stock}
                  onChange={(event) => updateVariantForm({ stock: Number(event.target.value) })}
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="variant-sku">
                  SKU da variacao
                </label>
                <input
                  id="variant-sku"
                  className="form__input"
                  type="text"
                  value={variantForm.sku}
                  onChange={(event) => updateVariantForm({ sku: event.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="variant-price">
                  Preco sobrescrito
                </label>
                <input
                  id="variant-price"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={variantForm.priceOverride}
                  onChange={(event) =>
                    updateVariantForm({ priceOverride: event.target.value })
                  }
                  placeholder={`Base: ${formatCurrency(selectedProduct.price)}`}
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="variant-cost">
                  Custo sobrescrito
                </label>
                <input
                  id="variant-cost"
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={variantForm.costOverride}
                  onChange={(event) =>
                    updateVariantForm({ costOverride: event.target.value })
                  }
                  placeholder={
                    selectedProduct.costPrice
                      ? `Base: ${formatCurrency(selectedProduct.costPrice)}`
                      : 'Opcional'
                  }
                />
              </div>
            </div>

            <div className="form__actions">
              <button className="button button--primary" type="submit">
                {editingVariantId ? 'Atualizar variacao' : 'Salvar variacao'}
              </button>
              <button className="button button--ghost" type="button" onClick={closeVariantModal}>
                Cancelar
              </button>
            </div>
            {variantStatus && <p className="form__status">{variantStatus}</p>}
          </form>
        ) : (
          <p className="produtos__hint">Selecione um produto para gerenciar variacoes.</p>
        )}
      </Modal>

      <div className="produtos__variants">
        <div className="produtos__panel produtos__panel--list">
          <div className="produtos__panel-header">
            <div className="produtos__panel-title">
              <h2>Variacoes do produto</h2>
              <select
                className="form__input"
                value={selectedProductId ?? ''}
                onChange={(event) => setSelectedProductId(event.target.value)}
              >
                <option value="" disabled>
                  Selecione um produto
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="produtos__panel-actions">
              <span>{variants.length} registros</span>
              <button
                className="button button--primary"
                type="button"
                onClick={openVariantModal}
                disabled={!selectedProduct}
              >
                Nova variacao
              </button>
            </div>
          </div>
          {variantStatus && <p className="form__status">{variantStatus}</p>}
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Variacao</th>
                  <th>Medidas (C x L x A)</th>
                  <th>Estoque</th>
                  <th>Preco</th>
                  <th>Custo</th>
                  <th>SKU</th>
                  <th>Tipo</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {variants.length === 0 && (
                  <tr>
                    <td colSpan={8} className="table__empty">
                      Nenhuma variacao cadastrada ainda.
                    </td>
                  </tr>
                )}
                {variants.map((variant) => (
                  <tr key={variant.id}>
                    <td>{variant.name}</td>
                    <td>{formatVariantDimensions(variant, selectedProduct ?? undefined)}</td>
                    <td>{variant.stock}</td>
                    <td>
                      {variant.priceOverride !== undefined
                        ? formatCurrency(variant.priceOverride)
                        : '-'}
                    </td>
                    <td>
                      {variant.costOverride !== undefined
                        ? formatCurrency(variant.costOverride)
                        : '-'}
                    </td>
                    <td>{variant.sku ?? '-'}</td>
                    <td>{variant.isCustom ? 'Custom' : 'Padrao'}</td>
                    <td className="table__actions">
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => handleVariantEdit(variant)}
                      >
                        Editar
                      </button>
                      <button
                        className="button button--danger"
                        type="button"
                        onClick={() => setDeleteVariantId(variant.id)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
    </section>
  )
}

export default Produtos
