import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import Modal from '../../components/Modal'
import QuickNotice from '../../components/QuickNotice'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type { PaymentTableEntry, TableEntry, UnitTableEntry } from '../../types/erp'
import { createId } from '../../utils/ids'

type TableKind = 'units' | 'paymentMethods'

type TableForm = {
  label: string
  symbol: string
  cashboxId: string
  description: string
  active: boolean
}

const tableLabels: Record<TableKind, string> = {
  units: 'Unidades',
  paymentMethods: 'Formas de pagamento',
}

const tableSingular: Record<TableKind, string> = {
  units: 'Unidade',
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
  const tableFormId = 'tabela-form'

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
        symbol: kind === 'units' ? (entry as UnitTableEntry).symbol ?? '' : '',
        cashboxId:
          kind === 'paymentMethods' ? (entry as PaymentTableEntry).cashboxId ?? '' : '',
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
    } else {
      const paymentEntry: PaymentTableEntry = {
        ...baseEntry,
        cashboxId: form.cashboxId || undefined,
      }
      nextItems = editingId
        ? items.map((item) => (item.id === editingId ? paymentEntry : item))
        : [...items, paymentEntry]
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
    setIsModalOpen(false)
    resetForm()
    setStatus('Item removido.')
  }

  const renderList = (kind: TableKind) => {
    const items = tables[kind]
    if (items.length === 0) {
      return <p className="list__empty">Nenhum item registrado.</p>
    }
    return (
      <div className="list">
        {items.map((item) => (
          <div key={item.id} className="list__item">
            <div>
              <strong>{item.label}</strong>
              {'symbol' in item && item.symbol && (
                <span className="list__meta">Simbolo: {item.symbol}</span>
              )}
              {'cashboxId' in item && item.cashboxId && (
                <span className="list__meta">
                  Caixa: {cashboxes.find((box) => box.id === item.cashboxId)?.name ?? '-'}
                </span>
              )}
              {item.description && <span className="list__meta">{item.description}</span>}
            </div>
            <div className="list__actions">
              <span className={`badge ${item.active === false ? 'badge--recusado' : 'badge--aprovado'}`}>
                {item.active === false ? 'Inativo' : 'Ativo'}
              </span>
              <ActionMenu
                items={[
                  { label: 'Editar', onClick: () => openModal(kind, item) },
                ]}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Page className="tabelas">
      <PageHeader />

      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <div className="tabelas__grid">
        <article className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Unidades</h2>
              <p className="panel__subtitle">Defina como os itens sao medidos no sistema.</p>
            </div>
            <button className="button button--ghost" type="button" onClick={() => openModal('units')}>
              Nova unidade
            </button>
          </div>
          {renderList('units')}
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Formas de pagamento</h2>
              <p className="panel__subtitle">Defina quais meios estao disponiveis no caixa.</p>
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
        actions={
          <>
            {editingId && (
              <button
                className="button button--danger"
                type="button"
                onClick={() => handleDelete(activeTable, editingId)}
              >
                <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                  delete
                </span>
                <span className="modal__action-label">Excluir</span>
              </button>
            )}
            <button className="button button--primary" type="submit" form={tableFormId}>
              <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                save
              </span>
              <span className="modal__action-label">{editingId ? 'Salvar' : 'Criar'}</span>
            </button>
          </>
        }
      >
        <form id={tableFormId} className="modal__form" onSubmit={handleSubmit}>
          <div className="modal__group">
            <label className="modal__label" htmlFor="tabela-label">
              Nome
            </label>
            <input
              id="tabela-label"
              className="modal__input"
              type="text"
              value={form.label}
              onChange={(event) => updateForm({ label: event.target.value })}
            />
          </div>

          {activeTable === 'units' && (
            <div className="modal__group">
              <label className="modal__label" htmlFor="tabela-symbol">
                Simbolo
              </label>
              <input
                id="tabela-symbol"
                className="modal__input"
                type="text"
                value={form.symbol}
                onChange={(event) => updateForm({ symbol: event.target.value })}
                placeholder="Ex: un, m, m2"
              />
            </div>
          )}

          {activeTable === 'paymentMethods' && (
            <div className="modal__group">
              <label className="modal__label" htmlFor="tabela-cashbox">
                Caixa vinculado
              </label>
              <select
                id="tabela-cashbox"
                className="modal__input"
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

          <div className="modal__group">
            <label className="modal__label" htmlFor="tabela-description">
              Observacoes
            </label>
            <textarea
              id="tabela-description"
              className="modal__input modal__textarea"
              value={form.description}
              onChange={(event) => updateForm({ description: event.target.value })}
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
            <span className="toggle__label">Item ativo</span>
          </label>

        </form>
      </Modal>
    </Page>
  )
}

export default Tabelas
