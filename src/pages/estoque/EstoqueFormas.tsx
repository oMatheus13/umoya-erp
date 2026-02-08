import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import DimensionInput from '../../components/DimensionInput'
import Modal from '../../components/Modal'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { Mold } from '../../types/erp'
import { formatDimensionsMm } from '../../utils/dimensions'
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
  const moldFormId = 'forma-form'

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
    setIsModalOpen(false)
    resetForm()
    setStatus('Forma excluida.')
    setDeleteId(null)
  }

  return (
    <Page className="moldes">
      <PageHeader
        actions={
          <button className="button button--primary" type="button" onClick={openModal}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              view_module
            </span>
            <span className="page-header__action-label">Nova forma</span>
          </button>
        }
      />
      {status && <p className="form__status">{status}</p>}

      <div className="summary summary-card">
        <article className="summary__item">
          <span className="summary__label">Formas cadastradas</span>
          <strong className="summary__value">{summary.total}</strong>
        </article>
        <article className="summary__item">
          <span className="summary__label">Estoque total</span>
          <strong className="summary__value">{summary.stock}</strong>
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

      <div className="moldes__layout">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Formas cadastradas</h2>
              <p>Dimensoes e quantidade disponivel.</p>
            </div>
            <span className="panel__meta">{molds.length} registros</span>
          </div>
          <div className="table-card">
            <table className="table">
              <thead className="table__head table__head--mobile-hide">
                <tr>
                  <th>Forma</th>
                  <th>Codigo</th>
                  <th>Medidas (mm)</th>
                  <th>Estoque</th>
                  <th className="table__actions table__actions--end">Editar</th>
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
                    <td className="table__cell--truncate">
                      <div className="table__stack">
                        <strong>{mold.name}</strong>
                        <span className="table__sub table__sub--mobile">
                          Estoque: {mold.stock ?? 0}
                        </span>
                      </div>
                    </td>
                    <td className="table__cell--mobile-hide">{mold.code ?? '-'}</td>
                    <td className="table__cell--mobile-hide">
                      {formatDimensionsMm([mold.length, mold.width, mold.height])}
                    </td>
                    <td className="table__cell--mobile-hide">{mold.stock ?? 0}</td>
                    <td className="table__actions table__actions--end">
                      <ActionMenu
                        items={[
                          { label: 'Editar', onClick: () => handleEdit(mold) },
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
            <button className="button button--primary" type="submit" form={moldFormId}>
              <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                save
              </span>
              <span className="modal__action-label">
                {editingId ? 'Atualizar' : 'Salvar forma'}
              </span>
            </button>
          </>
        }
      >
        <form id={moldFormId} className="modal__form" onSubmit={handleSubmit}>
          <div className="modal__group">
            <label className="modal__label" htmlFor="mold-name">
              Nome
            </label>
            <input
              id="mold-name"
              className="modal__input"
              type="text"
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              placeholder="Ex: Forma viga 5m"
            />
          </div>

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="mold-code">
                Codigo
              </label>
              <input
                id="mold-code"
                className="modal__input"
                type="text"
                value={form.code}
                onChange={(event) => updateForm({ code: event.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="mold-stock">
                Quantidade
              </label>
              <input
                id="mold-stock"
                className="modal__input"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(event) => updateForm({ stock: Number(event.target.value) })}
              />
            </div>
          </div>

          <div className="modal__row">
            <div className="modal__group">
              <label className="modal__label" htmlFor="mold-length">
                Comprimento
              </label>
              <DimensionInput
                id="mold-length"
                className="modal__input"
                min="0"
                value={form.length}
                step={0.01}
                onValueChange={(value) => updateForm({ length: value })}
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="mold-width">
                Largura
              </label>
              <DimensionInput
                id="mold-width"
                className="modal__input"
                min="0"
                value={form.width}
                step={0.01}
                onValueChange={(value) => updateForm({ width: value })}
              />
            </div>
            <div className="modal__group">
              <label className="modal__label" htmlFor="mold-height">
                Altura
              </label>
              <DimensionInput
                id="mold-height"
                className="modal__input"
                min="0"
                value={form.height}
                step={0.01}
                onValueChange={(value) => updateForm({ height: value })}
              />
            </div>
          </div>

          <div className="modal__group">
            <label className="modal__label" htmlFor="mold-notes">
              Observacoes
            </label>
            <textarea
              id="mold-notes"
              className="modal__input modal__textarea"
              value={form.notes}
              onChange={(event) => updateForm({ notes: event.target.value })}
              placeholder="Detalhes sobre manutencao ou uso"
            />
          </div>

          {status && <p className="modal__status">{status}</p>}
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
