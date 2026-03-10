import { useMemo, useState } from 'react'
import ActionMenu from '../../components/ActionMenu'
import Modal from '../../components/Modal'
import QuickNotice from '../../components/QuickNotice'
import { Page, PageHeader } from '@ui/components'
import { dataService } from '@shared/services/dataService'
import { useERPData } from '@shared/store/appStore'
import type {
  BatchRecipe,
  BatchRecipeItem,
  Material,
  MaterialUsageUnit,
  Product,
  ProductMaterialUsage,
} from '@shared/types/erp'
import { deriveUsagesFromBatch } from '@shared/utils/batch'
import { createId } from '@shared/utils/ids'
import { getMaterialUnitLabel, getProductUnitLabel } from '@shared/utils/units'
import {
  MATERIAL_USAGE_UNITS,
  convertUsageToPurchaseQuantity,
  getDefaultUsageUnit,
  getUsageUnitLabel,
} from '@shared/utils/materialUsage'

type UsageForm = {
  id: string
  materialId: string
  quantity: number
  usageUnit: MaterialUsageUnit
}

const createUsageForm = (): UsageForm => ({
  id: createId(),
  materialId: '',
  quantity: 0,
  usageUnit: 'unidade',
})

type BatchItemForm = {
  id: string
  materialId: string
  quantity: number
  usageUnit: MaterialUsageUnit
}

const createBatchItemForm = (): BatchItemForm => ({
  id: createId(),
  materialId: '',
  quantity: 0,
  usageUnit: 'unidade',
})

