import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '@shared/components/Modal'
import QuickNotice from '@shared/components/QuickNotice'
import { Page, PageHeader } from '@ui/components'
import { dataService } from '@shared/services/dataService'
import { useERPData } from '@shared/store/appStore'
import type { Supplier } from '@shared/types/erp'
import { createId } from '@shared/utils/ids'

type SupplierForm = {
  name: string
  contact: string
  document: string
  email: string
  phone: string
  city: string
  notes: string
  active: boolean
}

const Fornecedores = () => {
  const { data, refresh } = useERPData()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<SupplierForm>({
    name: '',
    contact: '',
    document: '',
    email: '',
    phone: '',
    city: '',
    notes: '',
    active: true,
  })
  const supplierFormId = 'fornecedor-form'

  const updateForm = (patch: Partial<SupplierForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const resetForm = () => {
    setForm({
      name: '',
      contact: '',
      document: '',
      email: '',
      phone: '',
      city: '',
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

  const handleEdit = (supplier: Supplier) => {
    setEditingId(supplier.id)
    setForm({
      name: supplier.name,
      contact: supplier.contact ?? '',
      document: supplier.document ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      city: supplier.city ?? '',
      notes: supplier.notes ?? '',
      active: supplier.active ?? true,
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setStatus('Informe o nome do fornecedor.')
      return
    }

    const payload = dataService.getAll()
    const next: Supplier = {
      id: editingId ?? createId(),
      name: form.name.trim(),
      contact: form.contact.trim() || undefined,
      document: form.document.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      city: form.city.trim() || undefined,
      notes: form.notes.trim() || undefined,
      active: form.active,
    }

    if (editingId) {
      payload.fornecedores = payload.fornecedores.map((item) =>
        item.id === editingId ? next : item,
      )
    } else {
      payload.fornecedores = [...payload.fornecedores, next]
    }

    dataService.replaceAll(payload)
    refresh()
    setStatus(editingId ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.')
    setIsModalOpen(false)
    resetForm()
  }

  const suppliers = useMemo(
    () => [...data.fornecedores].sort((a, b) => a.name.localeCompare(b.name)),
    [data.fornecedores],
  )

  const supplierToDelete = deleteId
    ? data.fornecedores.find((supplier) => supplier.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.fornecedores = payload.fornecedores.filter((supplier) => supplier.id !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setIsModalOpen(false)
    resetForm()
    setStatus('Fornecedor excluido.')
    setDeleteId(null)
  }

  return (
    <Page className="fornecedores">
      <PageHeader
        actions={
          <button className="button button--primary" type="button" onClick={openNewModal}>
            <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
              storefront
            </span>
            <span className="page-header__action-label">Novo fornecedor</span>
          </button>
        }
      />
      <QuickNotice message={status} onClear={() => setStatus(null)} />

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar fornecedor' : 'Novo fornecedor'}
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
            <button className="button button--primary" type="submit" form={supplierFormId}>
              <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
                save
              </span>
              <span className="modal__action-label">
                {editingId ? 'Atualizar' : 'Salvar fornecedor'}
              </span>
            </button>
          </>
        }
      >
        <form id={supplierFormId} className="modal__form" onSubmit={handleSubmit}>
            <div className="modal__group">
              <label className="modal__label" htmlFor="supplier-name">
                Nome
              </label>
              <input
                id="supplier-name"
                className="modal__input"
                type="text"
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                placeholder="Nome da empresa"
              />
            </div>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="supplier-contact">
                  Contato
                </label>
                <input
                  id="supplier-contact"
                  className="modal__input"
                  type="text"
                  value={form.contact}
                  onChange={(event) => updateForm({ contact: event.target.value })}
                  placeholder="Responsavel"
                />
              </div>
              <div className="modal__group">
                <label className="modal__label" htmlFor="supplier-document">
                  CPF/CNPJ
                </label>
                <input
                  id="supplier-document"
                  className="modal__input"
                  type="text"
                  value={form.document}
                  onChange={(event) => updateForm({ document: event.target.value })}
                  placeholder="Documento"
                />
              </div>
            </div>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="supplier-email">
                  Email
                </label>
                <input
                  id="supplier-email"
                  className="modal__input"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm({ email: event.target.value })}
                  placeholder="email@fornecedor.com"
                />
              </div>
              <div className="modal__group">
                <label className="modal__label" htmlFor="supplier-phone">
                  Telefone
                </label>
                <input
                  id="supplier-phone"
                  className="modal__input"
                  type="text"
                  value={form.phone}
                  onChange={(event) => updateForm({ phone: event.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="modal__row">
              <div className="modal__group">
                <label className="modal__label" htmlFor="supplier-city">
                  Cidade
                </label>
                <input
                  id="supplier-city"
                  className="modal__input"
                  type="text"
                  value={form.city}
                  onChange={(event) => updateForm({ city: event.target.value })}
                  placeholder="Cidade"
                />
              </div>
            </div>

            <div className="modal__group">
              <label className="modal__label" htmlFor="supplier-notes">
                Observacoes
              </label>
              <textarea
                id="supplier-notes"
                className="modal__input modal__textarea"
                value={form.notes}
                onChange={(event) => updateForm({ notes: event.target.value })}
                placeholder="Condicoes comerciais, prazos, etc."
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
              <span className="toggle__label">Fornecedor ativo</span>
            </label>

        </form>
      </Modal>

      <div className="fornecedores__layout">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Fornecedores cadastrados</h2>
              <p>Base centralizada de contatos e documentos.</p>
            </div>
            <span className="panel__meta">{suppliers.length} registros</span>
          </div>
          <div className="table-card">
            <table className="table">
              <thead className="table__head table__head--mobile-hide">
                <tr>
                  <th>Fornecedor</th>
                  <th>Contato</th>
                  <th>Email</th>
                  <th>Telefone</th>
                  <th>Cidade</th>
                  <th className="table__actions table__actions--end">Status / Editar</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table__empty">
                      Nenhum fornecedor cadastrado ainda.
                    </td>
                  </tr>
                )}
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td className="table__cell--truncate">
                      <div className="table__stack">
                        <strong>{supplier.name}</strong>
                        <span className="table__sub table__sub--mobile">
                          {supplier.phone ?? '-'}
                        </span>
                      </div>
                    </td>
                    <td className="table__cell--mobile-hide">{supplier.contact ?? '-'}</td>
                    <td className="table__cell--mobile-hide">{supplier.email ?? '-'}</td>
                    <td className="table__cell--mobile-hide">{supplier.phone ?? '-'}</td>
                    <td className="table__cell--mobile-hide">{supplier.city ?? '-'}</td>
                    <td className="table__actions table__actions--end">
                      <div className="table__end">
                        <div className="table__status">
                          <span
                            className={`badge ${
                              supplier.active ? 'badge--aprovado' : 'badge--rascunho'
                            }`}
                          >
                            {supplier.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <ActionMenu
                          items={[
                            { label: 'Editar', onClick: () => handleEdit(supplier) },
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
        title="Excluir fornecedor?"
        description={
          supplierToDelete
            ? `O fornecedor ${supplierToDelete.name} sera removido.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </Page>
  )
}

export default Fornecedores
