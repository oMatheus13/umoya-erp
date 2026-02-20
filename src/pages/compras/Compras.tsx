import { useEffect, useMemo, useState, type FormEvent } from 'react'
import CurrencyInput from '../../components/CurrencyInput'
import Modal from '../../components/Modal'
import QuickNotice from '../../components/QuickNotice'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { Material, PurchaseRecord } from '../../types/erp'
import type { PageIntentAction } from '../../types/ui'
import { formatCurrency, formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'
import { getMaterialUnitLabel } from '../../utils/units'

type PurchaseItemForm = {
  id: string
  type: 'material' | 'extra'
  materialId: string
  description: string
  quantity: number
  unitPrice: number
  pricingMode: 'unit' | 'lot'
  total: number
}

type PurchaseForm = {
  date: string
  supplierId: string
  notes: string
  items: PurchaseItemForm[]
}

const createMaterialItem = (): PurchaseItemForm => ({
  id: createId(),
  type: 'material',
  materialId: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  pricingMode: 'unit',
  total: 0,
})

const createExtraItem = (): PurchaseItemForm => ({
  id: createId(),
  type: 'extra',
  materialId: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  pricingMode: 'unit',
  total: 0,
})

type ComprasProps = {
  pageIntent?: PageIntentAction
  onConsumeIntent?: () => void
}

const Compras = ({ pageIntent, onConsumeIntent }: ComprasProps) => {
  const { data, refresh } = useERPData()
  const now = new Date()
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<PurchaseForm>({
    date: new Date().toISOString().slice(0, 10),
    supplierId: '',
    notes: '',
    items: [createMaterialItem()],
  })
  const purchaseFormId = 'compra-form'
  const [filterSupplierId, setFilterSupplierId] = useState('')
  const [filterMaterialId, setFilterMaterialId] = useState('')

  const suppliers = useMemo(
    () => [...data.fornecedores].sort((a, b) => a.name.localeCompare(b.name)),
    [data.fornecedores],
  )
  const materials = useMemo(
    () => [...data.materiais].sort((a, b) => a.name.localeCompare(b.name)),
    [data.materiais],
  )

  const monthlyExpenses = useMemo(() => {
    return data.financeiro
      .filter((entry) => {
        const entryDate = new Date(entry.createdAt)
        return (
          entry.type === 'saida' &&
          entryDate.getMonth() === now.getMonth() &&
          entryDate.getFullYear() === now.getFullYear()
        )
      })
      .reduce((acc, entry) => acc + entry.amount, 0)
  }, [data.financeiro, now])

  const recentExpenses = useMemo(
    () =>
      [...data.financeiro]
        .filter((entry) => entry.type === 'saida')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [data.financeiro],
  )

  const purchases = useMemo(
    () => [...data.comprasHistorico].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.comprasHistorico],
  )
  const filteredPurchases = useMemo(() => {
    return purchases.filter((purchase) => {
      const supplierMatch = filterSupplierId ? purchase.supplierId === filterSupplierId : true
      const materialMatch = filterMaterialId
        ? purchase.items.some((item) => item.materialId === filterMaterialId)
        : true
      return supplierMatch && materialMatch
    })
  }, [filterMaterialId, filterSupplierId, purchases])

  const openModal = () => {
    setStatus(null)
    setForm({
      date: new Date().toISOString().slice(0, 10),
      supplierId: '',
      notes: '',
      items: materials.length > 0 ? [createMaterialItem()] : [createExtraItem()],
    })
    setIsModalOpen(true)
  }

  useEffect(() => {
    if (pageIntent?.type !== 'new') {
      return
    }
    openModal()
    onConsumeIntent?.()
  }, [pageIntent, onConsumeIntent])

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const updateForm = (patch: Partial<PurchaseForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const updateItem = (id: string, patch: Partial<PurchaseItemForm>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }

  const addMaterialItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, createMaterialItem()] }))
  }

  const addExtraItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, createExtraItem()] }))
  }

  const removeItem = (id: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }))
  }

  const resolveMaterialPrice = (
    material: Material | undefined,
    mode: PurchaseItemForm['pricingMode'],
  ) => {
    if (!material) {
      return 0
    }
    if (mode === 'lot') {
      return material.marketLotPrice ?? material.marketUnitPrice ?? material.cost ?? 0
    }
    return material.marketUnitPrice ?? material.cost ?? 0
  }

  const handleMaterialChange = (id: string, materialId: string) => {
    const material = materials.find((item) => item.id === materialId)
    const current = form.items.find((item) => item.id === id)
    const pricingMode = current?.pricingMode ?? 'unit'
    updateItem(id, {
      materialId,
      unitPrice: resolveMaterialPrice(material, pricingMode),
    })
  }

  const handlePricingModeChange = (id: string, mode: PurchaseItemForm['pricingMode']) => {
    const current = form.items.find((item) => item.id === id)
    const material = materials.find((item) => item.id === current?.materialId)
    updateItem(id, {
      pricingMode: mode,
      unitPrice: resolveMaterialPrice(material, mode),
    })
  }

  const getItemTotal = (item: PurchaseItemForm) => {
    if (item.type === 'extra') {
      return item.total
    }
    return item.quantity * item.unitPrice
  }

  const totalAmount = useMemo(
    () => form.items.reduce((acc, item) => acc + getItemTotal(item), 0),
    [form.items],
  )

  const getSupplierName = (id?: string) =>
    suppliers.find((supplier) => supplier.id === id)?.name ?? 'Sem fornecedor'

  const buildPurchaseSummary = (purchase: PurchaseRecord) => {
    if (purchase.items.length === 0) {
      return '-'
    }
    const labels = purchase.items.map((item) => item.description)
    if (labels.length <= 2) {
      return labels.join(' + ')
    }
    return `${labels[0]} +${labels.length - 1}`
  }

  const getPurchaseDate = (purchase: PurchaseRecord) =>
    purchase.purchaseDate ? formatDateShort(purchase.purchaseDate) : formatDateShort(purchase.createdAt)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (form.items.length === 0) {
      setStatus('Adicione pelo menos um item na compra.')
      return
    }

    for (const item of form.items) {
      if (item.type === 'material') {
        if (!item.materialId) {
          setStatus('Selecione o material em todos os itens de compra.')
          return
        }
        if (item.quantity <= 0 || item.unitPrice <= 0) {
          setStatus('Informe quantidade e valor validos para os materiais.')
          return
        }
      } else {
        if (!item.description.trim()) {
          setStatus('Descreva os itens avulsos.')
          return
        }
        if (item.total <= 0) {
          setStatus('Informe o valor total dos itens avulsos.')
          return
        }
      }
    }

    if (totalAmount <= 0) {
      setStatus('O total da compra deve ser maior que zero.')
      return
    }

    const payload = dataService.getAll()
    const createdAt = form.date ? new Date(form.date).toISOString() : new Date().toISOString()
    const supplier = form.supplierId
      ? suppliers.find((item) => item.id === form.supplierId)
      : undefined

    const purchaseItems: PurchaseRecord['items'] = form.items.map((item) => {
      if (item.type === 'material') {
        const material = payload.materiais.find((material) => material.id === item.materialId)
        return {
          id: item.id,
          type: 'material',
          materialId: item.materialId,
          description: material?.name ?? 'Material',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          pricingMode: item.pricingMode,
          total: item.quantity * item.unitPrice,
        }
      }
      return {
        id: item.id,
        type: 'extra',
        description: item.description.trim(),
        total: item.total,
      }
    })

    payload.materiais = payload.materiais.map((material) => {
      const updates = purchaseItems.filter(
        (item) => item.type === 'material' && item.materialId === material.id,
      )
      if (updates.length === 0) {
        return material
      }
      const latest = updates[updates.length - 1]
      if (latest.type !== 'material') {
        return material
      }
      const lotSize = material.lotSize && material.lotSize > 0 ? material.lotSize : 1
      const addedStock = updates.reduce((acc, item) => {
        if (item.type !== 'material') {
          return acc
        }
        if (item.pricingMode === 'lot') {
          return acc + (item.quantity ?? 0) * lotSize
        }
        return acc + (item.quantity ?? 0)
      }, 0)
      const nextStock = (material.stock ?? 0) + addedStock
      if (latest.pricingMode === 'lot') {
        return {
          ...material,
          stock: nextStock,
          marketLotPrice: latest.unitPrice,
        }
      }
      return {
        ...material,
        stock: nextStock,
        marketUnitPrice: latest.unitPrice,
      }
    })

    const labels = purchaseItems.map((item) => {
      if (item.type === 'material') {
        return `${item.description} x${item.quantity ?? 0}`
      }
      return item.description
    })
    const summary = labels.join(' + ')
    const supplierLabel = supplier ? `Fornecedor: ${supplier.name}. ` : ''
    const notes = form.notes.trim()
    const description = notes
      ? `Compra: ${summary}. ${supplierLabel}${notes}`
      : `Compra: ${summary}. ${supplierLabel}`.trim()

    payload.comprasHistorico = [
      {
        id: createId(),
        supplierId: form.supplierId || undefined,
        purchaseDate: form.date || undefined,
        notes: notes || undefined,
        items: purchaseItems,
        total: totalAmount,
        createdAt: new Date().toISOString(),
      },
      ...payload.comprasHistorico,
    ]
    payload.financeiro = [
      ...payload.financeiro,
      {
        id: createId(),
        type: 'saida',
        description,
        amount: totalAmount,
        category: 'Compras',
        createdAt,
        cashboxId: 'caixa_operacional',
      },
    ]

    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Compra registrada',
        description: `${summary} · ${formatCurrency(totalAmount)}`,
      },
    })
    refresh()
    setStatus('Compra registrada no financeiro.')
    setIsModalOpen(false)
  }

  return (
    <Page className="compras">
      <PageHeader
        actions={
          <button className="button button--primary" type="button" onClick={openModal}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              shopping_cart
            </span>
            <span className="page-header__action-label">Registrar compra</span>
          </button>
        }
      />

      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Fornecedores ativos</span>
          <strong className="summary__value">{suppliers.length}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Materiais cadastrados</span>
          <strong className="summary__value">{materials.length}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Saidas do mes</span>
          <strong className="summary__value">{formatCurrency(monthlyExpenses)}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Solicitacoes em aberto</span>
          <strong className="summary__value">0</strong>
        </article>
      </div>

      <div className="grid grid--two">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Ultimas despesas</h2>
              <p className="panel__subtitle">Saidas registradas no financeiro</p>
            </div>
          </div>
          <div className="list">
            {recentExpenses.length === 0 && (
              <div className="list__empty">Nenhuma despesa registrada.</div>
            )}
            {recentExpenses.map((entry) => (
              <div key={entry.id} className="list__item">
                <div>
                  <strong>{entry.description}</strong>
                  <span className="list__meta">{formatDateShort(entry.createdAt)}</span>
                </div>
                <strong>{formatCurrency(entry.amount)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Fornecedores ativos</h2>
              <p className="panel__subtitle">Principais parceiros de compra</p>
            </div>
          </div>
          <div className="list">
            {suppliers.length === 0 && (
              <div className="list__empty">Nenhum fornecedor cadastrado.</div>
            )}
            {suppliers.slice(0, 6).map((supplier) => (
              <div key={supplier.id} className="list__item">
                <span>{supplier.name}</span>
                <strong>{supplier.city ?? '-'}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel panel--full">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Materiais cadastrados</h2>
            <p className="panel__subtitle">Lista de insumos e unidades</p>
          </div>
        </div>
        <div className="list list--compact">
          {materials.length === 0 && (
            <div className="list__empty">Nenhum material cadastrado.</div>
          )}
          {materials.slice(0, 8).map((material) => (
            <div key={material.id} className="list__item">
              <span>{material.name}</span>
              <strong>
                {getMaterialUnitLabel(material.unit, data.tabelas)}
                {material.marketUnitPrice ? ` • ${formatCurrency(material.marketUnitPrice)}` : ''}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel panel--full">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Historico de compras</h2>
            <p className="panel__subtitle">Filtro por fornecedor ou material</p>
          </div>
        </div>
        <div className="filters">
          <div className="form__group">
            <label className="form__label" htmlFor="purchase-filter-supplier">
              Fornecedor
            </label>
            <select
              id="purchase-filter-supplier"
              className="form__input"
              value={filterSupplierId}
              onChange={(event) => setFilterSupplierId(event.target.value)}
            >
              <option value="">Todos</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form__group">
            <label className="form__label" htmlFor="purchase-filter-material">
              Material
            </label>
            <select
              id="purchase-filter-material"
              className="form__input"
              value={filterMaterialId}
              onChange={(event) => setFilterMaterialId(event.target.value)}
            >
              <option value="">Todos</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-card">
          <table className="table">
            <thead className="table__head table__head--mobile-hide">
              <tr>
                <th>Data</th>
                <th>Fornecedor</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Observacoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="table__empty">
                    Nenhuma compra encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
              {filteredPurchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="table__cell--mobile-hide">{getPurchaseDate(purchase)}</td>
                  <td className="table__cell--mobile-hide">
                    {getSupplierName(purchase.supplierId)}
                  </td>
                  <td className="table__cell--truncate">
                    <div className="table__stack">
                      <strong>{buildPurchaseSummary(purchase)}</strong>
                      <span className="table__sub table__sub--mobile">
                        {formatCurrency(purchase.total)}
                      </span>
                    </div>
                  </td>
                  <td className="table__cell--mobile-hide">
                    {formatCurrency(purchase.total)}
                  </td>
                  <td className="table__cell--mobile-hide">{purchase.notes ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title="Registrar compra"
        size="lg"
        actions={
          <button className="button button--primary" type="submit" form={purchaseFormId}>
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              save
            </span>
            <span className="modal__action-label">Registrar compra</span>
          </button>
        }
      >
        <form id={purchaseFormId} className="modal__form" onSubmit={handleSubmit}>
          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="purchase-date">
                Data da compra
              </label>
              <input
                id="purchase-date"
                className="modal__input"
                type="date"
                value={form.date}
                onChange={(event) => updateForm({ date: event.target.value })}
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="purchase-supplier">
                Fornecedor
              </label>
              <select
                id="purchase-supplier"
                className="modal__input"
                value={form.supplierId}
                onChange={(event) => updateForm({ supplierId: event.target.value })}
              >
                <option value="">Selecionar fornecedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal__form-actions">
            <button className="button button--ghost" type="button" onClick={addMaterialItem}>
              Adicionar material
            </button>
            <button className="button button--ghost" type="button" onClick={addExtraItem}>
              Adicionar item livre
            </button>
          </div>

          {form.items.map((item, index) => {
            const material = materials.find((value) => value.id === item.materialId)
            const unitLabel = material?.unit ?? 'unid.'
            const lotLabel = material?.lotSize
              ? `1 lote = ${material.lotSize} ${unitLabel}`
              : 'Lote sem tamanho definido'
            const lineTotal = getItemTotal(item)
            return (
              <div key={item.id} className="modal__section">
                <div className="modal__form-actions">
                  <strong>{item.type === 'material' ? `Material ${index + 1}` : `Item livre ${index + 1}`}</strong>
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={form.items.length === 1}
                  >
                    Remover
                  </button>
                </div>

                {item.type === 'material' ? (
                  <>
                    <div className="modal__group">
                      <label className="modal__label" htmlFor={`purchase-material-${item.id}`}>
                        Material
                      </label>
                      <select
                        id={`purchase-material-${item.id}`}
                        className="modal__input"
                        value={item.materialId}
                        onChange={(event) => handleMaterialChange(item.id, event.target.value)}
                      >
                        <option value="">Selecionar material</option>
                        {materials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="modal__row">
                      <div className="modal__group">
                        <label className="modal__label" htmlFor={`purchase-quantity-${item.id}`}>
                          Quantidade
                        </label> 
                        <input
                          id={`purchase-quantity-${item.id}`}
                          className="modal__input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.id, { quantity: Number(event.target.value) })
                          }
                        />
                      </div>
                      <div className="modal__group">
                        <label className="modal__label" htmlFor={`purchase-mode-${item.id}`}>
                          Base de preco
                        </label>
                        <select
                          id={`purchase-mode-${item.id}`}
                          className="modal__input"
                          value={item.pricingMode}
                          onChange={(event) =>
                            handlePricingModeChange(
                              item.id,
                              event.target.value as PurchaseItemForm['pricingMode'],
                            )
                          }
                        >
                          <option value="unit">Por unidade</option>
                          <option value="lot">Por lote</option>
                        </select>
                        {item.pricingMode === 'lot' && (
                          <p className="modal__help">{lotLabel}</p>
                        )}
                      </div>
                    </div>

                    <div className="modal__row">
                      <div className="modal__group">
                        <label className="modal__label" htmlFor={`purchase-price-${item.id}`}>
                          Valor {item.pricingMode === 'lot' ? 'por lote' : `por ${unitLabel}`}
                        </label>
                        <CurrencyInput
                          id={`purchase-price-${item.id}`}
                          className="modal__input"
                          value={item.unitPrice}
                          onValueChange={(value) =>
                            updateItem(item.id, { unitPrice: value ?? 0 })
                          }
                        />
                      </div>
                      <div className="modal__group">
                        <label className="modal__label">Total do item</label>
                        <div className="summary">
                          <strong>{formatCurrency(lineTotal)}</strong>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="modal__group">
                      <label className="modal__label" htmlFor={`purchase-extra-${item.id}`}>
                        Descricao do item
                      </label>
                      <input
                        id={`purchase-extra-${item.id}`}
                        className="modal__input"
                        type="text"
                        value={item.description}
                        onChange={(event) => updateItem(item.id, { description: event.target.value })}
                        placeholder="Ex: Lanche equipe, etiquetas"
                      />
                    </div>
                    <div className="modal__group">
                      <label className="modal__label" htmlFor={`purchase-extra-total-${item.id}`}>
                        Valor total
                      </label>
                      <CurrencyInput
                        id={`purchase-extra-total-${item.id}`}
                        className="modal__input"
                        value={item.total}
                        onValueChange={(value) =>
                          updateItem(item.id, { total: value ?? 0 })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            )
          })}

          <div className="modal__group">
            <label className="modal__label" htmlFor="purchase-notes">
              Observacoes
            </label>
            <textarea
              id="purchase-notes"
              className="modal__input modal__textarea"
              value={form.notes}
              onChange={(event) => updateForm({ notes: event.target.value })}
              placeholder="Detalhes adicionais da compra"
            />
          </div>

          <div className="summary">
            <span>Total da compra</span>
            <strong>{formatCurrency(totalAmount)}</strong>
          </div>

        </form>
      </Modal>
    </Page>
  )
}

export default Compras
