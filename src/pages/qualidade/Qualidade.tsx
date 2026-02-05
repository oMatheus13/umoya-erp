import { useMemo, useState, type FormEvent } from 'react'
import ActionMenu from '../../components/ActionMenu'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '../../components/Modal'
import { Page, PageHeader } from '../../components/ui'
import { dataService } from '../../services/dataService'
import { useERPData } from '../../store/appStore'
import type {
  MaintenanceLog,
  MaintenanceStatus,
  MaintenanceType,
  QualityCheck,
  QualityCheckStatus,
  QualityCheckType,
  QualitySeverity,
} from '../../types/erp'
import { formatCurrency, formatDateShort } from '../../utils/format'
import { createId } from '../../utils/ids'

type QualityForm = {
  type: QualityCheckType
  productId: string
  productionOrderId: string
  description: string
  severity: QualitySeverity
  estimatedCost: number
  status: QualityCheckStatus
  notes: string
}

type MaintenanceForm = {
  equipment: string
  type: MaintenanceType
  status: MaintenanceStatus
  scheduledAt: string
  performedAt: string
  cost: number
  notes: string
}

const qualityLabels: Record<QualityCheckType, string> = {
  checklist: 'Checklist',
  falha: 'Falha',
}

const severityLabels: Record<QualitySeverity, string> = {
  baixa: 'Baixa',
  media: 'Media',
  alta: 'Alta',
}

const qualityStatusLabels: Record<QualityCheckStatus, string> = {
  aberto: 'Em aberto',
  resolvido: 'Resolvido',
}

const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  aberta: 'Em aberto',
  finalizada: 'Finalizada',
}

const maintenanceTypeLabels: Record<MaintenanceType, string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
}

