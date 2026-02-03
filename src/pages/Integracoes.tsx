import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../components/ActionMenu'
import Modal from '../components/Modal'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'
import type { IntegrationConfig, IntegrationStatus } from '../types/erp'
import { formatDateShort } from '../utils/format'

type IntegrationForm = {
  name: string
  provider: string
  status: IntegrationStatus
  notes: string
}

const statusLabels: Record<IntegrationStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
}

const Integracoes = () => {
  const { data, refresh } = useERPData()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<IntegrationForm>({
    name: '',
    provider: '',
    status: 'inativo',
    notes: '',
  })

  const integrations = useMemo(
    () => [...data.integracoes].sort((a, b) => a.name.localeCompare(b.name)),
    [data.integracoes],
  )

  const summary = useMemo(() => {
    return integrations.reduce(
      (acc, item) => {
        acc.total += 1
        if (item.status === 'ativo') acc.active += 1
        return acc
      },
      { total: 0, active: 0 },
    )
  }, [integrations])

  const openModal = (integration: IntegrationConfig) => {
    setEditingId(integration.id)
    setForm({
      name: integration.name,
      provider: integration.provider ?? '',
      status: integration.status,
      notes: integration.notes ?? '',
    })
    setStatus(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setStatus(null)
    setEditingId(null)
  }

  const updateForm = (patch: Partial<IntegrationForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleToggle = (integration: IntegrationConfig) => {
    const payload = dataService.getAll()
    payload.integracoes = payload.integracoes.map((item) =>
      item.id === integration.id
        ? {
            ...item,
            status: item.status === 'ativo' ? 'inativo' : 'ativo',
            lastSync: item.status === 'ativo' ? item.lastSync : new Date().toISOString(),
          }
        : item,
    )
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'alteracao',
        title: 'Integracao atualizada',
        description: `${integration.name} · ${integration.status === 'ativo' ? 'Inativo' : 'Ativo'}`,
      },
    })
    refresh()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId) {
      return
    }
    const payload = dataService.getAll()
    payload.integracoes = payload.integracoes.map((item) =>
      item.id === editingId
        ? {
            ...item,
            provider: form.provider.trim() || undefined,
            status: form.status,
            notes: form.notes.trim() || undefined,
          }
        : item,
    )
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'alteracao',
        title: 'Integracao configurada',
        description: form.name,
      },
    })
    refresh()
    setStatus('Integracao atualizada.')
    closeModal()
  }

  return (
    <section className="integracoes">
      <header className="integracoes__header">
        <div className="integracoes__headline">
          <span className="integracoes__eyebrow">Configuracoes</span>
          <h1 className="integracoes__title">Integracoes</h1>
          <p className="integracoes__subtitle">
            Conecte serviços externos para emissao fiscal, mensagens e backup.
          </p>
        </div>
      </header>

      {status && <p className="form__status">{status}</p>}

      <div className="integracoes__summary summary-card">
        <article className="integracoes__stat">
          <span className="integracoes__stat-label">Integracoes</span>
          <strong className="integracoes__stat-value">{summary.total}</strong>
        </article>
        <article className="integracoes__stat">
          <span className="integracoes__stat-label">Ativas</span>
          <strong className="integracoes__stat-value">{summary.active}</strong>
        </article>
      </div>

      <div className="integracoes__grid">
        {integrations.map((integration) => (
          <article key={integration.id} className="integracoes__card">
            <div>
              <h2>{integration.name}</h2>
              <p>{integration.provider ?? 'Sem provedor definido.'}</p>
              <span className="integracoes__meta">
                Ultima sincronizacao:{' '}
                {integration.lastSync ? formatDateShort(integration.lastSync) : 'Nao informado'}
              </span>
            </div>
            <div className="integracoes__card-actions">
              <span className={`badge badge--${integration.status}`}>
                {statusLabels[integration.status]}
              </span>
              <ActionMenu
                items={[
                  {
                    label: integration.status === 'ativo' ? 'Desativar' : 'Ativar',
                    onClick: () => handleToggle(integration),
                  },
                  { label: 'Configurar', onClick: () => openModal(integration) },
                ]}
              />
            </div>
          </article>
        ))}
      </div>

      <Modal open={isModalOpen} title="Configurar integracao" onClose={closeModal}>
        <form className="form" onSubmit={handleSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="integration-name">
              Integracao
            </label>
            <input
              id="integration-name"
              className="form__input"
              type="text"
              value={form.name}
              disabled
            />
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="integration-provider">
              Provedor
            </label>
            <input
              id="integration-provider"
              className="form__input"
              type="text"
              value={form.provider}
              onChange={(event) => updateForm({ provider: event.target.value })}
              placeholder="Ex: NFe.io, Bling, Twilio"
            />
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="integration-status">
              Status
            </label>
            <select
              id="integration-status"
              className="form__input"
              value={form.status}
              onChange={(event) =>
                updateForm({ status: event.target.value as IntegrationStatus })
              }
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="integration-notes">
              Observacoes
            </label>
            <textarea
              id="integration-notes"
              className="form__input form__textarea"
              value={form.notes}
              onChange={(event) => updateForm({ notes: event.target.value })}
            />
          </div>

          {status && <p className="form__status">{status}</p>}

          <div className="form__actions">
            <button className="button button--primary" type="submit">
              Salvar
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

export default Integracoes
