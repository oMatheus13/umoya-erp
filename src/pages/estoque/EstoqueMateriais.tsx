import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import Modal from '../../components/Modal'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { Material } from '../../types/erp'
import { formatCurrency } from '../../utils/format'
import { getMaterialUnitLabel } from '../../utils/units'

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
      {status && <p className="form__status">{status}</p>}

      <div className="estoque-materiais__summary summary-card">
        <article className="estoque-materiais__stat">
          <span className="estoque-materiais__stat-label">Materiais</span>
          <strong className="estoque-materiais__stat-value">{summary.total}</strong>
        </article>
        <article className="estoque-materiais__stat">
          <span className="estoque-materiais__stat-label">Estoque total</span>
          <strong className="estoque-materiais__stat-value">{summary.stock}</strong>
        </article>
        <article className="estoque-materiais__stat">
          <span className="estoque-materiais__stat-label">Baixo</span>
          <strong className="estoque-materiais__stat-value">{summary.low}</strong>
        </article>
        <article className="estoque-materiais__stat">
          <span className="estoque-materiais__stat-label">Sem estoque</span>
          <strong className="estoque-materiais__stat-value">{summary.out}</strong>
        </article>
      </div>

      <div className="estoque-materiais__layout">
        <section className="estoque-materiais__panel">
          <div className="estoque-materiais__panel-header">
            <div>
              <h2>Saldo de materia-prima</h2>
              <p>Compras atualizam o estoque automaticamente.</p>
            </div>
            <span className="estoque-materiais__panel-meta">{materials.length} registros</span>
          </div>
          <div className="table-card estoque-materiais__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Unidade</th>
                  <th>Estoque</th>
                  <th>Minimo</th>
                  <th>Mercado/unidade</th>
                  <th>Mercado/lote</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {materials.length === 0 && (
                  <tr>
                    <td colSpan={8} className="table__empty">
                      Nenhum material cadastrado ainda.
                    </td>
                  </tr>
                )}
                {materials.map((material) => {
                  const badge = getStatusBadge(material)
                  return (
                    <tr key={material.id}>
                      <td>{material.name}</td>
                      <td>{getMaterialUnitLabel(material.unit, data.tabelas)}</td>
                      <td>
                        {material.stock ?? 0}
                        {material.unit
                          ? ` ${getMaterialUnitLabel(material.unit, data.tabelas)}`
                          : ''}
                      </td>
                      <td>{material.minStock ?? '-'}</td>
                      <td>{formatValue(material.marketUnitPrice ?? material.cost)}</td>
                      <td>{formatValue(material.marketLotPrice)}</td>
                      <td>
                        <span className={`badge ${badge.className}`}>{badge.label}</span>
                      </td>
                      <td className="table__actions">
                        <ActionMenu
                          items={[{ label: 'Ajustar', onClick: () => openAdjust(material) }]}
                        />
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
        <form id={adjustFormId} className="form" onSubmit={handleAdjust}>
          <div className="form__group">
            <label className="form__label" htmlFor="adjust-material">
              Material
            </label>
            <select
              id="adjust-material"
              className="form__input"
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
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="adjust-type">
                Tipo
              </label>
              <select
                id="adjust-type"
                className="form__input"
                value={form.type}
                onChange={(event) =>
                  updateForm({ type: event.target.value as AdjustForm['type'] })
                }
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saida</option>
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="adjust-qty">
                Quantidade
              </label>
              <input
                id="adjust-qty"
                className="form__input"
                type="number"
                min="0"
                step="0.01"
                value={form.quantity}
                onChange={(event) => updateForm({ quantity: Number(event.target.value) })}
              />
            </div>
          </div>
          <div className="form__group">
            <label className="form__label" htmlFor="adjust-note">
              Observacao (opcional)
            </label>
            <input
              id="adjust-note"
              className="form__input"
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
