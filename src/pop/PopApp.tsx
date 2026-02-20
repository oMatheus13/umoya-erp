import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Login from '../pages/core/Login'
import logotipo from '../assets/brand/logotipo.svg'
import {
  dataService,
  ensureStorageSeed,
  setRemoteSync,
} from '../services/dataService'
import { buildTrackingPayloads } from '../services/trackingPayload'
import { popSyncRemote } from '../services/popSyncRemote'
import { useERPData } from '../store/appStore'
import type {
  Employee,
  ERPData,
  PresenceLogType,
  ProductionOrder,
} from '../types/erp'
import { resolveDeviceId } from '../utils/device'
import { createId } from '../utils/ids'
import { resolveOrderInternalCode } from '../utils/orderCode'

type PopView = 'pin' | 'menu' | 'presence' | 'production' | 'confirm'
type ProductionStep = 'select' | 'form'

type ProductionForm = {
  quantity: number
  lengthM: number
  scrapQuantity: number
  scrapLengthM: number
  notes: string
}

const IDLE_TIMEOUT_MS = 25000

const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)

const hasMeaningfulData = (payload: ERPData) =>
  payload.produtos.length > 0 ||
  payload.clientes.length > 0 ||
  payload.orcamentos.length > 0 ||
  payload.pedidos.length > 0 ||
  payload.financeiro.length > 0 ||
  payload.materiais.length > 0 ||
  payload.comprasHistorico.length > 0 ||
  payload.ordensProducao.length > 0 ||
  payload.entregas.length > 0 ||
  payload.funcionarios.length > 0

const resolveUpdatedAt = (payload: ERPData | null, fallback?: string) =>
  payload?.meta?.updatedAt ?? fallback

const createRemoteSync = () => {
  const SYNC_DEBOUNCE_MS = 400
  let pending: ERPData | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = async () => {
    if (!pending) {
      return
    }
    const payload = pending
    pending = null
    await popSyncRemote.upsertState(payload, buildTrackingPayloads(payload))
  }

  return (data: ERPData) => {
    pending = data
    if (timer) {
      return
    }
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, SYNC_DEBOUNCE_MS)
  }
}

const createEmptyProductionForm = (): ProductionForm => ({
  quantity: 1,
  lengthM: 0,
  scrapQuantity: 0,
  scrapLengthM: 0,
  notes: '',
})

