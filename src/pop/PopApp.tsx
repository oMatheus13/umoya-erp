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
  WorkLog,
} from '../types/erp'
import { resolveDeviceId } from '../utils/device'
import { syncOpenEmployeePayment } from '../utils/employeePayments'
import { createId } from '../utils/ids'
import { resolveOrderInternalCode } from '../utils/orderCode'
import { hashPin } from '../utils/pin'

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
const DEV_EMPLOYEE_ID = 'dev-pop'
const DEV_EMPLOYEE_NAME = 'Dev POP'
const DEV_EMPLOYEE_PIN = '0000'

const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)

const toCentimeters = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value * 100) : 0

const buildDimensionLabel = (values: number[]) => {
  const filtered = values.filter((value) => Number.isFinite(value) && value > 0)
  if (filtered.length === 0) {
    return ''
  }
  const label = filtered.map((value) => formatNumber(toCentimeters(value))).join(' x ')
  return `${label} cm`
}

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
  const allowDevMode =
    (import.meta.env && import.meta.env.DEV) || import.meta.env.VITE_DEV_ACCESS === 'true'
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
  const devEmployeeRef = useRef<Employee | null>(null)

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

  const ensureDevEmployee = async () => {
    if (devEmployeeRef.current) {
      return devEmployeeRef.current
    }
    const payload = dataService.getAll()
    const existingIndex = payload.funcionarios.findIndex(
      (employee) => employee.id === DEV_EMPLOYEE_ID,
    )
    const existing = existingIndex >= 0 ? payload.funcionarios[existingIndex] : null
    if (existing?.pinHash) {
      devEmployeeRef.current = existing
      return existing
    }
    const pinHash = await hashPin(DEV_EMPLOYEE_PIN)
    const nextEmployee: Employee = {
      id: DEV_EMPLOYEE_ID,
      name: existing?.name ?? DEV_EMPLOYEE_NAME,
      pinHash,
      roleId: existing?.roleId,
      levelId: existing?.levelId,
      cpf: existing?.cpf,
      active: existing?.active ?? true,
      isActive: existing?.isActive ?? true,
      hiredAt: existing?.hiredAt,
    }
    if (existingIndex >= 0) {
      payload.funcionarios[existingIndex] = nextEmployee
    } else {
      payload.funcionarios = [...payload.funcionarios, nextEmployee]
    }
    dataService.replaceAll(payload)
    refresh()
    devEmployeeRef.current = nextEmployee
    return nextEmployee
  }

  const handleDevPinLogin = async () => {
    if (!allowDevMode) {
      return
    }
    const employee = await ensureDevEmployee()
    if (!employee) {
      setPinNotice('Nao foi possivel iniciar o modo dev.')
      return
    }
    setCurrentEmployee(employee)
    setFormStatus(null)
    setPinNotice(null)
    setView('menu')
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
    const linkedOrderId = order.linkedOrderId ?? order.orderId
    const pedido = ordersById.get(linkedOrderId)
    const orderCode = pedido ? resolveOrderInternalCode(pedido) : ''
    const clientName = pedido
      ? data.clientes.find((client) => client.id === pedido.clientId)?.name ?? ''
      : ''
    const code = order.code || order.id.slice(0, 6).toUpperCase()
    const variantLabel = variant ? ` - ${variant.name}` : ''
    return {
      code: `OP ${code}`,
      title: `${product?.name ?? 'Produto'}${variantLabel}`,
      orderCode: orderCode ? `Pedido ${orderCode}` : '',
      clientName,
    }
  }

  const resolveOrderProgress = (order: ProductionOrder) => {
    const product = productsById.get(order.productId)
    const variant = product?.variants?.find((item) => item.id === order.variantId)
    const isLinear = product?.unit === 'metro_linear'
    const plannedQty = Number.isFinite(order.plannedQty)
      ? order.plannedQty ?? 0
      : order.quantity
    const lengthM = (() => {
      if (Number.isFinite(order.plannedLengthM) && order.plannedLengthM) {
        return order.plannedLengthM ?? 0
      }
      if (Number.isFinite(order.customLength) && order.customLength) {
        return order.customLength ?? 0
      }
      return product?.length ?? 0
    })()
    const producedQty = Number.isFinite(order.producedQty) ? order.producedQty ?? 0 : 0
    const remainingQty = Math.max(0, plannedQty - producedQty)
    const sizeLabel = isLinear
      ? buildDimensionLabel([lengthM])
      : buildDimensionLabel([
          variant?.length ?? product?.length ?? 0,
          variant?.width ?? product?.width ?? 0,
          variant?.height ?? product?.height ?? 0,
        ])
    return {
      plannedQty,
      producedQty,
      remainingQty,
      sizeLabel,
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
    if (!product) {
      setFormStatus('Produto nao encontrado.')
      return
    }
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
    const unitLaborCost = product.laborCost ?? 0
    if (unitLaborCost <= 0) {
      setFormStatus('Defina a mao de obra do produto antes de registrar a producao.')
      return
    }
    const netQuantity =
      Number.isFinite(scrapQuantity) && scrapQuantity > 0
        ? Math.max(0, quantity - scrapQuantity)
        : quantity
    const laborBasis = product.laborBasis ?? 'unidade'
    let laborQuantity = netQuantity
    if (laborBasis === 'metro') {
      const variant = product.variants?.find((item) => item.id === order.variantId)
      const resolvedLength = isLinear
        ? lengthM
        : variant?.length ?? product.length ?? 0
      if (!Number.isFinite(resolvedLength) || resolvedLength <= 0) {
        setFormStatus(
          'Defina o comprimento da variacao ou do produto para calcular por metro.',
        )
        return
      }
      laborQuantity = netQuantity * resolvedLength
    }
    const totalPay = laborQuantity * unitLaborCost
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
    if (netQuantity > 0) {
      const workLog: WorkLog = {
        id: createId(),
        employeeId: currentEmployee.id,
        productId: order.productId,
        variantId: order.variantId,
        quantity: netQuantity,
        workDate: entry.date,
        createdAt: now,
        unitLaborCost,
        totalPay,
      }
      payload.apontamentos = [...payload.apontamentos, workLog]
      syncOpenEmployeePayment(payload, currentEmployee.id)
    }
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
      const linkedOrderId = order.linkedOrderId ?? order.orderId
      const pedido = ordersById.get(linkedOrderId)
      const clientName = pedido
        ? data.clientes.find((client) => client.id === pedido.clientId)?.name.toLowerCase() ?? ''
        : ''
      const code = order.code?.toLowerCase() ?? ''
      const orderCode = pedido ? resolveOrderInternalCode(pedido).toLowerCase() : ''
      const productName = product?.name.toLowerCase() ?? ''
      return (
        code.includes(term) ||
        orderCode.includes(term) ||
        productName.includes(term) ||
        clientName.includes(term)
      )
    })
  }, [availableOrders, data.clientes, ordersById, productsById, search])

  const groupedOrders = useMemo(() => {
    const groups: {
      id: string
      title: string
      meta?: string
      orders: ProductionOrder[]
    }[] = []
    const indexById = new Map<string, number>()
    filteredOrders.forEach((order) => {
      const groupId = order.linkedOrderId ?? order.orderId
      let index = indexById.get(groupId)
      if (index === undefined) {
        const pedido = ordersById.get(groupId)
        const orderCode = pedido ? resolveOrderInternalCode(pedido) : groupId.slice(0, 6)
        const clientName = pedido
          ? data.clientes.find((client) => client.id === pedido.clientId)?.name ?? ''
          : ''
        const title = pedido
          ? `Pedido #${orderCode}`
          : order.source === 'estoque'
            ? 'Estoque interno'
            : `Pedido #${orderCode}`
        const meta = clientName
          ? `Cliente: ${clientName}`
          : order.source === 'estoque'
            ? 'Ordem de estoque'
            : undefined
        index = groups.length
        indexById.set(groupId, index)
        groups.push({ id: groupId, title, meta, orders: [] })
      }
      groups[index].orders.push(order)
    })
    return groups
  }, [data.clientes, filteredOrders, ordersById])

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
        onPinDevLogin={allowDevMode ? () => void handleDevPinLogin() : undefined}
        pinDevLabel="Dev"
        pinBeep
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
                {groupedOrders.length === 0 && (
                  <p className="pop-status">Nenhuma OP aberta.</p>
                )}
                {groupedOrders.map((group) => (
                  <div key={group.id} className="pop-group">
                    <div className="pop-group__header">
                      <div className="pop-group__title">{group.title}</div>
                      {group.meta && <div className="pop-group__meta">{group.meta}</div>}
                      <div className="pop-group__meta">
                        Itens: {group.orders.length}
                      </div>
                    </div>
                    <div className="pop-group__orders">
                      {group.orders.map((order) => {
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
                            {label.clientName && (
                              <div className="pop-card__meta">Cliente: {label.clientName}</div>
                            )}
                            {progress.sizeLabel && (
                              <div className="pop-card__meta">Tamanho: {progress.sizeLabel}</div>
                            )}
                            <div className="pop-card__progress">
                              Qtde {formatNumber(progress.plannedQty)} un · Produzido{' '}
                              {formatNumber(progress.producedQty)} un · Faltam{' '}
                              {formatNumber(progress.remainingQty)} un
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
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
                      {label.clientName && (
                        <div className="pop-card__meta">Cliente: {label.clientName}</div>
                      )}
                      {progress.sizeLabel && (
                        <div className="pop-card__meta">Tamanho: {progress.sizeLabel}</div>
                      )}
                      <div className="pop-card__progress">
                        Qtde {formatNumber(progress.plannedQty)} un · Produzido{' '}
                        {formatNumber(progress.producedQty)} un
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
