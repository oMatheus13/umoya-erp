import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '../../components/Modal'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { Mold } from '../../types/erp'
import { createId } from '../../utils/ids'

type MoldForm = {
  name: string
  code: string
  length: number
  width: number
  height: number
  stock: number
  notes: string
}

const EstoqueFormas = () => {
  const { data, refresh } = useERPData()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<MoldForm>({
    name: '',
    code: '',
    length: 0,
    width: 0,
    height: 0,
    stock: 0,
    notes: '',
  })

  const molds = useMemo(
    () => [...data.moldes].sort((a, b) => a.name.localeCompare(b.name)),
    [data.moldes],
  )

  const summary = useMemo(() => {
    return molds.reduce(
      (acc, mold) => {
        const stock = mold.stock ?? 0
        acc.total += 1
        acc.stock += stock
        if (stock <= 0) {
          acc.out += 1
        } else if (stock <= 1) {
          acc.low += 1
        }
        return acc
      },
      { total: 0, stock: 0, low: 0, out: 0 },
    )
  }, [molds])

  const updateForm = (patch: Partial<MoldForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const resetForm = () => {
    setForm({
      name: '',
      code: '',
      length: 0,
      width: 0,
      height: 0,
      stock: 0,
      notes: '',
    })
    setEditingId(null)
  }

  const openModal = () => {
    setStatus(null)
    resetForm()
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setStatus(null)
    resetForm()
  }

  const handleEdit = (mold: Mold) => {
    setEditingId(mold.id)
    setForm({
      name: mold.name,
      code: mold.code ?? '',
      length: mold.length ?? 0,
      width: mold.width ?? 0,
      height: mold.height ?? 0,
      stock: mold.stock ?? 0,
      notes: mold.notes ?? '',
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setStatus('Informe o nome da forma.')
      return
    }
    if (form.stock < 0) {
      setStatus('Estoque nao pode ser negativo.')
      return
    }

    const payload = dataService.getAll()
    const next: Mold = {
      id: editingId ?? createId(),
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      length: form.length || undefined,
      width: form.width || undefined,
      height: form.height || undefined,
      stock: form.stock,
      notes: form.notes.trim() || undefined,
    }

    if (editingId) {
      payload.moldes = payload.moldes.map((item) =>
        item.id === editingId ? next : item,
      )
    } else {
      payload.moldes = [...payload.moldes, next]
    }

    dataService.replaceAll(payload)
    refresh()
    setStatus(editingId ? 'Forma atualizada.' : 'Forma cadastrada.')
    setIsModalOpen(false)
    resetForm()
  }

  const moldToDelete = deleteId
    ? data.moldes.find((mold) => mold.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.moldes = payload.moldes.filter((mold) => mold.id !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Forma excluida.')
    setDeleteId(null)
  }

  const formatDimensions = (mold: Mold) => {
    const values = [mold.length, mold.width, mold.height].map((value) =>
      value && value > 0 ? value : 0,
    )
    if (values.every((value) => value === 0)) {
      return '-'
    }
    return `${values[0] || 0} x ${values[1] || 0} x ${values[2] || 0}`
  }

  return (
    <Page className="moldes">
      <PageHeader
        title="Formas e moldes"
        actions={
          <button className="button button--primary" type="button" onClick={openModal}>
            Nova forma
          </button>
        }
      />
      {status && <p className="form__status">{status}</p>}

      <div className="moldes__summary summary-card">
        <article className="moldes__stat">
          <span className="moldes__stat-label">Formas cadastradas</span>
          <strong className="moldes__stat-value">{summary.total}</strong>
        </article>
        <article className="moldes__stat">
          <span className="moldes__stat-label">Estoque total</span>
          <strong className="moldes__stat-value">{summary.stock}</strong>
        </article>
        <article className="moldes__stat">
          <span className="moldes__stat-label">Baixo</span>
          <strong className="moldes__stat-value">{summary.low}</strong>
        </article>
        <article className="moldes__stat">
          <span className="moldes__stat-label">Sem estoque</span>
          <strong className="moldes__stat-value">{summary.out}</strong>
        </article>
      </div>

      <div className="moldes__layout">
        <section className="moldes__panel">
          <div className="moldes__panel-header">
            <div>
              <h2>Formas cadastradas</h2>
              <p>Dimensoes e quantidade disponivel.</p>
            </div>
            <span className="moldes__panel-meta">{molds.length} registros</span>
          </div>
          <div className="table-card moldes__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Forma</th>
                  <th>Codigo</th>
                  <th>Medidas (C x L x A)</th>
                  <th>Estoque</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {molds.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table__empty">
                      Nenhuma forma cadastrada ainda.
                    </td>
                  </tr>
                )}
                {molds.map((mold) => (
                  <tr key={mold.id}>
                    <td>{mold.name}</td>
                    <td>{mold.code ?? '-'}</td>
                    <td>{formatDimensions(mold)}</td>
                    <td>{mold.stock ?? 0}</td>
                    <td className="table__actions">
                      <ActionMenu
                        items={[
                          { label: 'Editar', onClick: () => handleEdit(mold) },
                          {
                            label: 'Excluir',
                            onClick: () => setDeleteId(mold.id),
                            variant: 'danger',
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar forma' : 'Nova forma'}
        size="lg"
      >
        <form className="form" onSubmit={handleSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="mold-name">
              Nome
            </label>
            <input
              id="mold-name"
              className="form__input"
              type="text"
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              placeholder="Ex: Forma viga 5m"
            />
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="mold-code">
                Codigo
              </label>
              <input
                id="mold-code"
                className="form__input"
                type="text"
                value={form.code}
                onChange={(event) => updateForm({ code: event.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="mold-stock">
                Quantidade
              </label>
              <input
                id="mold-stock"
                className="form__input"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(event) => updateForm({ stock: Number(event.target.value) })}
              />
            </div>
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="mold-length">
                Comprimento
              </label>
              <input
                id="mold-length"
                className="form__input"
                type="number"
                min="0"
                step="0.01"
                value={form.length}
                onChange={(event) => updateForm({ length: Number(event.target.value) })}
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="mold-width">
                Largura
              </label>
              <input
                id="mold-width"
                className="form__input"
                type="number"
                min="0"
                step="0.01"
                value={form.width}
                onChange={(event) => updateForm({ width: Number(event.target.value) })}
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="mold-height">
                Altura
              </label>
              <input
                id="mold-height"
                className="form__input"
                type="number"
                min="0"
                step="0.01"
                value={form.height}
                onChange={(event) => updateForm({ height: Number(event.target.value) })}
              />
            </div>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="mold-notes">
              Observacoes
            </label>
            <textarea
              id="mold-notes"
              className="form__input form__textarea"
              value={form.notes}
              onChange={(event) => updateForm({ notes: event.target.value })}
              placeholder="Detalhes sobre manutencao ou uso"
            />
          </div>

          <div className="form__actions">
            <button className="button button--primary" type="submit">
              {editingId ? 'Atualizar' : 'Salvar forma'}
            </button>
            {editingId && (
              <button className="button button--ghost" type="button" onClick={closeModal}>
                Cancelar
              </button>
            )}
          </div>
          {status && <p className="form__status">{status}</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir forma?"
        description={
          moldToDelete
            ? `A forma ${moldToDelete.name} sera removida.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </Page>
  )
}

export default EstoqueFormas