const PopApp = () => {
  const { data, refresh } = useERPData()
  const [view, setView] = useState<PopView>('pin')
  const [pinNotice, setPinNotice] = useState<string | null>(null)
  const [formStatus, setFormStatus] = useState<string | null>(null)
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)
  const [presenceNote, setPresenceNote] = useState('')
  const [search, setSearch] = useState('')
  const [productionStep, setProductionStep] = useState<ProductionStep>('select')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [productionForm, setProductionForm] = useState<ProductionForm>(
    createEmptyProductionForm(),
  )
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [syncReady, setSyncReady] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const deviceIdRef = useRef(resolveDeviceId())
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncHandlerRef = useRef<ReturnType<typeof createRemoteSync> | null>(null)
  const syncInFlightRef = useRef(false)

  const productsById = useMemo(
    () => new Map(data.produtos.map((product) => [product.id, product])),
    [data.produtos],
  )

  const ordersById = useMemo(
    () => new Map(data.pedidos.map((order) => [order.id, order])),
    [data.pedidos],
  )

  const availableOrders = useMemo(() => {
    const allowed = new Set(['ABERTA', 'EM_ANDAMENTO', 'PARCIAL'])
    return [...data.ordensProducao]
      .filter((order) => allowed.has(order.status))
      .sort((a, b) =>
        (b.createdAt ?? b.plannedAt ?? '').localeCompare(a.createdAt ?? a.plannedAt ?? ''),
      )
  }, [data.ordensProducao])

  useEffect(() => {
    ensureStorageSeed()
  }, [])

  useEffect(() => {
    if (view === 'pin') {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      return
    }
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }
    idleTimerRef.current = setTimeout(() => {
      resetSession('Sessao expirada. Digite o PIN novamente.')
    }, IDLE_TIMEOUT_MS)
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
    }
  }, [view])

  const ensureRemoteSync = () => {
    if (syncHandlerRef.current) {
      setRemoteSync(syncHandlerRef.current)
      return syncHandlerRef.current
    }
    const handler = createRemoteSync()
    syncHandlerRef.current = handler
    setRemoteSync(handler)
    return handler
  }

  const applyRemotePayload = (payload: ERPData) => {
    const handler = syncHandlerRef.current
    setRemoteSync(null)
    dataService.replaceAll(payload, { touchMeta: false, skipSync: true })
    if (handler) {
      setRemoteSync(handler)
    } else {
      ensureRemoteSync()
    }
  }

  const syncFromRemote = async () => {
    if (syncInFlightRef.current) {
      return
    }
    syncInFlightRef.current = true
    const localSnapshot = dataService.getAll()
    const localHasData = hasMeaningfulData(localSnapshot)
    try {
      setSyncError(null)
      const remote = await popSyncRemote.fetchState()
      if (remote.error) {
        setSyncError(remote.error)
        return
      }
      const remotePayload = remote.data
      const remoteUpdatedAt = resolveUpdatedAt(remotePayload, remote.updatedAt)
      const localUpdatedAt = resolveUpdatedAt(localSnapshot)
      const remoteIsNewer =
        !!remotePayload &&
        !!remoteUpdatedAt &&
        (!localUpdatedAt || remoteUpdatedAt > localUpdatedAt)

      if (remotePayload && (!localHasData || remoteIsNewer)) {
        applyRemotePayload(remotePayload)
      }

      const localIsNewer =
        localHasData &&
        !!localUpdatedAt &&
        (!remoteUpdatedAt || localUpdatedAt > remoteUpdatedAt)
      const shouldSeedRemote = !remotePayload && localHasData
      if (localIsNewer || shouldSeedRemote) {
        await popSyncRemote.upsertState(
          localSnapshot,
          buildTrackingPayloads(localSnapshot),
        )
      }
      ensureRemoteSync()
    } finally {
      setSyncReady(true)
      syncInFlightRef.current = false
    }
  }

  useEffect(() => {
    void syncFromRemote()
  }, [])

  useEffect(() => {
    if (!syncReady) {
      return
    }
    const SYNC_POLL_MS = 10000
    const interval = setInterval(() => {
      void syncFromRemote()
    }, SYNC_POLL_MS)
    return () => clearInterval(interval)
  }, [syncReady])

  const resetSession = (message?: string) => {
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = null
    }
    setView('pin')
    setCurrentEmployee(null)
    setPresenceNote('')
    setSearch('')
    setSelectedOrderId(null)
    setProductionStep('select')
    setProductionForm(createEmptyProductionForm())
    setConfirmation(null)
    setFormStatus(null)
    setPinNotice(message ?? null)
  }

  const handlePresenceLog = (type: PresenceLogType) => {
    if (!currentEmployee) {
      return
    }
    setFormStatus(null)
    const payload = dataService.getAll()
    const now = new Date().toISOString()
    const date = now.slice(0, 10)
    payload.presenceLogs = [
      ...payload.presenceLogs,
      {
        id: createId(),
        employeeId: currentEmployee.id,
        type,
        timestamp: now,
        deviceId: deviceIdRef.current,
        notes: presenceNote.trim() || undefined,
        createdAt: now,
        createdByEmployeeId: currentEmployee.id,
      },
    ]
    const existingIndex = payload.presencas.findIndex(
      (entry) => entry.employeeId === currentEmployee.id && entry.date === date,
    )
    if (existingIndex >= 0) {
      const existing = payload.presencas[existingIndex]
      payload.presencas[existingIndex] = {
        ...existing,
        status: existing.status || 'presente',
        createdAt: existing.createdAt || now,
      }
    } else {
      payload.presencas = [
        ...payload.presencas,
        {
          id: createId(),
          employeeId: currentEmployee.id,
          date,
          status: 'presente',
          createdAt: now,
        },
      ]
    }

    dataService.replaceAll(payload)
    refresh()
    setPresenceNote('')
    setConfirmation('Ponto registrado.')
    setView('confirm')
    confirmTimerRef.current = setTimeout(() => {
      resetSession()
    }, 1400)
  }

  const resolveBreakLabel = () => {
    if (!currentEmployee) {
      return { label: 'Intervalo', type: 'BREAK_IN' as PresenceLogType }
    }
    const last = [...data.presenceLogs]
      .filter((entry) => entry.employeeId === currentEmployee.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
    if (last?.type === 'BREAK_IN') {
      return { label: 'Fim do intervalo', type: 'BREAK_OUT' as PresenceLogType }
    }
    return { label: 'Inicio do intervalo', type: 'BREAK_IN' as PresenceLogType }
  }

  const resolveOrderLabel = (order: ProductionOrder) => {
    const product = productsById.get(order.productId)
    const variant = product?.variants?.find((item) => item.id === order.variantId)
    const pedido = ordersById.get(order.orderId)
    const orderCode = pedido ? resolveOrderInternalCode(pedido) : ''
    const code = order.code || order.id.slice(0, 6).toUpperCase()
    const variantLabel = variant ? ` - ${variant.name}` : ''
    return {
      code: `OP ${code}`,
      title: `${product?.name ?? 'Produto'}${variantLabel}`,
      orderCode: orderCode ? `Pedido ${orderCode}` : '',
    }
  }

  const resolveOrderProgress = (order: ProductionOrder) => {
    const product = productsById.get(order.productId)
    const isLinear = product?.unit === 'metro_linear'
    const plannedQty = Number.isFinite(order.plannedQty)
      ? order.plannedQty ?? 0
      : order.quantity
    const lengthM =
      Number.isFinite(order.plannedLengthM) && order.plannedLengthM
        ? order.plannedLengthM
        : Number.isFinite(order.customLength)
          ? order.customLength
          : product?.length ?? 0
    const producedQty = Number.isFinite(order.producedQty) ? order.producedQty ?? 0 : 0
    const producedLength = Number.isFinite(order.producedLengthM)
      ? order.producedLengthM ?? 0
      : 0
    const plannedTotal = isLinear ? plannedQty * (lengthM || 0) : plannedQty
    const producedTotal = isLinear ? producedLength : producedQty
    const remaining = Math.max(0, plannedTotal - producedTotal)
    return {
      planned: plannedTotal,
      produced: producedTotal,
      remaining,
      unit: isLinear ? 'm' : 'un',
      lengthM: isLinear ? lengthM : undefined,
      isLinear,
    }
  }

  const handleSelectOrder = (order: ProductionOrder) => {
    const progress = resolveOrderProgress(order)
    setSelectedOrderId(order.id)
    setProductionForm({
      quantity: 1,
      lengthM: progress.lengthM ?? 0,
      scrapQuantity: 0,
      scrapLengthM: 0,
      notes: '',
    })
    setProductionStep('form')
  }

  const handleProductionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentEmployee || !selectedOrderId) {
      return
    }
    setFormStatus(null)
    const order = data.ordensProducao.find((item) => item.id === selectedOrderId)
    if (!order) {
      return
    }
    const product = productsById.get(order.productId)
    const isLinear = product?.unit === 'metro_linear'
    const quantity = Number(productionForm.quantity)
    const lengthM = Number(productionForm.lengthM)
    const scrapQuantity = Number(productionForm.scrapQuantity)
    const scrapLengthM = Number(productionForm.scrapLengthM)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormStatus('Quantidade invalida.')
      return
    }
    if (isLinear && (!Number.isFinite(lengthM) || lengthM <= 0)) {
      setFormStatus('Informe o comprimento.')
      return
    }
    const now = new Date().toISOString()
    const entry = {
      id: createId(),
      productionOrderId: order.id,
      employeeId: currentEmployee.id,
      date: now.slice(0, 10),
      quantity,
      lengthM: isLinear ? lengthM : undefined,
      scrapQuantity: Number.isFinite(scrapQuantity) && scrapQuantity > 0 ? scrapQuantity : undefined,
      scrapLengthM:
        isLinear && Number.isFinite(scrapLengthM) && scrapLengthM > 0
          ? scrapLengthM
          : undefined,
      notes: productionForm.notes.trim() || undefined,
      createdAt: now,
      createdByEmployeeId: currentEmployee.id,
      deviceId: deviceIdRef.current,
    }
    const payload = dataService.getAll()
    payload.productionEntries = [...payload.productionEntries, entry]
    dataService.replaceAll(payload)
    refresh()
    setConfirmation('Apontamento registrado.')
    setView('confirm')
    confirmTimerRef.current = setTimeout(() => {
      resetSession()
    }, 1400)
  }

  const resolveSearch = (value: string) => value.trim().toLowerCase()
  const filteredOrders = useMemo(() => {
    const term = resolveSearch(search)
    if (!term) {
      return availableOrders
    }
    return availableOrders.filter((order) => {
      const product = productsById.get(order.productId)
      const pedido = ordersById.get(order.orderId)
      const code = order.code?.toLowerCase() ?? ''
      const orderCode = pedido ? resolveOrderInternalCode(pedido).toLowerCase() : ''
      const productName = product?.name.toLowerCase() ?? ''
      return (
        code.includes(term) ||
        orderCode.includes(term) ||
        productName.includes(term)
      )
    })
  }, [availableOrders, ordersById, productsById, search])

  useEffect(() => {
    if (view === 'pin') {
      return
    }
    const handlePointer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      idleTimerRef.current = setTimeout(() => {
        resetSession('Sessao expirada. Digite o PIN novamente.')
      }, IDLE_TIMEOUT_MS)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', handlePointer)
      window.addEventListener('keydown', handlePointer)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', handlePointer)
        window.removeEventListener('keydown', handlePointer)
      }
    }
  }, [view])

  const hasLocalData = hasMeaningfulData(data)
  const resolvedPinNotice =
    pinNotice ?? syncError ?? (!syncReady ? 'Sincronizando dados do ERP...' : null)
  const isPinDisabled = !syncReady || (!hasLocalData && !!syncError)
  const breakAction = resolveBreakLabel()

  if (view === 'pin') {
    return (
      <Login
        variant="pin"
        className="pop-login"
        pinNotice={resolvedPinNotice}
        pinDisabled={isPinDisabled}
        onPinLogin={(employee) => {
          setCurrentEmployee(employee)
          setFormStatus(null)
          setPinNotice(null)
          setView('menu')
        }}
      />
    )
  }

  return (
    <main className="pop-app">
      <header className="pop-header">
        <img className="pop-logo" src={logotipo} alt="Umoya" />
        <span className="login__app-badge pop-badge">POP</span>
      </header>

      {view === 'menu' && currentEmployee && (
        <section className="pop-panel">
          <div className="pop-employee">
            <div className="pop-avatar">
              <span>{currentEmployee.name.slice(0, 1).toUpperCase()}</span>
            </div>
            <div>
              <p className="pop-employee__name">{currentEmployee.name}</p>
              <p className="pop-employee__meta">Escolha uma acao</p>
            </div>
          </div>
          <div className="pop-actions">
            <button
              type="button"
              className="pop-action"
              onClick={() => {
                setView('presence')
                setFormStatus(null)
              }}
            >
              Bater ponto
            </button>
            <button
              type="button"
              className="pop-action"
              onClick={() => {
                setView('production')
                setProductionStep('select')
                setFormStatus(null)
              }}
            >
              Registrar producao
            </button>
            <button
              type="button"
              className="pop-action pop-action--ghost"
              onClick={() => resetSession()}
            >
              Trocar usuario
            </button>
          </div>
        </section>
      )}

      {view === 'presence' && currentEmployee && (
        <section className="pop-panel">
          <div className="pop-panel__header">
            <button
              type="button"
              className="pop-back"
              onClick={() => setView('menu')}
            >
              Voltar
            </button>
            <span className="pop-panel__title">Bater ponto</span>
          </div>
          <div className="pop-actions">
            <button
              type="button"
              className="pop-action pop-action--primary"
              onClick={() => handlePresenceLog('IN')}
            >
              Entrada
            </button>
            <button
              type="button"
              className="pop-action pop-action--primary"
              onClick={() => handlePresenceLog('OUT')}
            >
              Saida
            </button>
            <button
              type="button"
              className="pop-action pop-action--ghost"
              onClick={() => handlePresenceLog(breakAction.type)}
            >
              {breakAction.label}
            </button>
          </div>
          <label className="pop-label" htmlFor="presence-notes">
            Observacao (opcional)
          </label>
          <input
            id="presence-notes"
            className="pop-input"
            type="text"
            value={presenceNote}
            onChange={(event) => setPresenceNote(event.target.value)}
            placeholder="Ex: atraso, motivo, etc"
          />
          {formStatus && (
            <p className="pop-status pop-status--alert">{formStatus}</p>
          )}
        </section>
      )}

      {view === 'production' && currentEmployee && (
        <section className="pop-panel">
          <div className="pop-panel__header">
            <button
              type="button"
              className="pop-back"
              onClick={() => {
                if (productionStep === 'form') {
                  setProductionStep('select')
                  setSelectedOrderId(null)
                  return
                }
                setView('menu')
              }}
            >
              Voltar
            </button>
            <span className="pop-panel__title">Apontamento</span>
          </div>

          {productionStep === 'select' && (
            <>
              <input
                className="pop-input"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por codigo ou produto"
              />
              <div className="pop-list">
                {filteredOrders.length === 0 && (
                  <p className="pop-status">Nenhuma OP aberta.</p>
                )}
                {filteredOrders.map((order) => {
                  const label = resolveOrderLabel(order)
                  const progress = resolveOrderProgress(order)
                  return (
                    <button
                      key={order.id}
                      type="button"
                      className="pop-card"
                      onClick={() => handleSelectOrder(order)}
                    >
                      <div className="pop-card__title">{label.code}</div>
                      <div className="pop-card__subtitle">{label.title}</div>
                      {label.orderCode && (
                        <div className="pop-card__meta">{label.orderCode}</div>
                      )}
                      <div className="pop-card__progress">
                        Planejado {formatNumber(progress.planned)} {progress.unit} · Produzido{' '}
                        {formatNumber(progress.produced)} {progress.unit} · Faltam{' '}
                        {formatNumber(progress.remaining)} {progress.unit}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {productionStep === 'form' && selectedOrderId && (
            <form className="pop-form" onSubmit={handleProductionSubmit}>
              {(() => {
                const order = data.ordensProducao.find(
                  (item) => item.id === selectedOrderId,
                )
                if (!order) {
                  return <p className="pop-status">OP nao encontrada.</p>
                }
                const label = resolveOrderLabel(order)
                const progress = resolveOrderProgress(order)
                return (
                  <>
                    <div className="pop-card pop-card--plain">
                      <div className="pop-card__title">{label.code}</div>
                      <div className="pop-card__subtitle">{label.title}</div>
                      {label.orderCode && (
                        <div className="pop-card__meta">{label.orderCode}</div>
                      )}
                      <div className="pop-card__progress">
                        Planejado {formatNumber(progress.planned)} {progress.unit} · Produzido{' '}
                        {formatNumber(progress.produced)} {progress.unit}
                      </div>
                    </div>
                    {formStatus && (
                      <p className="pop-status pop-status--alert">
                        {formStatus}
                      </p>
                    )}
                    <label className="pop-label" htmlFor="production-qty">
                      Quantidade
                    </label>
                    <input
                      id="production-qty"
                      className="pop-input"
                      type="number"
                      min={0}
                      step={1}
                      value={productionForm.quantity}
                      onChange={(event) =>
                        setProductionForm((prev) => ({
                          ...prev,
                          quantity: Number(event.target.value),
                        }))
                      }
                    />
                    {progress.isLinear && (
                      <>
                        <label className="pop-label" htmlFor="production-length">
                          Comprimento (m)
                        </label>
                        <input
                          id="production-length"
                          className="pop-input"
                          type="number"
                          min={0}
                          step={0.01}
                          value={productionForm.lengthM}
                          onChange={(event) =>
                            setProductionForm((prev) => ({
                              ...prev,
                              lengthM: Number(event.target.value),
                            }))
                          }
                        />
                      </>
                    )}
                    <div className="pop-row">
                      <div>
                        <label className="pop-label" htmlFor="production-scrap">
                          Refugo (qtde)
                        </label>
                        <input
                          id="production-scrap"
                          className="pop-input"
                          type="number"
                          min={0}
                          step={1}
                          value={productionForm.scrapQuantity}
                          onChange={(event) =>
                            setProductionForm((prev) => ({
                              ...prev,
                              scrapQuantity: Number(event.target.value),
                            }))
                          }
                        />
                      </div>
                      {progress.isLinear && (
                        <div>
                          <label className="pop-label" htmlFor="production-scrap-m">
                            Refugo (m)
                          </label>
                          <input
                            id="production-scrap-m"
                            className="pop-input"
                            type="number"
                            min={0}
                            step={0.01}
                            value={productionForm.scrapLengthM}
                            onChange={(event) =>
                              setProductionForm((prev) => ({
                                ...prev,
                                scrapLengthM: Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>
                    <label className="pop-label" htmlFor="production-notes">
                      Observacao (opcional)
                    </label>
                    <input
                      id="production-notes"
                      className="pop-input"
                      type="text"
                      value={productionForm.notes}
                      onChange={(event) =>
                        setProductionForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      placeholder="Ex: retrabalho, ajuste, etc"
                    />
                    <button type="submit" className="pop-action pop-action--primary">
                      Salvar apontamento
                    </button>
                  </>
                )
              })()}
            </form>
          )}
        </section>
      )}

      {view === 'confirm' && (
        <section className="pop-panel pop-panel--confirm">
          <div className="pop-confirm">
            <div className="pop-confirm__icon">OK</div>
            <p>{confirmation ?? 'Registro concluido.'}</p>
            <small>Voltando para o PIN...</small>
          </div>
        </section>
      )}
    </main>
  )
}

export default PopApp
