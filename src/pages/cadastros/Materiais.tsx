import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import CurrencyInput from '../../components/CurrencyInput'
import Modal from '../../components/Modal'
import QuickNotice from '../../components/QuickNotice'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { Material, MaterialKind, MaterialUnit } from '../../types/erp'
import { formatCurrency } from '../../utils/format'
import { createId } from '../../utils/ids'
import { getMaterialUnitLabel, getMaterialUnitOptions } from '../../utils/units'
import { MATERIAL_KINDS, getMaterialKindLabel } from '../../utils/materials'

type MaterialForm = {
  name: string
  unit: MaterialUnit | ''
  kind: MaterialKind | ''
  metersPerUnit: number
  cost: number
  marketUnitPrice: number
  marketLotPrice: number
  lotSize: number
  stock: number
  minStock: number
  notes: string
  active: boolean
}

const Materiais = () => {
  const { data, refresh } = useERPData()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<MaterialForm>({
    name: '',
    unit: '',
    kind: '',
    metersPerUnit: 0,
    cost: 0,
    marketUnitPrice: 0,
    marketLotPrice: 0,
    lotSize: 0,
    stock: 0,
    minStock: 0,
    notes: '',
    active: true,
  })
  const materialFormId = 'material-form'

  const updateForm = (patch: Partial<MaterialForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const resetForm = () => {
    setForm({
      name: '',
      unit: '',
      kind: '',
      metersPerUnit: 0,
      cost: 0,
      marketUnitPrice: 0,
      marketLotPrice: 0,
      lotSize: 0,
      stock: 0,
      minStock: 0,
      notes: '',
      active: true,
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

  const handleEdit = (material: Material) => {
    setEditingId(material.id)
    setForm({
      name: material.name,
      unit: material.unit ?? '',
      kind: material.kind ?? '',
      metersPerUnit: material.metersPerUnit ?? 0,
      cost: material.cost ?? 0,
      marketUnitPrice: material.marketUnitPrice ?? 0,
      marketLotPrice: material.marketLotPrice ?? 0,
      lotSize: material.lotSize ?? 0,
      stock: material.stock ?? 0,
      minStock: material.minStock ?? 0,
      notes: material.notes ?? '',
      active: material.active ?? true,
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const toOptionalNumber = (value: number) => (value > 0 ? value : undefined)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setStatus('Informe o nome do material.')
      return
    }
    if (!form.unit) {
      setStatus('Selecione a unidade de medida.')
      return
    }
    if (!form.kind) {
      setStatus('Selecione o tipo de material.')
      return
    }
    if (form.kind === 'trelica' && form.metersPerUnit <= 0) {
      setStatus('Informe quantos metros existem por unidade de trelica.')
      return
    }
    if (form.cost < 0 || form.marketUnitPrice < 0 || form.marketLotPrice < 0) {
      setStatus('Os valores nao podem ser negativos.')
      return
    }
    if (form.lotSize < 0) {
      setStatus('O tamanho do lote nao pode ser negativo.')
      return
    }
    if (form.stock < 0 || form.minStock < 0) {
      setStatus('Os estoques nao podem ser negativos.')
      return
    }

    const payload = dataService.getAll()
    const next: Material = {
      id: editingId ?? createId(),
      name: form.name.trim(),
      unit: form.unit,
      kind: form.kind,
      metersPerUnit: form.kind === 'trelica' ? form.metersPerUnit : undefined,
      cost: toOptionalNumber(form.cost),
      marketUnitPrice: toOptionalNumber(form.marketUnitPrice),
      marketLotPrice: toOptionalNumber(form.marketLotPrice),
      lotSize: toOptionalNumber(form.lotSize),
      stock: form.stock,
      minStock: toOptionalNumber(form.minStock),
      notes: form.notes.trim() || undefined,
      active: form.active,
    }

    if (editingId) {
      payload.materiais = payload.materiais.map((item) =>
        item.id === editingId ? next : item,
      )
    } else {
      payload.materiais = [...payload.materiais, next]
    }

    dataService.replaceAll(payload)
    refresh()
    setStatus(editingId ? 'Material atualizado.' : 'Material cadastrado.')
    setIsModalOpen(false)
    resetForm()
  }

  const materials = useMemo(
    () => [...data.materiais].sort((a, b) => a.name.localeCompare(b.name)),
    [data.materiais],
  )

  const summary = useMemo(() => {
    return materials.reduce(
      (acc, material) => {
        acc.total += 1
        if (material.active !== false) {
          acc.active += 1
        }
        if (material.marketUnitPrice || material.cost) {
          acc.unitPricing += 1
        }
        if (material.marketLotPrice) {
          acc.lotPricing += 1
        }
        return acc
      },
      { total: 0, active: 0, unitPricing: 0, lotPricing: 0 },
    )
  }, [materials])

  const materialToDelete = deleteId
    ? data.materiais.find((material) => material.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.materiais = payload.materiais.filter((material) => material.id !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setIsModalOpen(false)
    resetForm()
    setStatus('Material excluido.')
    setDeleteId(null)
  }

  const formatValue = (value?: number) => (value ? formatCurrency(value) : '-')
  const selectedUnitLabel = form.unit
    ? getMaterialUnitLabel(form.unit, data.tabelas)
    : 'unidade'

  return (
    <Page className="materiais">
      <PageHeader
        actions={
          <button className="button button--primary" type="button" onClick={openNewModal}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              science
            </span>
            <span className="page-header__action-label">Novo material</span>
          </button>
        }
      />
      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Materiais cadastrados</span>
          <strong className="summary__value">{summary.total}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Com preco por unidade</span>
          <strong className="summary__value">{summary.unitPricing}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Com preco por lote</span>
          <strong className="summary__value">{summary.lotPricing}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Materiais ativos</span>
          <strong className="summary__value">{summary.active}</strong>
        </article>
      </div>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar material' : 'Novo material'}
        size="lg"
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
            <button className="button button--primary" type="submit" form={materialFormId}>
              <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                save
              </span>
              <span className="modal__action-label">
                {editingId ? 'Atualizar' : 'Salvar material'}
              </span>
            </button>
          </>
        }
      >
        <form id={materialFormId} className="modal__form" onSubmit={handleSubmit}>
          <div className="modal__group">
            <label className="modal__label" htmlFor="material-name">
              Nome
            </label>
            <input
              id="material-name"
              className="modal__input"
              type="text"
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              placeholder="Ex: Cimento CP II"
            />
          </div>

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="material-unit">
                Unidade de medida
              </label>
              <select
                id="material-unit"
                className="modal__input"
                value={form.unit}
                onChange={(event) =>
                  updateForm({ unit: event.target.value as MaterialForm['unit'] })
                }
              >
                <option value="">Selecione</option>
                {getMaterialUnitOptions(data.tabelas).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="material-kind">
                Tipo do material
              </label>
              <select
                id="material-kind"
                className="modal__input"
                value={form.kind}
                onChange={(event) =>
                  updateForm({ kind: event.target.value as MaterialForm['kind'] })
                }
              >
                <option value="">Selecione</option>
                {MATERIAL_KINDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="material-cost">
                Custo interno
              </label>
              <CurrencyInput
                id="material-cost"
                className="modal__input"
                value={form.cost}
                onValueChange={(value) => updateForm({ cost: value ?? 0 })}
                placeholder="0.00"
              />
            </div>
          </div>

          {form.kind === 'trelica' && (
            <div className="modal__group">
              <label className="modal__label" htmlFor="material-meters-unit">
                Metros por unidade
              </label>
              <input
                id="material-meters-unit"
                className="modal__input"
                type="number"
                min="0"
                step="0.01"
                value={form.metersPerUnit}
                onChange={(event) =>
                  updateForm({ metersPerUnit: Number(event.target.value) })
                }
                placeholder="Ex: 12"
              />
              <p className="modal__help">
                Usado para converter metros em unidades de trelica.
              </p>
            </div>
          )}

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="material-market-unit">
                Valor de mercado ({selectedUnitLabel})
              </label>
              <CurrencyInput
                id="material-market-unit"
                className="modal__input"
                value={form.marketUnitPrice}
                onValueChange={(value) =>
                  updateForm({ marketUnitPrice: value ?? 0 })
                }
                placeholder="0.00"
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="material-market-lot">
                Valor de mercado (lote)
              </label>
              <CurrencyInput
                id="material-market-lot"
                className="modal__input"
                value={form.marketLotPrice}
                onValueChange={(value) =>
                  updateForm({ marketLotPrice: value ?? 0 })
                }
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="material-lot-size">
              Tamanho do lote ({selectedUnitLabel})
            </label>
            <input
              id="material-lot-size"
              className="modal__input"
              type="number"
              min="0"
              step="0.01"
              value={form.lotSize}
              onChange={(event) => updateForm({ lotSize: Number(event.target.value) })}
              placeholder="Quantidade por lote"
            />
            <p className="modal__help">
              Use quando o material e comprado em lotes (ex: 40 sacos).
            </p>
          </div>

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="material-stock">
                Estoque inicial
              </label>
              <input
                id="material-stock"
                className="modal__input"
                type="number"
                min="0"
                step="0.01"
                value={form.stock}
                onChange={(event) => updateForm({ stock: Number(event.target.value) })}
                placeholder="0"
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="material-min-stock">
                Estoque minimo
              </label>
              <input
                id="material-min-stock"
                className="modal__input"
                type="number"
                min="0"
                step="0.01"
                value={form.minStock}
                onChange={(event) => updateForm({ minStock: Number(event.target.value) })}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="material-notes">
              Observacoes
            </label>
            <textarea
              id="material-notes"
              className="modal__input modal__textarea"
              value={form.notes}
              onChange={(event) => updateForm({ notes: event.target.value })}
              placeholder="Qualidade, fornecedor preferencial, etc."
            />
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
            <span className="toggle__label">Material ativo</span>
          </label>

        </form>
      </Modal>

      <div className="materiais__layout">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Materia-prima cadastrada</h2>
              <p>Referencia para compras e estoque minimo.</p>
            </div>
            <span className="panel__meta">{materials.length} registros</span>
          </div>
          <div className="table-card">
            <table className="table">
              <thead className="table__head table__head--mobile-hide">
                <tr>
                  <th>Material</th>
                  <th>Tipo</th>
                  <th>Unidade</th>
                  <th>Minimo</th>
                  <th>Mercado/unidade</th>
                  <th>Mercado/lote</th>
                  <th>Lote</th>
                  <th>Metros/unid</th>
                  <th className="table__actions table__actions--end">Status / Editar</th>
                </tr>
              </thead>
              <tbody>
                {materials.length === 0 && (
                  <tr>
                    <td colSpan={9} className="table__empty">
                      Nenhum material cadastrado ainda.
                    </td>
                  </tr>
                )}
                {materials.map((material) => (
                  <tr key={material.id}>
                    <td className="table__cell--truncate">
                      <div className="table__stack">
                        <strong>{material.name}</strong>
                        <span className="table__sub table__sub--mobile">
                          {formatValue(material.marketUnitPrice ?? material.cost)}
                        </span>
                      </div>
                    </td>
                    <td className="table__cell--mobile-hide">
                      {getMaterialKindLabel(material.kind)}
                    </td>
                    <td className="table__cell--mobile-hide">
                      {getMaterialUnitLabel(material.unit, data.tabelas)}
                    </td>
                    <td className="table__cell--mobile-hide">{material.minStock ?? '-'}</td>
                    <td className="table__cell--mobile-hide">
                      {formatValue(material.marketUnitPrice ?? material.cost)}
                    </td>
                    <td className="table__cell--mobile-hide">
                      {formatValue(material.marketLotPrice)}
                    </td>
                    <td className="table__cell--mobile-hide">{material.lotSize ?? '-'}</td>
                    <td className="table__cell--mobile-hide">
                      {material.kind === 'trelica' && material.metersPerUnit
                        ? material.metersPerUnit
                        : '-'}
                    </td>
                    <td className="table__actions table__actions--end">
                      <div className="table__end">
                        <div className="table__status">
                          <span
                            className={`badge ${material.active !== false ? 'badge--aprovado' : 'badge--rascunho'}`}
                          >
                            {material.active !== false ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <ActionMenu
                          items={[
                            { label: 'Editar', onClick: () => handleEdit(material) },
                          ]}
                        />
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
        title="Excluir material?"
        description={
          materialToDelete
            ? `O material ${materialToDelete.name} sera removido.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </Page>
  )
}

export default Materiais
