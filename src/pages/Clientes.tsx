import { useMemo, useState, type FormEvent } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'
import type { Client, ClientObra } from '../types/erp'
import { createId } from '../utils/ids'

type ClientObraForm = {
  id: string
  name: string
  address: string
  city: string
  notes: string
  active: boolean
}

type ClientForm = {
  name: string
  document: string
  email: string
  phone: string
  city: string
  notes: string
  active: boolean
  obras: ClientObraForm[]
}

const Clientes = () => {
  const { data, refresh } = useERPData()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<ClientForm>({
    name: '',
    document: '',
    email: '',
    phone: '',
    city: '',
    notes: '',
    active: true,
    obras: [],
  })

  const createEmptyObra = (): ClientObraForm => ({
    id: createId(),
    name: '',
    address: '',
    city: '',
    notes: '',
    active: true,
  })

  const updateForm = (patch: Partial<ClientForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const updateObra = (index: number, patch: Partial<ClientObraForm>) => {
    setForm((prev) => ({
      ...prev,
      obras: prev.obras.map((obra, idx) => (idx === index ? { ...obra, ...patch } : obra)),
    }))
  }

  const addObra = () => {
    setForm((prev) => ({ ...prev, obras: [...prev.obras, createEmptyObra()] }))
  }

  const removeObra = (index: number) => {
    setForm((prev) => ({
      ...prev,
      obras: prev.obras.filter((_, idx) => idx !== index),
    }))
  }

  const resetForm = () => {
    setForm({
      name: '',
      document: '',
      email: '',
      phone: '',
      city: '',
      notes: '',
      active: true,
      obras: [],
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

  const handleEdit = (client: Client) => {
    setEditingId(client.id)
    setForm({
      name: client.name,
      document: client.document ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      city: client.city ?? '',
      notes: client.notes ?? '',
      active: client.active ?? true,
      obras: (client.obras ?? []).map((obra) => ({
        id: obra.id,
        name: obra.name,
        address: obra.address,
        city: obra.city ?? '',
        notes: obra.notes ?? '',
        active: obra.active ?? true,
      })),
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setStatus('Informe o nome do cliente.')
      return
    }

    const payload = dataService.getAll()
    const obras: ClientObra[] = []
    for (const obra of form.obras) {
      const hasAny =
        obra.name.trim() || obra.address.trim() || obra.city.trim() || obra.notes.trim()
      if (!hasAny) {
        continue
      }
      if (!obra.name.trim() || !obra.address.trim()) {
        setStatus('Preencha nome e endereco de todas as obras.')
        return
      }
      obras.push({
        id: obra.id || createId(),
        name: obra.name.trim(),
        address: obra.address.trim(),
        city: obra.city.trim() || undefined,
        notes: obra.notes.trim() || undefined,
        active: obra.active,
      })
    }
    const next: Client = {
      id: editingId ?? createId(),
      name: form.name.trim(),
      document: form.document.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      city: form.city.trim() || undefined,
      notes: form.notes.trim() || undefined,
      active: form.active,
      obras,
    }

    if (editingId) {
      payload.clientes = payload.clientes.map((item) => (item.id === editingId ? next : item))
    } else {
      payload.clientes = [...payload.clientes, next]
    }

    dataService.replaceAll(payload)
    refresh()
    setStatus(editingId ? 'Cliente atualizado.' : 'Cliente cadastrado.')
    setIsModalOpen(false)
    resetForm()
  }

  const clients = useMemo(
    () => [...data.clientes].sort((a, b) => a.name.localeCompare(b.name)),
    [data.clientes],
  )

  const clientToDelete = deleteId
    ? data.clientes.find((client) => client.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    payload.clientes = payload.clientes.filter((client) => client.id !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Cliente excluido.')
    setDeleteId(null)
  }

  return (
    <section className="clientes">
      <header className="clientes__header">
        <div className="clientes__headline">
          <span className="clientes__eyebrow">Comercial</span>
          <h1 className="clientes__title">Clientes</h1>
          <p className="clientes__subtitle">Cadastre clientes para orcamentos e pedidos.</p>
        </div>
        <div className="clientes__actions">
          <button className="button button--primary" type="button" onClick={openNewModal}>
            Novo cliente
          </button>
        </div>
      </header>
      {status && <p className="form__status">{status}</p>}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar cliente' : 'Novo cliente'}
        size="lg"
      >
        <form className="form" onSubmit={handleSubmit}>
            <div className="form__group">
              <label className="form__label" htmlFor="client-name">
                Nome
              </label>
              <input
                id="client-name"
                className="form__input"
                type="text"
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                placeholder="Nome completo ou empresa"
              />
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="client-document">
                  CPF/CNPJ
                </label>
                <input
                  id="client-document"
                  className="form__input"
                  type="text"
                  value={form.document}
                  onChange={(event) => updateForm({ document: event.target.value })}
                  placeholder="Documento"
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="client-city">
                  Cidade
                </label>
                <input
                  id="client-city"
                  className="form__input"
                  type="text"
                  value={form.city}
                  onChange={(event) => updateForm({ city: event.target.value })}
                  placeholder="Cidade"
                />
              </div>
            </div>

            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="client-email">
                  Email
                </label>
                <input
                  id="client-email"
                  className="form__input"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm({ email: event.target.value })}
                  placeholder="email@cliente.com"
                />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="client-phone">
                  Telefone
                </label>
                <input
                  id="client-phone"
                  className="form__input"
                  type="text"
                  value={form.phone}
                  onChange={(event) => updateForm({ phone: event.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="form__section">
              <div className="form__actions">
                <strong>Obras do cliente</strong>
                <button className="button button--ghost" type="button" onClick={addObra}>
                  Adicionar obra
                </button>
              </div>
              {form.obras.length === 0 && (
                <p className="form__help">Nenhuma obra cadastrada para este cliente.</p>
              )}
            </div>

            {form.obras.map((obra, index) => (
              <div key={obra.id} className="form__section">
                <div className="form__row">
                  <div className="form__group">
                    <label className="form__label" htmlFor={`client-work-name-${index}`}>
                      Nome da obra
                    </label>
                    <input
                      id={`client-work-name-${index}`}
                      className="form__input"
                      type="text"
                      value={obra.name}
                      onChange={(event) => updateObra(index, { name: event.target.value })}
                      placeholder="Residencial, lote 12, etc."
                    />
                  </div>
                  <div className="form__group">
                    <label className="form__label" htmlFor={`client-work-city-${index}`}>
                      Cidade
                    </label>
                    <input
                      id={`client-work-city-${index}`}
                      className="form__input"
                      type="text"
                      value={obra.city}
                      onChange={(event) => updateObra(index, { city: event.target.value })}
                      placeholder="Cidade"
                    />
                  </div>
                </div>

                <div className="form__group">
                  <label className="form__label" htmlFor={`client-work-address-${index}`}>
                    Endereco da obra
                  </label>
                  <input
                    id={`client-work-address-${index}`}
                    className="form__input"
                    type="text"
                    value={obra.address}
                    onChange={(event) => updateObra(index, { address: event.target.value })}
                    placeholder="Rua, numero, bairro"
                  />
                </div>

                <div className="form__group">
                  <label className="form__label" htmlFor={`client-work-notes-${index}`}>
                    Observacoes da obra
                  </label>
                  <textarea
                    id={`client-work-notes-${index}`}
                    className="form__input form__textarea"
                    value={obra.notes}
                    onChange={(event) => updateObra(index, { notes: event.target.value })}
                    placeholder="Detalhes de acesso, ponto de referencia, etc."
                  />
                </div>

                <label className="form__checkbox">
                  <input
                    type="checkbox"
                    checked={obra.active}
                    onChange={(event) => updateObra(index, { active: event.target.checked })}
                  />
                  Obra ativa
                </label>

                <div className="form__actions">
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => removeObra(index)}
                  >
                    Remover obra
                  </button>
                </div>
              </div>
            ))}

            <div className="form__group">
              <label className="form__label" htmlFor="client-notes">
                Observacoes
              </label>
              <textarea
                id="client-notes"
                className="form__input form__textarea"
                value={form.notes}
                onChange={(event) => updateForm({ notes: event.target.value })}
                placeholder="Preferencias, prazos, etc."
              />
            </div>

            <label className="form__checkbox">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => updateForm({ active: event.target.checked })}
              />
              Cliente ativo
            </label>

            <div className="form__actions">
              <button className="button button--primary" type="submit">
                {editingId ? 'Atualizar' : 'Salvar cliente'}
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

      <div className="clientes__layout">
        <section className="clientes__panel">
          <div className="clientes__panel-header">
            <div>
              <h2>Clientes cadastrados</h2>
              <p>Base pronta para orcamentos e pedidos.</p>
            </div>
            <span className="clientes__panel-meta">{clients.length} registros</span>
          </div>
          <div className="table-card clientes__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Email</th>
                  <th>Telefone</th>
                  <th>Cidade</th>
                  <th>Obras</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={8} className="table__empty">
                      Nenhum cliente cadastrado ainda.
                    </td>
                  </tr>
                )}
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>{client.name}</td>
                    <td>{client.document ?? '-'}</td>
                    <td>{client.email ?? '-'}</td>
                    <td>{client.phone ?? '-'}</td>
                    <td>{client.city ?? '-'}</td>
                    <td>{client.obras?.length ?? 0}</td>
                    <td>
                      <span className={`badge ${client.active ? 'badge--aprovado' : 'badge--rascunho'}`}>
                        {client.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="table__actions">
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => handleEdit(client)}
                        >
                          Editar
                        </button>
                        <button
                          className="button button--danger"
                          type="button"
                          onClick={() => setDeleteId(client.id)}
                        >
                          Excluir
                        </button>
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
        title="Excluir cliente?"
        description={
          clientToDelete
            ? `O cliente ${clientToDelete.name} sera removido.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </section>
  )
}

export default Clientes