const ConsumoProdutos = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [usageForm, setUsageForm] = useState<UsageForm[]>([])
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [batchStatus, setBatchStatus] = useState<string | null>(null)
  const [batchProductId, setBatchProductId] = useState('')
  const [batchVariantId, setBatchVariantId] = useState('')
  const [batchYieldQuantity, setBatchYieldQuantity] = useState(0)
  const [batchItems, setBatchItems] = useState<BatchItemForm[]>([])

  const materials = useMemo(
    () => [...data.materiais].sort((a, b) => a.name.localeCompare(b.name)),
    [data.materiais],
  )
  const products = useMemo(
    () => [...data.produtos].sort((a, b) => a.name.localeCompare(b.name)),
    [data.produtos],
  )
  const productionProducts = useMemo(
    () => products.filter((product) => product.producedInternally !== false),
    [products],
  )
  const editingProduct = editingProductId
    ? products.find((product) => product.id === editingProductId)
    : null
  const editingVariant = editingProduct?.variants?.find(
    (variant) => variant.id === editingVariantId,
  )
  const batchProduct = batchProductId
    ? products.find((product) => product.id === batchProductId)
    : null
  const batchVariant = batchProduct?.variants?.find(
    (variant) => variant.id === batchVariantId,
  )

  const buildUsageForm = (usages: ProductMaterialUsage[]) =>
    usages.map((usage) => {
      const material = materials.find((item) => item.id === usage.materialId)
      const fallbackUnit = material?.kind ? getDefaultUsageUnit(material.kind) : 'unidade'
      return {
        id: usage.id,
        materialId: usage.materialId,
        quantity: usage.quantity,
        usageUnit:
          usage.usageUnit ??
          (usage.unitMode === 'metro' ? 'metro' : fallbackUnit),
      }
    })

  const loadBatchRecipe = (recipe?: BatchRecipe | null) => {
    if (recipe && recipe.items.length > 0) {
      setBatchYieldQuantity(recipe.yieldQuantity)
      setBatchItems(
        recipe.items.map((item) => {
          const material = getMaterial(item.materialId)
          const fallbackUnit = material?.kind ? getDefaultUsageUnit(material.kind) : 'unidade'
          return {
            id: item.id || createId(),
            materialId: item.materialId,
            quantity: item.quantity,
            usageUnit: item.usageUnit ?? fallbackUnit,
          }
        }),
      )
      return
    }
    setBatchYieldQuantity(0)
    setBatchItems([createBatchItemForm()])
  }

  const summary = useMemo(() => {
    const configured = productionProducts.filter((product) => {
      if (product.hasVariants) {
        return (product.variants ?? []).some(
          (variant) => (variant.materialUsages ?? []).length > 0,
        )
      }
      return (product.materialUsages ?? []).length > 0
    })
    const batched = productionProducts.reduce((acc, product) => {
      if (product.hasVariants) {
        return (
          acc +
          (product.variants ?? []).filter(
            (variant) =>
              variant.batchRecipe &&
              variant.batchRecipe.items.length > 0 &&
              variant.batchRecipe.yieldQuantity > 0,
          ).length
        )
      }
      if (
        product.batchRecipe &&
        product.batchRecipe.items.length > 0 &&
        product.batchRecipe.yieldQuantity > 0
      ) {
        return acc + 1
      }
      return acc
    }, 0)
    const totalUsages = productionProducts.reduce((acc, product) => {
      if (product.hasVariants) {
        return (
          acc +
          (product.variants ?? []).reduce(
            (sum, variant) => sum + (variant.materialUsages?.length ?? 0),
            0,
          )
        )
      }
      return acc + (product.materialUsages?.length ?? 0)
    }, 0)
    return {
      total: productionProducts.length,
      configured: configured.length,
      pending: productionProducts.length - configured.length,
      totalUsages,
      batched,
    }
  }, [productionProducts])

  const openModal = (product: Product, variantId?: string) => {
    const defaultVariantId = product.hasVariants ? product.variants?.[0]?.id ?? '' : ''
    const nextVariantId = product.hasVariants ? variantId ?? defaultVariantId : ''
    const targetVariant = product.variants?.find((variant) => variant.id === nextVariantId)
    const usages = product.hasVariants
      ? buildUsageForm(targetVariant?.materialUsages ?? [])
      : buildUsageForm(product.materialUsages ?? [])
    setEditingProductId(product.id)
    setEditingVariantId(nextVariantId || null)
    setUsageForm(usages.length > 0 ? usages : [createUsageForm()])
    setStatus(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingProductId(null)
    setEditingVariantId(null)
    setUsageForm([])
  }

  const updateUsage = (id: string, patch: Partial<UsageForm>) => {
    setUsageForm((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const addUsage = () => {
    setUsageForm((prev) => [...prev, createUsageForm()])
  }

  const removeUsage = (id: string) => {
    setUsageForm((prev) => prev.filter((item) => item.id !== id))
  }

  const getMaterial = (materialId: string) =>
    materials.find((material) => material.id === materialId)

  const handleMaterialChange = (id: string, materialId: string) => {
    const material = getMaterial(materialId)
    const nextUnit = material?.kind ? getDefaultUsageUnit(material.kind) : 'unidade'
    updateUsage(id, {
      materialId,
      usageUnit: nextUnit,
    })
  }

  const handleUsageVariantChange = (variantId: string) => {
    if (!editingProduct) {
      return
    }
    const targetVariant = editingProduct.variants?.find((variant) => variant.id === variantId)
    setEditingVariantId(variantId)
    const usages = buildUsageForm(targetVariant?.materialUsages ?? [])
    setUsageForm(usages.length > 0 ? usages : [createUsageForm()])
  }

  const handleSave = () => {
    if (!editingProductId) {
      return
    }
    const product = products.find((item) => item.id === editingProductId)
    if (!product) {
      return
    }
    if (product.hasVariants && !editingVariantId) {
      setStatus('Selecione a variacao para salvar o consumo.')
      return
    }
    if (usageForm.length === 0) {
      setStatus('Adicione ao menos um material.')
      return
    }
    const seen = new Set<string>()
    const cleaned: ProductMaterialUsage[] = []
    for (const item of usageForm) {
      if (!item.materialId) {
        setStatus('Selecione o material em todos os itens.')
        return
      }
      if (seen.has(item.materialId)) {
        setStatus('Nao repita o mesmo material na lista.')
        return
      }
      if (item.quantity <= 0) {
        setStatus('A quantidade deve ser maior que zero.')
        return
      }
      const material = getMaterial(item.materialId)
      if (item.usageUnit === 'metro' && material?.kind === 'trelica') {
        if (!material.metersPerUnit || material.metersPerUnit <= 0) {
          setStatus('Defina os metros por unidade da trelica antes de salvar.')
          return
        }
      }
      seen.add(item.materialId)
      cleaned.push({
        id: item.id || createId(),
        materialId: item.materialId,
        quantity: item.quantity,
        usageUnit: item.usageUnit,
        source: 'manual',
      })
    }

    const payload = dataService.getAll()
    payload.produtos = payload.produtos.map((entry) => {
      if (entry.id !== editingProductId) {
        return entry
      }
      if (product.hasVariants && editingVariantId) {
        return {
          ...entry,
          variants: (entry.variants ?? []).map((variant) =>
            variant.id === editingVariantId
              ? { ...variant, materialUsages: cleaned }
              : variant,
          ),
        }
      }
      return { ...entry, materialUsages: cleaned }
    })
    dataService.replaceAll(payload)
    refresh()
    setStatus('Consumo atualizado.')
    setIsModalOpen(false)
  }

  const openBatchModal = (product?: Product, variantId?: string) => {
    const targetProduct = product ?? batchProduct ?? null
    if (targetProduct) {
      setBatchProductId(targetProduct.id)
    } else {
      setBatchProductId('')
    }
    const nextVariantId = targetProduct?.hasVariants
      ? variantId ?? targetProduct.variants?.[0]?.id ?? ''
      : ''
    setBatchVariantId(nextVariantId)
    const targetVariant = targetProduct?.variants?.find((variant) => variant.id === nextVariantId)
    const recipe =
      targetProduct?.hasVariants && targetVariant
        ? targetVariant.batchRecipe
        : targetProduct?.batchRecipe
    loadBatchRecipe(recipe)
    setBatchStatus(null)
    setIsBatchModalOpen(true)
  }

  const closeBatchModal = () => {
    setIsBatchModalOpen(false)
    setBatchProductId('')
    setBatchVariantId('')
    setBatchYieldQuantity(0)
    setBatchItems([])
    setBatchStatus(null)
  }

  const updateBatchItem = (id: string, patch: Partial<BatchItemForm>) => {
    setBatchItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const addBatchItem = () => {
    setBatchItems((prev) => [...prev, createBatchItemForm()])
  }

  const removeBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleBatchMaterialChange = (id: string, materialId: string) => {
    const material = getMaterial(materialId)
    const nextUnit = material?.kind ? getDefaultUsageUnit(material.kind) : 'unidade'
    updateBatchItem(id, { materialId, usageUnit: nextUnit })
  }

  const handleBatchProductChange = (productId: string) => {
    setBatchProductId(productId)
    const product = products.find((item) => item.id === productId)
    if (!product) {
      setBatchVariantId('')
      loadBatchRecipe(null)
      return
    }
    if (product.hasVariants) {
      const firstVariantId = product.variants?.[0]?.id ?? ''
      setBatchVariantId(firstVariantId)
      const targetVariant = product.variants?.find((variant) => variant.id === firstVariantId)
      loadBatchRecipe(targetVariant?.batchRecipe)
      return
    }
    setBatchVariantId('')
    loadBatchRecipe(product.batchRecipe)
  }

  const handleBatchVariantChange = (variantId: string) => {
    if (!batchProduct) {
      return
    }
    setBatchVariantId(variantId)
    const targetVariant = batchProduct.variants?.find((variant) => variant.id === variantId)
    const recipe = targetVariant?.batchRecipe
    loadBatchRecipe(recipe)
  }

  const handleSaveBatch = () => {
    if (!batchProductId) {
      setBatchStatus('Selecione o produto da batelada.')
      return
    }
    const targetProduct = products.find((item) => item.id === batchProductId)
    if (!targetProduct) {
      setBatchStatus('Produto nao encontrado.')
      return
    }
    if (targetProduct.hasVariants && !batchVariantId) {
      setBatchStatus('Selecione a variacao para esta batelada.')
      return
    }
    if (batchYieldQuantity <= 0) {
      setBatchStatus('Informe o rendimento da batelada.')
      return
    }
    if (batchItems.length === 0) {
      setBatchStatus('Adicione ao menos um material.')
      return
    }
    const seen = new Set<string>()
    const cleanedItems: BatchRecipeItem[] = []
    for (const item of batchItems) {
      if (!item.materialId) {
        setBatchStatus('Selecione o material em todos os itens.')
        return
      }
      if (seen.has(item.materialId)) {
        setBatchStatus('Nao repita o mesmo material na lista.')
        return
      }
      if (item.quantity <= 0) {
        setBatchStatus('A quantidade deve ser maior que zero.')
        return
      }
      const material = getMaterial(item.materialId)
      if (item.usageUnit === 'metro' && material?.kind === 'trelica') {
        if (!material.metersPerUnit || material.metersPerUnit <= 0) {
          setBatchStatus('Defina os metros por unidade da trelica antes de salvar.')
          return
        }
      }
      seen.add(item.materialId)
      cleanedItems.push({
        id: item.id || createId(),
        materialId: item.materialId,
        quantity: item.quantity,
        usageUnit: item.usageUnit,
      })
    }

    const batchRecipe = {
      id:
        targetProduct.hasVariants && batchVariantId
          ? targetProduct.variants?.find((variant) => variant.id === batchVariantId)?.batchRecipe
              ?.id ?? createId()
          : targetProduct.batchRecipe?.id ?? createId(),
      productId: targetProduct.id,
      variantId: targetProduct.hasVariants ? batchVariantId || undefined : undefined,
      yieldQuantity: batchYieldQuantity,
      items: cleanedItems,
      updatedAt: new Date().toISOString(),
    }
    const derivedUsages = deriveUsagesFromBatch(batchRecipe)
    if (derivedUsages.length === 0) {
      setBatchStatus('Batelada sem rendimento valido.')
      return
    }

    const payload = dataService.getAll()
    payload.produtos = payload.produtos.map((item) =>
      item.id === targetProduct.id
        ? targetProduct.hasVariants && batchVariantId
          ? {
              ...item,
              variants: (item.variants ?? []).map((variant) =>
                variant.id === batchVariantId
                  ? { ...variant, batchRecipe, materialUsages: derivedUsages }
                  : variant,
              ),
            }
          : { ...item, batchRecipe, materialUsages: derivedUsages }
        : item,
    )
    dataService.replaceAll(payload)
    refresh()
    setStatus('Batelada atualizada.')
    setIsBatchModalOpen(false)
  }

  const buildUsageLabel = (usage: ProductMaterialUsage, material?: Material) => {
    if (!material) {
      return '-'
    }
    const resolvedUnit = usage.usageUnit ?? getDefaultUsageUnit(material.kind ?? 'outro')
    const label =
      resolvedUnit === 'metro' && material.kind === 'trelica'
        ? `${usage.quantity} m`
        : `${usage.quantity} ${getUsageUnitLabel(resolvedUnit)}`
    return `${material.name}: ${label}`
  }

  return (
    <Page className="consumo-produtos">
      <PageHeader />

      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Produtos</span>
          <strong className="summary__value">{summary.total}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Configurados</span>
          <strong className="summary__value">{summary.configured}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Pendentes</span>
          <strong className="summary__value">{summary.pending}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Itens de consumo</span>
          <strong className="summary__value">{summary.totalUsages}</strong>
        </article>
      </div>

      <section className="panel panel--batch">
        <div className="panel__header">
          <div>
            <h2>Bateladas de concreto</h2>
            <p>
              Registre o traco e o rendimento para gerar o consumo automatico por produto.
            </p>
          </div>
          <div className="panel__actions">
            <span className="panel__meta">{summary.batched} bateladas ativas</span>
            <button
              className="button button--primary"
              type="button"
              onClick={() => openBatchModal()}
            >
              Criar batelada
            </button>
          </div>
        </div>
        <div className="card-grid">
          {summary.batched === 0 && (
            <p className="card-grid__empty">
              Nenhuma batelada cadastrada ainda. Use o botao acima para iniciar.
            </p>
          )}
          {productionProducts.flatMap((product) => {
            if (product.hasVariants) {
              return (product.variants ?? []).flatMap((variant) => {
                const recipe = variant.batchRecipe
                if (!recipe || recipe.items.length === 0 || recipe.yieldQuantity <= 0) {
                  return []
                }
                return [
                  <article
                    key={`${product.id}-${variant.id}`}
                    className="card"
                  >
                    <h3 className="card__title">
                        {product.name} • {variant.name}
                      </h3>
                    <p className="card__meta">
                      Rendimento: {recipe.yieldQuantity}{' '}
                      {getProductUnitLabel(product.unit, data.tabelas)}
                    </p>
                    <p className="card__meta">{recipe.items.length} materiais</p>
                    <div className="card__actions">
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => openBatchModal(product, variant.id)}
                      >
                        Editar batelada
                      </button>
                    </div>
                  </article>,
                ]
              })
            }
            const recipe = product.batchRecipe
            if (!recipe || recipe.items.length === 0 || recipe.yieldQuantity <= 0) {
              return []
            }
            return [
              <article key={product.id} className="card">
                <h3 className="card__title">{product.name}</h3>
                <p className="card__meta">
                  Rendimento: {recipe.yieldQuantity}{' '}
                  {getProductUnitLabel(product.unit, data.tabelas)}
                </p>
                <p className="card__meta">{recipe.items.length} materiais</p>
                <div className="card__actions">
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => openBatchModal(product)}
                  >
                    Editar batelada
                  </button>
                </div>
              </article>,
            ]
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Produtos cadastrados</h2>
            <p>Consumo definido por unidade (m², metro linear ou unidade).</p>
          </div>
          <span className="panel__meta">
            {productionProducts.length} registros
          </span>
        </div>
        <div className="table-card">
          <table className="table">
            <thead className="table__head table__head--mobile-hide">
              <tr>
                <th>Produto</th>
                <th>Unidade</th>
                <th>Materiais</th>
                <th>Resumo</th>
                <th className="table__actions table__actions--end">Editar</th>
              </tr>
            </thead>
            <tbody>
              {productionProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="table__empty">
                    Nenhum produto com linha de producao cadastrado ainda.
                  </td>
                </tr>
              )}
              {productionProducts.map((product) => {
                const variantUsages = (product.variants ?? []).flatMap(
                  (variant) => variant.materialUsages ?? [],
                )
                const usages = product.hasVariants ? variantUsages : product.materialUsages ?? []
                const configuredVariants = product.hasVariants
                  ? (product.variants ?? []).filter(
                      (variant) => (variant.materialUsages ?? []).length > 0,
                    ).length
                  : 0
                const hasBatch = product.hasVariants
                  ? (product.variants ?? []).some(
                      (variant) =>
                        variant.batchRecipe &&
                        variant.batchRecipe.items.length > 0 &&
                        variant.batchRecipe.yieldQuantity > 0,
                    )
                  : product.batchRecipe &&
                    product.batchRecipe.items.length > 0 &&
                    product.batchRecipe.yieldQuantity > 0
                const usageSource = product.hasVariants
                  ? `${configuredVariants}/${product.variants?.length ?? 0} variacoes`
                  : usages.length === 0
                    ? '-'
                    : usages.every((usage) => usage.source === 'batch')
                      ? 'Batelada'
                      : 'Manual'
                return (
                  <tr key={product.id}>
                    <td className="table__cell--truncate">
                      <div className="table__stack">
                        <strong>{product.name}</strong>
                      </div>
                    </td>
                    <td className="table__cell--mobile-hide">
                      {getProductUnitLabel(product.unit, data.tabelas)}
                    </td>
                    <td className="table__cell--mobile-hide">{usages.length}</td>
                    <td className="table__cell--mobile-hide">
                      {usages.length === 0
                        ? usageSource
                        : product.hasVariants
                          ? usageSource
                          : `${usageSource} • ${usages
                              .slice(0, 3)
                              .map((usage) =>
                                buildUsageLabel(usage, getMaterial(usage.materialId)),
                              )
                              .join(' • ')}`}
                    </td>
                    <td className="table__actions table__actions--end">
                      <ActionMenu
                        items={[
                          {
                            label: hasBatch ? 'Editar batelada' : 'Criar batelada',
                            onClick: () => openBatchModal(product),
                          },
                          {
                            label: product.hasVariants ? 'Consumo por variacao' : 'Definir consumo',
                            onClick: () => openModal(product),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={
          editingProduct
            ? `Consumo: ${editingProduct.name}${editingVariant ? ` • ${editingVariant.name}` : ''}`
            : 'Consumo do produto'
        }
        size="lg"
        actions={
          <button className="button button--primary" type="button" onClick={handleSave}>
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              save
            </span>
            <span className="modal__action-label">Salvar consumo</span>
          </button>
        }
      >
        <div className="modal__form">
          <div className="modal__section">
            <p className="modal__help">
              Informe a quantidade de materia-prima por unidade de venda do produto.
            </p>
            <p className="modal__help">
              Conversoes: 1 balde = 0,01 m3 | 1 carrinho rente = 5 baldes | 1 carrinho cheio = 7
              baldes | 1 saco de cimento = 3,5 baldes.
            </p>
          </div>

          {editingProduct?.hasVariants && (
            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="usage-variant">
                  Variacao
                </label>
                <select
                  id="usage-variant"
                  className="modal__input"
                  value={editingVariantId ?? ''}
                  onChange={(event) => handleUsageVariantChange(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {(editingProduct.variants ?? []).map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {usageForm.map((item, index) => {
            const material = getMaterial(item.materialId)
            const unitLabel = getUsageUnitLabel(item.usageUnit)
            const purchaseLabel = material
              ? getMaterialUnitLabel(material.unit, data.tabelas)
              : '-'
            const purchaseQuantity = material
              ? convertUsageToPurchaseQuantity(material, item.usageUnit, item.quantity)
              : 0
            return (
              <div key={item.id} className="modal__row">
                <div className="modal__group">
                  <label className="modal__label" htmlFor={`usage-material-${index}`}>
                    Material
                  </label>
                  <select
                    id={`usage-material-${index}`}
                    className="modal__input"
                    value={item.materialId}
                    onChange={(event) => handleMaterialChange(item.id, event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {materials.map((materialOption) => (
                      <option key={materialOption.id} value={materialOption.id}>
                        {materialOption.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="modal__group">
                  <label className="modal__label" htmlFor={`usage-qty-${index}`}>
                    Quantidade ({unitLabel})
                  </label>
                  <input
                    id={`usage-qty-${index}`}
                    className="modal__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) =>
                      updateUsage(item.id, { quantity: Number(event.target.value) })
                    }
                  />
                  {material && (
                    <p className="modal__help">
                      Compra: {purchaseQuantity.toFixed(3)} {purchaseLabel}
                    </p>
                  )}
                </div>
                {material && (
                  <div className="modal__group">
                    <label className="modal__label" htmlFor={`usage-unit-${index}`}>
                      Unidade de uso
                    </label>
                    <select
                      id={`usage-unit-${index}`}
                      className="modal__input"
                      value={item.usageUnit}
                      onChange={(event) =>
                        updateUsage(item.id, {
                          usageUnit: event.target.value as UsageForm['usageUnit'],
                        })
                      }
                    >
                      {MATERIAL_USAGE_UNITS[material.kind ?? 'outro'].map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {material.kind === 'trelica' && (
                      <p className="modal__help">
                        1 unidade = {material.metersPerUnit ?? '-'} m
                      </p>
                    )}
                  </div>
                )}
                <div className="modal__group">
                  <label className="modal__label"> </label>
                  <button
                    className="button button--danger"
                    type="button"
                    onClick={() => removeUsage(item.id)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            )
          })}

          <div className="modal__form-actions">
            <button className="button button--ghost" type="button" onClick={addUsage}>
              Adicionar material
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={isBatchModalOpen}
        onClose={closeBatchModal}
        title={batchProduct ? `Batelada: ${batchProduct.name}` : 'Nova batelada'}
        size="lg"
        actions={
          <button className="button button--primary" type="button" onClick={handleSaveBatch}>
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              save
            </span>
            <span className="modal__action-label">Salvar batelada</span>
          </button>
        }
      >
        <div className="modal__form">
          <QuickNotice message={batchStatus} onClear={() => setBatchStatus(null)} />
          <div className="modal__section">
            <p className="modal__help">
              Informe o traco de concreto e o rendimento para gerar o consumo automatico.
            </p>
            <p className="modal__help">
              Conversoes: 1 balde = 0,01 m3 | 1 carrinho rente = 5 baldes | 1 carrinho cheio = 7
              baldes | 1 saco de cimento = 3,5 baldes.
            </p>
          </div>

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="batch-product">
                Produto
              </label>
              <select
                id="batch-product"
                className="modal__input"
                value={batchProductId}
                onChange={(event) => handleBatchProductChange(event.target.value)}
              >
                <option value="">Selecione</option>
                {productionProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              {batchProduct?.batchRecipe && (
                <p className="modal__help">
                  Este produto ja possui batelada. Salvar vai substituir o rendimento atual.
                </p>
              )}
            </div>
            {batchProduct?.hasVariants && (
              <div className="modal__group">
                <label className="modal__label" htmlFor="batch-variant">
                  Variacao
                </label>
                <select
                  id="batch-variant"
                  className="modal__input"
                  value={batchVariantId}
                  onChange={(event) => handleBatchVariantChange(event.target.value)}
                  disabled={!batchProductId}
                >
                  <option value="">Selecione</option>
                  {(batchProduct?.variants ?? []).map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>
                {batchVariant?.batchRecipe && (
                  <p className="modal__help">
                    Esta variacao ja possui batelada. Salvar vai substituir o rendimento atual.
                  </p>
                )}
              </div>
            )}
            <div className="modal__group">
              <label className="modal__label" htmlFor="batch-yield">
                Rendimento da batelada ({getProductUnitLabel(batchProduct?.unit, data.tabelas)})
              </label>
              <input
                id="batch-yield"
                className="modal__input"
                type="number"
                min="0"
                step="0.01"
                value={batchYieldQuantity}
                onChange={(event) => setBatchYieldQuantity(Number(event.target.value))}
              />
              <p className="modal__help">Quantidade total que a batelada produz.</p>
            </div>
          </div>

          {batchItems.map((item, index) => {
            const material = getMaterial(item.materialId)
            const unitLabel = getUsageUnitLabel(item.usageUnit)
            const purchaseLabel = material
              ? getMaterialUnitLabel(material.unit, data.tabelas)
              : '-'
            const purchaseQuantity = material
              ? convertUsageToPurchaseQuantity(material, item.usageUnit, item.quantity)
              : 0
            const perUnit =
              batchYieldQuantity > 0 ? item.quantity / batchYieldQuantity : 0
            return (
              <div key={item.id} className="modal__row">
                <div className="modal__group">
                  <label className="modal__label" htmlFor={`batch-material-${index}`}>
                    Material
                  </label>
                  <select
                    id={`batch-material-${index}`}
                    className="modal__input"
                    value={item.materialId}
                    onChange={(event) => handleBatchMaterialChange(item.id, event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {materials.map((materialOption) => (
                      <option key={materialOption.id} value={materialOption.id}>
                        {materialOption.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="modal__group">
                  <label className="modal__label" htmlFor={`batch-qty-${index}`}>
                    Quantidade ({unitLabel})
                  </label>
                  <input
                    id={`batch-qty-${index}`}
                    className="modal__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) =>
                      updateBatchItem(item.id, { quantity: Number(event.target.value) })
                    }
                  />
                  {material && (
                    <>
                      <p className="modal__help">
                        Compra (batelada): {purchaseQuantity.toFixed(3)} {purchaseLabel}
                      </p>
                      {batchYieldQuantity > 0 && (
                        <p className="modal__help">
                          Por unidade: {perUnit.toFixed(4)} {unitLabel}
                        </p>
                      )}
                    </>
                  )}
                </div>
                {material && (
                  <div className="modal__group">
                    <label className="modal__label" htmlFor={`batch-unit-${index}`}>
                      Unidade de uso
                    </label>
                    <select
                      id={`batch-unit-${index}`}
                      className="modal__input"
                      value={item.usageUnit}
                      onChange={(event) =>
                        updateBatchItem(item.id, {
                          usageUnit: event.target.value as BatchItemForm['usageUnit'],
                        })
                      }
                    >
                      {MATERIAL_USAGE_UNITS[material.kind ?? 'outro'].map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {material.kind === 'trelica' && (
                      <p className="modal__help">
                        1 unidade = {material.metersPerUnit ?? '-'} m
                      </p>
                    )}
                  </div>
                )}
                <div className="modal__group">
                  <label className="modal__label"> </label>
                  <button
                    className="button button--danger"
                    type="button"
                    onClick={() => removeBatchItem(item.id)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            )
          })}

          <div className="modal__form-actions">
            <button className="button button--ghost" type="button" onClick={addBatchItem}>
              Adicionar material
            </button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}

export default ConsumoProdutos