const Qualidade = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [qualityEditingId, setQualityEditingId] = useState<string | null>(null)
  const [maintenanceEditingId, setMaintenanceEditingId] = useState<string | null>(null)
  const [qualityModalOpen, setQualityModalOpen] = useState(false)
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)
  const [deleteQualityId, setDeleteQualityId] = useState<string | null>(null)
  const [deleteMaintenanceId, setDeleteMaintenanceId] = useState<string | null>(null)
  const [qualityForm, setQualityForm] = useState<QualityForm>({
    type: 'checklist',
    productId: '',
    productionOrderId: '',
    description: '',
    severity: 'media',
    estimatedCost: 0,
    status: 'aberto',
    notes: '',
  })
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceForm>({
    equipment: '',
    type: 'preventiva',
    status: 'aberta',
    scheduledAt: '',
    performedAt: '',
    cost: 0,
    notes: '',
  })
  const qualityFormId = 'qualidade-form'
  const maintenanceFormId = 'manutencao-form'

  const products = useMemo(
    () => [...data.produtos].filter((item) => item.active !== false),
    [data.produtos],
  )
  const productionOrders = useMemo(
    () =>
      [...data.ordensProducao].sort((a, b) =>
        (b.plannedAt ?? b.finishedAt ?? '').localeCompare(a.plannedAt ?? a.finishedAt ?? ''),
      ),
    [data.ordensProducao],
  )

  const qualityChecks = useMemo(
    () => [...data.qualidadeChecks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.qualidadeChecks],
  )
  const maintenanceLogs = useMemo(
    () => [...data.manutencoes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.manutencoes],
  )

  const qualitySummary = useMemo(() => {
    return qualityChecks.reduce(
      (acc, entry) => {
        acc.total += 1
        if (entry.status === 'aberto') acc.open += 1
        if (entry.status === 'resolvido') acc.done += 1
        if (entry.type === 'falha') acc.issues += 1
        return acc
      },
      { total: 0, open: 0, done: 0, issues: 0 },
    )
  }, [qualityChecks])

  const maintenanceSummary = useMemo(() => {
    return maintenanceLogs.reduce(
      (acc, entry) => {
        acc.total += 1
        if (entry.status === 'aberta') acc.open += 1
        if (entry.status === 'finalizada') acc.done += 1
        return acc
      },
      { total: 0, open: 0, done: 0 },
    )
  }, [maintenanceLogs])

  const resetQualityForm = () => {
    setQualityForm({
      type: 'checklist',
      productId: '',
      productionOrderId: '',
      description: '',
      severity: 'media',
      estimatedCost: 0,
      status: 'aberto',
      notes: '',
    })
    setQualityEditingId(null)
  }

  const resetMaintenanceForm = () => {
    setMaintenanceForm({
      equipment: '',
      type: 'preventiva',
      status: 'aberta',
      scheduledAt: '',
      performedAt: '',
      cost: 0,
      notes: '',
    })
    setMaintenanceEditingId(null)
  }

  const openQualityModal = () => {
    resetQualityForm()
    setStatus(null)
    setQualityModalOpen(true)
  }

  const openMaintenanceModal = () => {
    resetMaintenanceForm()
    setStatus(null)
    setMaintenanceModalOpen(true)
  }

  const closeQualityModal = () => {
    setQualityModalOpen(false)
    setStatus(null)
    resetQualityForm()
  }

  const closeMaintenanceModal = () => {
    setMaintenanceModalOpen(false)
    setStatus(null)
    resetMaintenanceForm()
  }

  const getProductName = (id?: string) =>
    data.produtos.find((item) => item.id === id)?.name ?? '-'

  const handleQualityEdit = (entry: QualityCheck) => {
    setQualityEditingId(entry.id)
    setQualityForm({
      type: entry.type,
      productId: entry.productId ?? '',
      productionOrderId: entry.productionOrderId ?? '',
      description: entry.description,
      severity: entry.severity ?? 'media',
      estimatedCost: entry.estimatedCost ?? 0,
      status: entry.status,
      notes: entry.notes ?? '',
    })
    setQualityModalOpen(true)
  }

  const handleMaintenanceEdit = (entry: MaintenanceLog) => {
    setMaintenanceEditingId(entry.id)
    setMaintenanceForm({
      equipment: entry.equipment,
      type: entry.type,
      status: entry.status,
      scheduledAt: entry.scheduledAt ?? '',
      performedAt: entry.performedAt ?? '',
      cost: entry.cost ?? 0,
      notes: entry.notes ?? '',
    })
    setMaintenanceModalOpen(true)
  }

  const handleQualitySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!qualityForm.description.trim()) {
      setStatus('Descreva a falha ou checklist.')
      return
    }
    const next: QualityCheck = {
      id: qualityEditingId ?? createId(),
      type: qualityForm.type,
      productId: qualityForm.productId || undefined,
      productionOrderId: qualityForm.productionOrderId || undefined,
      description: qualityForm.description.trim(),
      severity: qualityForm.severity,
      estimatedCost:
        qualityForm.estimatedCost > 0 ? qualityForm.estimatedCost : undefined,
      status: qualityForm.status,
      notes: qualityForm.notes.trim() || undefined,
      createdAt:
        qualityEditingId
          ? data.qualidadeChecks.find((item) => item.id === qualityEditingId)?.createdAt ??
            new Date().toISOString()
          : new Date().toISOString(),
    }
    const payload = dataService.getAll()
    payload.qualidadeChecks = qualityEditingId
      ? payload.qualidadeChecks.map((item) => (item.id === next.id ? next : item))
      : [...payload.qualidadeChecks, next]
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: qualityEditingId ? 'Registro de qualidade atualizado' : 'Registro de qualidade criado',
        description: next.description,
      },
    })
    refresh()
    setStatus(qualityEditingId ? 'Registro atualizado.' : 'Registro criado.')
    closeQualityModal()
  }

  const handleMaintenanceSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!maintenanceForm.equipment.trim()) {
      setStatus('Informe o equipamento.')
      return
    }
    const next: MaintenanceLog = {
      id: maintenanceEditingId ?? createId(),
      equipment: maintenanceForm.equipment.trim(),
      type: maintenanceForm.type,
      status: maintenanceForm.status,
      scheduledAt: maintenanceForm.scheduledAt || undefined,
      performedAt: maintenanceForm.performedAt || undefined,
      cost: maintenanceForm.cost > 0 ? maintenanceForm.cost : undefined,
      notes: maintenanceForm.notes.trim() || undefined,
      createdAt:
        maintenanceEditingId
          ? data.manutencoes.find((item) => item.id === maintenanceEditingId)?.createdAt ??
            new Date().toISOString()
          : new Date().toISOString(),
    }
    const payload = dataService.getAll()
    payload.manutencoes = maintenanceEditingId
      ? payload.manutencoes.map((item) => (item.id === next.id ? next : item))
      : [...payload.manutencoes, next]
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: maintenanceEditingId ? 'Manutencao atualizada' : 'Manutencao registrada',
        description: next.equipment,
      },
    })
    refresh()
    setStatus(maintenanceEditingId ? 'Manutencao atualizada.' : 'Manutencao registrada.')
    closeMaintenanceModal()
  }

  const qualityToDelete = deleteQualityId
    ? data.qualidadeChecks.find((item) => item.id === deleteQualityId)
    : null
  const maintenanceToDelete = deleteMaintenanceId
    ? data.manutencoes.find((item) => item.id === deleteMaintenanceId)
    : null

  const handleQualityDelete = () => {
    if (!deleteQualityId) {
      return
    }
    const payload = dataService.getAll()
    payload.qualidadeChecks = payload.qualidadeChecks.filter(
      (item) => item.id !== deleteQualityId,
    )
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Registro de qualidade removido',
        description: qualityToDelete?.description,
      },
    })
    refresh()
    setStatus('Registro removido.')
    setDeleteQualityId(null)
  }

  const handleMaintenanceDelete = () => {
    if (!deleteMaintenanceId) {
      return
    }
    const payload = dataService.getAll()
    payload.manutencoes = payload.manutencoes.filter(
      (item) => item.id !== deleteMaintenanceId,
    )
    dataService.replaceAll(payload, {
      auditEvent: {
        category: 'acao',
        title: 'Manutencao removida',
        description: maintenanceToDelete?.equipment,
      },
    })
    refresh()
    setStatus('Manutencao removida.')
    setDeleteMaintenanceId(null)
  }

  return (
    <Page className="qualidade">
      <PageHeader
        actions={
          <>
            <button className="button button--ghost" type="button" onClick={openQualityModal}>
              <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
                fact_check
              </span>
              <span className="page-header__action-label">Novo checklist/falha</span>
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={openMaintenanceModal}
            >
              <span className="material-symbols-outlined page-header__action-icon" aria-hidden="true">
                build
              </span>
              <span className="page-header__action-label">Nova manutencao</span>
            </button>
          </>
        }
      />

      {status && <p className="form__status">{status}</p>}

      <div className="qualidade__summary summary-card">
        <article className="qualidade__stat">
          <span className="qualidade__stat-label">Checks</span>
          <strong className="qualidade__stat-value">{qualitySummary.total}</strong>
        </article>
        <article className="qualidade__stat">
          <span className="qualidade__stat-label">Falhas</span>
          <strong className="qualidade__stat-value">{qualitySummary.issues}</strong>
        </article>
        <article className="qualidade__stat">
          <span className="qualidade__stat-label">Pendentes</span>
          <strong className="qualidade__stat-value">{qualitySummary.open}</strong>
        </article>
        <article className="qualidade__stat">
          <span className="qualidade__stat-label">Manutencoes abertas</span>
          <strong className="qualidade__stat-value">{maintenanceSummary.open}</strong>
        </article>
      </div>

      <div className="qualidade__grid">
        <section className="qualidade__panel">
          <div className="qualidade__panel-header">
            <div>
              <h2>Checklists e falhas</h2>
              <p>Controle de qualidade das pecas e processos.</p>
            </div>
          </div>
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Produto</th>
                  <th>OP</th>
                  <th>Severidade</th>
                  <th>Status</th>
                  <th>Descricao</th>
                  <th className="table__actions">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {qualityChecks.length === 0 ? (
                  <tr>
                    <td className="table__empty" colSpan={8}>
                      Nenhum registro de qualidade.
                    </td>
                  </tr>
                ) : (
                  qualityChecks.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateShort(entry.createdAt)}</td>
                      <td>{qualityLabels[entry.type]}</td>
                      <td>{entry.productId ? getProductName(entry.productId) : '-'}</td>
                      <td>{entry.productionOrderId ? `#${entry.productionOrderId.slice(-5)}` : '-'}</td>
                      <td>{entry.severity ? severityLabels[entry.severity] : '-'}</td>
                      <td>
                        <span className={`badge badge--${entry.status}`}>
                          {qualityStatusLabels[entry.status]}
                        </span>
                      </td>
                      <td>{entry.description}</td>
                      <td className="table__actions">
                        <ActionMenu
                          items={[
                            { label: 'Editar', onClick: () => handleQualityEdit(entry) },
                            { label: 'Excluir', onClick: () => setDeleteQualityId(entry.id) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="qualidade__panel">
          <div className="qualidade__panel-header">
            <div>
              <h2>Manutencao de equipamentos</h2>
              <p>Controle preventivo e corretivo da fabrica.</p>
            </div>
          </div>
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Agendada</th>
                  <th>Realizada</th>
                  <th>Custo</th>
                  <th className="table__actions">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceLogs.length === 0 ? (
                  <tr>
                    <td className="table__empty" colSpan={7}>
                      Nenhuma manutencao registrada.
                    </td>
                  </tr>
                ) : (
                  maintenanceLogs.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.equipment}</td>
                      <td>{maintenanceTypeLabels[entry.type]}</td>
                      <td>
                        <span className={`badge badge--${entry.status}`}>
                          {maintenanceStatusLabels[entry.status]}
                        </span>
                      </td>
                      <td>{formatDateShort(entry.scheduledAt ?? '')}</td>
                      <td>{formatDateShort(entry.performedAt ?? '')}</td>
                      <td>{entry.cost ? formatCurrency(entry.cost) : '-'}</td>
                      <td className="table__actions">
                        <ActionMenu
                          items={[
                            { label: 'Editar', onClick: () => handleMaintenanceEdit(entry) },
                            { label: 'Excluir', onClick: () => setDeleteMaintenanceId(entry.id) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal
        open={qualityModalOpen}
        title="Checklist ou falha"
        onClose={closeQualityModal}
        actions={
          <button className="button button--primary" type="submit" form={qualityFormId}>
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              save
            </span>
            <span className="modal__action-label">
              {qualityEditingId ? 'Salvar' : 'Registrar'}
            </span>
          </button>
        }
      >
        <form id={qualityFormId} className="form" onSubmit={handleQualitySubmit}>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="quality-type">
                Tipo
              </label>
              <select
                id="quality-type"
                className="form__input"
                value={qualityForm.type}
                onChange={(event) =>
                  setQualityForm((prev) => ({
                    ...prev,
                    type: event.target.value as QualityCheckType,
                  }))
                }
              >
                {Object.entries(qualityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="quality-status">
                Status
              </label>
              <select
                id="quality-status"
                className="form__input"
                value={qualityForm.status}
                onChange={(event) =>
                  setQualityForm((prev) => ({
                    ...prev,
                    status: event.target.value as QualityCheckStatus,
                  }))
                }
              >
                {Object.entries(qualityStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="quality-severity">
                Severidade
              </label>
              <select
                id="quality-severity"
                className="form__input"
                value={qualityForm.severity}
                onChange={(event) =>
                  setQualityForm((prev) => ({
                    ...prev,
                    severity: event.target.value as QualitySeverity,
                  }))
                }
              >
                {Object.entries(severityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="quality-product">
                Produto
              </label>
              <select
                id="quality-product"
                className="form__input"
                value={qualityForm.productId}
                onChange={(event) =>
                  setQualityForm((prev) => ({
                    ...prev,
                    productId: event.target.value,
                  }))
                }
              >
                <option value="">Sem produto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="quality-order">
                Ordem de producao
              </label>
              <select
                id="quality-order"
                className="form__input"
                value={qualityForm.productionOrderId}
                onChange={(event) =>
                  setQualityForm((prev) => ({
                    ...prev,
                    productionOrderId: event.target.value,
                  }))
                }
              >
                <option value="">Sem ordem</option>
                {productionOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    #{order.id.slice(-5)} · {getProductName(order.productId)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="quality-description">
              Descricao
            </label>
            <textarea
              id="quality-description"
              className="form__input form__textarea"
              value={qualityForm.description}
              onChange={(event) =>
                setQualityForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="quality-cost">
                Custo estimado
              </label>
              <input
                id="quality-cost"
                className="form__input"
                type="number"
                min="0"
                step="0.01"
                value={qualityForm.estimatedCost}
                onChange={(event) =>
                  setQualityForm((prev) => ({
                    ...prev,
                    estimatedCost: Number(event.target.value),
                  }))
                }
              />
            </div>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="quality-notes">
              Observacoes
            </label>
            <textarea
              id="quality-notes"
              className="form__input form__textarea"
              value={qualityForm.notes}
              onChange={(event) =>
                setQualityForm((prev) => ({ ...prev, notes: event.target.value }))
              }
            />
          </div>

          {status && <p className="form__status">{status}</p>}
        </form>
      </Modal>

      <Modal
        open={maintenanceModalOpen}
        title="Manutencao"
        onClose={closeMaintenanceModal}
        actions={
          <button className="button button--primary" type="submit" form={maintenanceFormId}>
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              save
            </span>
            <span className="modal__action-label">
              {maintenanceEditingId ? 'Salvar' : 'Registrar'}
            </span>
          </button>
        }
      >
        <form id={maintenanceFormId} className="form" onSubmit={handleMaintenanceSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="maint-equipment">
              Equipamento
            </label>
            <input
              id="maint-equipment"
              className="form__input"
              type="text"
              value={maintenanceForm.equipment}
              onChange={(event) =>
                setMaintenanceForm((prev) => ({ ...prev, equipment: event.target.value }))
              }
            />
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="maint-type">
                Tipo
              </label>
              <select
                id="maint-type"
                className="form__input"
                value={maintenanceForm.type}
                onChange={(event) =>
                  setMaintenanceForm((prev) => ({
                    ...prev,
                    type: event.target.value as MaintenanceType,
                  }))
                }
              >
                {Object.entries(maintenanceTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="maint-status">
                Status
              </label>
              <select
                id="maint-status"
                className="form__input"
                value={maintenanceForm.status}
                onChange={(event) =>
                  setMaintenanceForm((prev) => ({
                    ...prev,
                    status: event.target.value as MaintenanceStatus,
                  }))
                }
              >
                {Object.entries(maintenanceStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="maint-scheduled">
                Agendada
              </label>
              <input
                id="maint-scheduled"
                className="form__input"
                type="date"
                value={maintenanceForm.scheduledAt}
                onChange={(event) =>
                  setMaintenanceForm((prev) => ({
                    ...prev,
                    scheduledAt: event.target.value,
                  }))
                }
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="maint-performed">
                Realizada
              </label>
              <input
                id="maint-performed"
                className="form__input"
                type="date"
                value={maintenanceForm.performedAt}
                onChange={(event) =>
                  setMaintenanceForm((prev) => ({
                    ...prev,
                    performedAt: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="maint-cost">
              Custo
            </label>
            <input
              id="maint-cost"
              className="form__input"
              type="number"
              min="0"
              step="0.01"
              value={maintenanceForm.cost}
              onChange={(event) =>
                setMaintenanceForm((prev) => ({ ...prev, cost: Number(event.target.value) }))
              }
            />
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="maint-notes">
              Observacoes
            </label>
            <textarea
              id="maint-notes"
              className="form__input form__textarea"
              value={maintenanceForm.notes}
              onChange={(event) =>
                setMaintenanceForm((prev) => ({ ...prev, notes: event.target.value }))
              }
            />
          </div>

          {status && <p className="form__status">{status}</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteQualityId}
        title="Excluir registro?"
        description="O registro de qualidade sera removido."
        onClose={() => setDeleteQualityId(null)}
        onConfirm={handleQualityDelete}
      />
      <ConfirmDialog
        open={!!deleteMaintenanceId}
        title="Excluir manutencao?"
        description="Este registro de manutencao sera removido."
        onClose={() => setDeleteMaintenanceId(null)}
        onConfirm={handleMaintenanceDelete}
      />
    </Page>
  )
}

export default Qualidade
