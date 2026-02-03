import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../components/ActionMenu'
import Modal from '../components/Modal'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'
import type { PaymentTableEntry, TableEntry, UnitTableEntry } from '../types/erp'
import { createId } from '../utils/ids'

type TableKind = 'units' | 'categories' | 'paymentMethods'

type TableForm = {
  label: string
  symbol: string
  cashboxId: string
  description: string
  active: boolean
}

const tableLabels: Record<TableKind, string> = {
  units: 'Unidades',
  categories: 'Categorias',
  paymentMethods: 'Formas de pagamento',
}

const tableSingular: Record<TableKind, string> = {
  units: 'Unidade',
  categories: 'Categoria',
  paymentMethods: 'Forma de pagamento',
}

const Tabelas = () => {
  const { data, refresh } = useERPData()
  const [activeTable, setActiveTable] = useState<TableKind>('units')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<TableForm>({
    label: '',
    symbol: '',
    cashboxId: '',
    description: '',
    active: true,
  })

  const tables = data.tabelas
  const cashboxes = useMemo(
    () => [...data.caixas].sort((a, b) => a.name.localeCompare(b.name)),
    [data.caixas],
  )

  const resetForm = () => {
    setForm({
      label: '',
      symbol: '',
      cashboxId: cashboxes[0]?.id ?? '',
      description: '',
      active: true,
    })
    setEditingId(null)
  }

  const openModal = (kind: TableKind, entry?: TableEntry) => {
    setActiveTable(kind)
    if (entry) {
      setEditingId(entry.id)
      setForm({
        label: entry.label,
        symbol: 'symbol' in entry ? entry.symbol ?? '' : '',
        cashboxId: 'cashboxId' in entry ? entry.cashboxId ?? '' : '',
        description: entry.description ?? '',
        active: entry.active ?? true,
      })
    } else {
      resetForm()
      setActiveTable(kind)
    }
    setStatus(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setStatus(null)
    resetForm()
  }

  const updateForm = (patch: Partial<TableForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const updateTable = (
    kind: TableKind,
    items: TableEntry[],
    audit?: { title: string; description?: string },
  ) => {
    const payload = dataService.getAll()
    payload.tabelas = { ...payload.tabelas, [kind]: items }
    dataService.replaceAll(payload, {
      auditEvent: audit
        ? {
            category: 'alteracao',
            title: audit.title,
            description: audit.description,
          }
        : undefined,
    })
    refresh()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.label.trim()) {
      setStatus('Informe um nome para o item.')
      return
    }
    const trimmedLabel = form.label.trim()
    const items = [...tables[activeTable]]
    const baseEntry: TableEntry = {
      id: editingId ?? createId(),
      label: trimmedLabel,
      active: form.active,
      description: form.description.trim() || undefined,
    }

    let nextItems: TableEntry[] = []
    if (activeTable === 'units') {
      const unitEntry: UnitTableEntry = {
        ...baseEntry,
        symbol: form.symbol.trim() || undefined,
      }
      nextItems = editingId
        ? items.map((item) => (item.id === editingId ? unitEntry : item))
        : [...items, unitEntry]
    } else if (activeTable === 'paymentMethods') {
      const paymentEntry: PaymentTableEntry = {
        ...baseEntry,
        cashboxId: form.cashboxId || undefined,
      }
      nextItems = editingId
        ? items.map((item) => (item.id === editingId ? paymentEntry : item))
        : [...items, paymentEntry]
    } else {
      nextItems = editingId
        ? items.map((item) => (item.id === editingId ? baseEntry : item))
        : [...items, baseEntry]
    }

    updateTable(activeTable, nextItems, {
      title: editingId
        ? `${tableSingular[activeTable]} atualizada`
        : `${tableSingular[activeTable]} criada`,
      description: trimmedLabel,
    })
    setStatus(editingId ? 'Item atualizado.' : 'Item criado.')
    setIsModalOpen(false)
    resetForm()
  }

  const handleDelete = (kind: TableKind, id: string) => {
    const entry = tables[kind].find((item) => item.id === id)
    const items = tables[kind].filter((item) => item.id !== id)
    updateTable(kind, items, {
      title: `${tableSingular[kind]} removida`,
      description: entry?.label,
    })
    setStatus('Item removido.')
  }

  const renderList = (kind: TableKind) => {
    const items = tables[kind]
    if (items.length === 0) {
      return <p className="tabelas__empty">Nenhum item registrado.</p>
    }
    return (
      <div className="tabelas__list">
        {items.map((item) => (
          <div key={item.id} className="tabelas__item">
            <div>
              <strong>{item.label}</strong>
              {'symbol' in item && item.symbol && (
                <span className="tabelas__meta">Simbolo: {item.symbol}</span>
              )}
              {'cashboxId' in item && item.cashboxId && (
                <span className="tabelas__meta">
                  Caixa: {cashboxes.find((box) => box.id === item.cashboxId)?.name ?? '-'}
                </span>
              )}
              {item.description && <span className="tabelas__meta">{item.description}</span>}
            </div>
            <div className="tabelas__item-actions">
              <span className={`badge ${item.active === false ? 'badge--recusado' : 'badge--aprovado'}`}>
                {item.active === false ? 'Inativo' : 'Ativo'}
              </span>
              <ActionMenu
                items={[
                  { label: 'Editar', onClick: () => openModal(kind, item) },
                  { label: 'Excluir', onClick: () => handleDelete(kind, item.id) },
                ]}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <section className="tabelas">
      <header className="tabelas__header">
        <div className="tabelas__headline">
          <span className="tabelas__eyebrow">Cadastros</span>
          <h1 className="tabelas__title">Tabelas</h1>
          <p className="tabelas__subtitle">
            Padronize unidades, categorias e formas de pagamento usadas no ERP.
          </p>
        </div>
      </header>

      {status && <p className="form__status">{status}</p>}

      <div className="tabelas__grid">
        <article className="tabelas__panel">
          <div className="tabelas__panel-header">
            <div>
              <h2>Unidades</h2>
              <p>Defina como os itens sao medidos no sistema.</p>
            </div>
            <button className="button button--ghost" type="button" onClick={() => openModal('units')}>
              Nova unidade
            </button>
          </div>
          {renderList('units')}
        </article>

        <article className="tabelas__panel">
          <div className="tabelas__panel-header">
            <div>
              <h2>Categorias</h2>
              <p>Organize produtos, materiais e servicos.</p>
            </div>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => openModal('categories')}
            >
              Nova categoria
            </button>
          </div>
          {renderList('categories')}
        </article>

        <article className="tabelas__panel">
          <div className="tabelas__panel-header">
            <div>
              <h2>Formas de pagamento</h2>
              <p>Defina quais meios estao disponiveis no caixa.</p>
            </div>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => openModal('paymentMethods')}
            >
              Nova forma
            </button>
          </div>
          {renderList('paymentMethods')}
        </article>
      </div>

      <Modal
        open={isModalOpen}
        title={editingId ? `Editar ${tableLabels[activeTable]}` : `Nova ${tableLabels[activeTable]}`}
        onClose={closeModal}
      >
        <form className="form" onSubmit={handleSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="tabela-label">
              Nome
            </label>
            <input
              id="tabela-label"
              className="form__input"
              type="text"
              value={form.label}
              onChange={(event) => updateForm({ label: event.target.value })}
            />
          </div>

          {activeTable === 'units' && (
            <div className="form__group">
              <label className="form__label" htmlFor="tabela-symbol">
                Simbolo
              </label>
              <input
                id="tabela-symbol"
                className="form__input"
                type="text"
                value={form.symbol}
                onChange={(event) => updateForm({ symbol: event.target.value })}
                placeholder="Ex: un, m, m2"
              />
            </div>
          )}

          {activeTable === 'paymentMethods' && (
            <div className="form__group">
              <label className="form__label" htmlFor="tabela-cashbox">
                Caixa vinculado
              </label>
              <select
                id="tabela-cashbox"
                className="form__input"
                value={form.cashboxId}
                onChange={(event) => updateForm({ cashboxId: event.target.value })}
              >
                <option value="">Sem caixa</option>
                {cashboxes.map((box) => (
                  <option key={box.id} value={box.id}>
                    {box.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form__group">
            <label className="form__label" htmlFor="tabela-description">
              Observacoes
            </label>
            <textarea
              id="tabela-description"
              className="form__input form__textarea"
              value={form.description}
              onChange={(event) => updateForm({ description: event.target.value })}
            />
          </div>

          <label className="form__checkbox">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => updateForm({ active: event.target.checked })}
            />
            Item ativo
          </label>

          {status && <p className="form__status">{status}</p>}

          <div className="form__actions">
            <button className="button button--primary" type="submit">
              {editingId ? 'Salvar' : 'Criar'}
            </button>
            <button className="button button--ghost" type="button" onClick={closeModal}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </section>
  )
}

export default Tabelas
