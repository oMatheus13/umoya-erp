import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import Modal from '@shared/components/Modal'
import { Page, PageHeader } from '@ui/components'
import QuickNotice from '@shared/components/QuickNotice'
import { dataService } from '@shared/services/dataService'
import { useERPData } from '@shared/store/appStore'
import type { Material } from '@shared/types/erp'
import { formatCurrency } from '@shared/utils/format'
import { getMaterialUnitLabel } from '@shared/utils/units'

type AdjustForm = {
  materialId: string
  type: 'entrada' | 'saida'
  quantity: number
  note: string
}

const EstoqueMateriais = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [form, setForm] = useState<AdjustForm>({
    materialId: '',
    type: 'entrada',
    quantity: 0,
    note: '',
  })
  const adjustFormId = 'ajuste-material-form'

  const materials = useMemo(
    () => [...data.materiais].sort((a, b) => a.name.localeCompare(b.name)),
    [data.materiais],
  )

  const summary = useMemo(() => {
    return materials.reduce(
      (acc, material) => {
        const stock = material.stock ?? 0
        acc.total += 1
        acc.stock += stock
        if (stock <= 0) {
          acc.out += 1
        } else if (material.minStock !== undefined && stock <= material.minStock) {
          acc.low += 1
        }
        return acc
      },
      { total: 0, stock: 0, low: 0, out: 0 },
    )
  }, [materials])

  const updateForm = (patch: Partial<AdjustForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const openAdjust = (material: Material) => {
    setStatus(null)
    setForm({
      materialId: material.id,
      type: 'entrada',
      quantity: 0,
      note: '',
    })
    setIsAdjustOpen(true)
  }

  const closeAdjust = () => {
    setIsAdjustOpen(false)
  }

  const handleAdjust = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.materialId) {
      setStatus('Selecione um material para ajustar.')
      return
    }
    if (form.quantity <= 0) {
      setStatus('Informe uma quantidade valida.')
      return
    }
    const payload = dataService.getAll()
    const materialIndex = payload.materiais.findIndex(
      (material) => material.id === form.materialId,
    )
    if (materialIndex < 0) {
      setStatus('Material nao encontrado.')
      return
    }
    const current = payload.materiais[materialIndex]
    const currentStock = current.stock ?? 0
    const delta = form.type === 'entrada' ? form.quantity : -form.quantity
    if (form.type === 'saida' && currentStock + delta < 0) {
      setStatus('Estoque insuficiente para essa saida.')
      return
    }
    payload.materiais[materialIndex] = {
      ...current,
      stock: currentStock + delta,
      notes: form.note.trim() ? form.note.trim() : current.notes,
    }
    dataService.replaceAll(payload)
    refresh()
    setStatus('Estoque atualizado.')
    setIsAdjustOpen(false)
  }

  const formatQuantity = (value?: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return '-'
    }
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatValue = (value?: number) => (value ? formatCurrency(value) : '-')

  const getStatusBadge = (material: Material) => {
    const stock = material.stock ?? 0
    if (stock <= 0) {
      return { label: 'Sem estoque', className: 'badge--recusado' }
    }
    if (material.minStock !== undefined && stock <= material.minStock) {
      return { label: 'Baixo', className: 'badge--pendente' }
    }
    return { label: 'Ok', className: 'badge--aprovado' }
  }

  return (
    <Page className="estoque-materiais">
      <PageHeader />
      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Materiais</span>
          <strong className="summary__value">{summary.total}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Estoque total</span>
          <strong className="summary__value">{formatQuantity(summary.stock)}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Baixo</span>
          <strong className="summary__value">{summary.low}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Sem estoque</span>
          <strong className="summary__value">{summary.out}</strong>
        </article>
      </div>

      <div className="estoque-materiais__layout">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Saldo de materia-prima</h2>
              <p>Compras atualizam o estoque automaticamente.</p>
            </div>
            <span className="panel__meta">{materials.length} registros</span>
          </div>
          <div className="table-card">
            <table className="table">
              <thead className="table__head table__head--mobile-hide">
                <tr>
                  <th>Material</th>
                  <th>Unidade</th>
                  <th>Estoque</th>
                  <th>Minimo</th>
                  <th>Mercado/unidade</th>
                  <th>Mercado/lote</th>
                  <th className="table__actions table__actions--end">Status / Editar</th>
                </tr>
              </thead>
              <tbody>
                {materials.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table__empty">
                      Nenhum material cadastrado ainda.
                    </td>
                  </tr>
                )}
                {materials.map((material) => {
                  const badge = getStatusBadge(material)
                  return (
                    <tr key={material.id}>
                      <td className="table__cell--truncate">
                        <div className="table__stack">
                          <strong>{material.name}</strong>
                          <span className="table__sub table__sub--mobile">
                            Estoque: {formatQuantity(material.stock ?? 0)}
                            {material.unit
                              ? ` ${getMaterialUnitLabel(material.unit, data.tabelas)}`
                              : ''}
                          </span>
                        </div>
                      </td>
                      <td className="table__cell--mobile-hide">
                        {getMaterialUnitLabel(material.unit, data.tabelas)}
                      </td>
                      <td className="table__cell--mobile-hide">
                        {formatQuantity(material.stock ?? 0)}
                        {material.unit
                          ? ` ${getMaterialUnitLabel(material.unit, data.tabelas)}`
                          : ''}
                      </td>
                      <td className="table__cell--mobile-hide">
                        {formatQuantity(material.minStock)}
                      </td>
                      <td className="table__cell--mobile-hide">
                        {formatValue(material.marketUnitPrice ?? material.cost)}
                      </td>
                      <td className="table__cell--mobile-hide">
                        {formatValue(material.marketLotPrice)}
                      </td>
                      <td className="table__actions table__actions--end">
                        <div className="table__end">
                          <div className="table__status">
                            <span className={`badge ${badge.className}`}>{badge.label}</span>
                          </div>
                          <ActionMenu
                            items={[{ label: 'Ajustar', onClick: () => openAdjust(material) }]}
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
        open={isAdjustOpen}
        onClose={closeAdjust}
        title="Ajustar estoque"
        size="sm"
        actions={
          <button className="button button--primary" type="submit" form={adjustFormId}>
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              save
            </span>
            <span className="modal__action-label">Salvar ajuste</span>
          </button>
        }
      >
        <form id={adjustFormId} className="modal__form" onSubmit={handleAdjust}>
          <div className="modal__group">
            <label className="modal__label" htmlFor="adjust-material">
              Material
            </label>
            <select
              id="adjust-material"
              className="modal__input"
              value={form.materialId}
              onChange={(event) => updateForm({ materialId: event.target.value })}
            >
              <option value="">Selecione</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </select>
          </div>
          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="adjust-type">
                Tipo
              </label>
              <select
                id="adjust-type"
                className="modal__input"
                value={form.type}
                onChange={(event) =>
                  updateForm({ type: event.target.value as AdjustForm['type'] })
                }
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saida</option>
              </select>
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="adjust-qty">
                Quantidade
              </label>
              <input
                id="adjust-qty"
                className="modal__input"
                type="number"
                min="0"
                step="0.01"
                value={form.quantity}
                onChange={(event) => updateForm({ quantity: Number(event.target.value) })}
              />
            </div>
          </div>
          <div className="modal__group">
            <label className="modal__label" htmlFor="adjust-note">
              Observacao (opcional)
            </label>
            <input
              id="adjust-note"
              className="modal__input"
              type="text"
              value={form.note}
              onChange={(event) => updateForm({ note: event.target.value })}
              placeholder="Ex: acerto de inventario"
            />
          </div>
        </form>
      </Modal>
    </Page>
  )
}

export default EstoqueMateriais
