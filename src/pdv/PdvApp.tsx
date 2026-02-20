import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import Modal from '../components/Modal'
import Topbar, { type TopbarSearchItem, type TopbarSearchItemInput } from '../components/Topbar'
import logotipo from '../assets/brand/logotipo.svg'
import Login from '../pages/core/Login'
import ResetPassword from '../pages/core/ResetPassword'
import { erpRemote } from '../services/erpRemote'
import { dataService, ensureStorageSeed, setRemoteSync } from '../services/dataService'
import { trackingRemote } from '../services/trackingRemote'
import { buildTrackingPayloads } from '../services/trackingPayload'
import { createDevSeed, DEV_BACKUP_KEY, DEV_MODE_KEY, DEV_SEEDED_KEY } from '../services/devSeed'
import { supabase } from '../services/supabaseClient'
import { createSignedAvatarUrl } from '../services/storageFiles'
import { useERPData } from '../store/appStore'
import type { ERPData, UserAccount } from '../types/erp'
import { sanitizeAvatarUrl } from '../utils/avatar'
import { createId } from '../utils/ids'
import { resolveOrderInternalCode } from '../utils/orderCode'
import { formatSkuWithVariant } from '../utils/sku'
import PdvCash from './screens/PdvCash'
import PdvCheckout from './screens/PdvCheckout'
import PdvHistory from './screens/PdvHistory'
import PdvOrders from './screens/PdvOrders'
import PdvQuotes from './screens/PdvQuotes'

type PdvMode =
  | 'venda'
  | 'orcamento'
  | 'orcamentos'
  | 'pedidos'
  | 'caixa'
  | 'historico'

type PdvSearchTarget = 'orcamentos' | 'pedidos'

type PendingOpenItem = {
  target: PdvSearchTarget
  id: string
}

type PendingAddItem = {
  targetMode: 'venda' | 'orcamento'
  productId: string
  variantId?: string
}

type ModeConfig = {
  id: PdvMode
  label: string
  icon: string
}

const modes: ModeConfig[] = [
  { id: 'venda', label: 'Venda', icon: 'point_of_sale' },
  { id: 'orcamento', label: 'Orcamento rapido', icon: 'description' },
  { id: 'orcamentos', label: 'Orcamentos', icon: 'task' },
  { id: 'pedidos', label: 'Pedidos', icon: 'inventory_2' },
  { id: 'caixa', label: 'Caixa', icon: 'account_balance_wallet' },
  { id: 'historico', label: 'Historico', icon: 'history' },
]

const COMPACT_QUERY = '(max-width: 1024px)'

const resolveRecoveryMode = () => {
  if (typeof window === 'undefined') {
    return false
  }
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('type') === 'recovery'
}

const resolveDisplayName = (user: UserAccount) =>
  user.displayName?.trim() || user.name?.trim() || user.email || 'Usuario'

const resolveSyncId = (user: User) =>
  (user.user_metadata?.workspace_id as string | undefined) ?? user.id

const createDevAccount = (): UserAccount => ({
  id: 'dev-user',
  name: 'Dev Umoya',
  displayName: 'Dev',
  email: 'dev@umoya.local',
  createdAt: new Date().toISOString(),
  role: 'admin',
  active: true,
})

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

const shouldBackup = () => {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    const raw = window.localStorage.getItem('umoya_last_backup_at')
    const last = raw ? Number(raw) : 0
    const now = Date.now()
    if (Number.isFinite(last) && now - last < 1000 * 60 * 60) {
      return false
    }
    window.localStorage.setItem('umoya_last_backup_at', String(now))
    return true
  } catch {
    return false
  }
}

const runBackup = async (syncId: string, payload: ERPData) => {
  if (shouldBackup()) {
    await erpRemote.backupState(syncId, payload)
  }
}

const fetchRemoteState = async (syncId: string) => {
  type RemoteState = Awaited<ReturnType<typeof erpRemote.fetchState>>
  const timeout = new Promise<RemoteState>((resolve) => {
    setTimeout(() => resolve({ data: null, error: 'timeout' }), 8000)
  })
  return Promise.race<RemoteState>([erpRemote.fetchState(syncId), timeout])
}

const createRemoteSync = (syncId: string) => {
  const SYNC_DEBOUNCE_MS = 400
  let pending: ERPData | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = async () => {
    if (!pending) {
      return
    }
    const payload = pending
    pending = null
    const result = await erpRemote.upsertState(syncId, payload)
    if (!result.error) {
      await runBackup(syncId, payload)
      await trackingRemote.upsertOrders(syncId, buildTrackingPayloads(payload))
    }
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

const resolveDevMode = (allowDevMode: boolean) => {
  if (!allowDevMode || typeof window === 'undefined') {
    return false
  }
  return window.localStorage.getItem(DEV_MODE_KEY) === 'true'
}

const PdvApp = () => {
  const allowDevMode =
    (import.meta.env && import.meta.env.DEV) || import.meta.env.VITE_DEV_ACCESS === 'true'
  const initialDevMode = resolveDevMode(allowDevMode)
  const { data, refresh } = useERPData()
  const [mode, setMode] = useState<PdvMode>('venda')
  const [pendingOpen, setPendingOpen] = useState<PendingOpenItem | null>(null)
  const [isRecoveryMode, setIsRecoveryMode] = useState(resolveRecoveryMode)
  const [syncId, setSyncId] = useState<string | null>(null)
  const [isDevMode, setIsDevMode] = useState(initialDevMode)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() =>
    initialDevMode ? createDevAccount() : null,
  )
  const [isAuthenticated, setIsAuthenticated] = useState(initialDevMode)
  const [isSensitiveHidden, setIsSensitiveHidden] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem('umoya_sensitive_hidden') === 'true'
  })
  const [isQuickCashOpen, setIsQuickCashOpen] = useState(false)
  const [quickCashBalance, setQuickCashBalance] = useState(0)
  const [pendingAdd, setPendingAdd] = useState<PendingAddItem | null>(null)
  const [mobileModal, setMobileModal] = useState<PdvMode | null>(null)
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.matchMedia(COMPACT_QUERY).matches
  })
  const syncHandlerRef = useRef<((data: ERPData) => void) | null>(null)

  useEffect(() => {
    ensureStorageSeed()
    if (!allowDevMode || !isDevMode || typeof window === 'undefined') {
      return
    }
    const backup = window.localStorage.getItem(DEV_BACKUP_KEY)
    if (!backup) {
      window.localStorage.setItem(DEV_BACKUP_KEY, JSON.stringify(dataService.getAll()))
    }
    const seeded = window.localStorage.getItem(DEV_SEEDED_KEY) === 'true'
    if (!seeded) {
      dataService.replaceAll(createDevSeed('dev-user'))
      window.localStorage.setItem(DEV_SEEDED_KEY, 'true')
    }
  }, [allowDevMode, isDevMode])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const media = window.matchMedia(COMPACT_QUERY)
    const handleChange = () => setIsCompact(media.matches)
    handleChange()
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.sensitiveHidden = isSensitiveHidden ? 'true' : 'false'
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'umoya_sensitive_hidden',
        isSensitiveHidden ? 'true' : 'false',
      )
    }
  }, [isSensitiveHidden])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    const roots = Array.from(
      document.querySelectorAll<HTMLElement>('.pdv, .modal'),
    )
    if (roots.length === 0) {
      return
    }
    const clear = () => {
      roots.forEach((root) => {
        root
          .querySelectorAll('.sensitive-blur')
          .forEach((node) => node.classList.remove('sensitive-blur'))
      })
    }
    if (!isSensitiveHidden) {
      clear()
      return
    }
    const mark = () => {
      clear()
      roots.forEach((root) => {
        const nodes = root.querySelectorAll<HTMLElement>(
          'td, th, span, strong, p, div, li, small, label',
        )
        nodes.forEach((node) => {
          if (node.children.length > 0) {
            return
          }
          if (node.textContent?.includes('R$')) {
            node.classList.add('sensitive-blur')
          }
        })
      })
    }
    const id = window.requestAnimationFrame(mark)
    return () => window.cancelAnimationFrame(id)
  }, [isSensitiveHidden, mode, mobileModal])

  useEffect(() => {
    if (!isCompact) {
      setMobileModal(null)
    }
  }, [isCompact])

  const startSession = async (user: User) => {
    setRemoteSync(null)
    syncHandlerRef.current = null
    const resolvedSyncId = resolveSyncId(user)
    setSyncId(resolvedSyncId)

    const localSnapshot = dataService.getAll()
    const localHasData = hasMeaningfulData(localSnapshot)
    const remote = await fetchRemoteState(resolvedSyncId)
    const remoteError = !!remote.error
    const remotePayload = remote.data
    const remoteUpdatedAt = resolveUpdatedAt(remotePayload, remote.updatedAt)
    const localUpdatedAt = resolveUpdatedAt(localSnapshot)
    const remoteIsNewer =
      !!remotePayload &&
      !!remoteUpdatedAt &&
      (!localUpdatedAt || remoteUpdatedAt > localUpdatedAt)

    if (remotePayload && (!localHasData || remoteIsNewer)) {
      dataService.replaceAll(remotePayload, { touchMeta: false, skipSync: true })
    }

    const payload = dataService.getAll()
    const existing = payload.usuarios.find((item) => item.id === user.id)
    const metadataName = user.user_metadata?.name as string | undefined
    const metadataDisplayName = (user.user_metadata?.displayName ||
      user.user_metadata?.display_name) as string | undefined
    const fallbackName = existing?.name ?? metadataName ?? user.email ?? 'Usuario'
    const metadataCpf = user.user_metadata?.cpf as string | undefined
    const metadataRole = user.user_metadata?.role as UserAccount['role'] | undefined
    const metadataPhone = user.user_metadata?.phone as string | undefined
    const metadataAvatarColor = user.user_metadata?.avatarColor as string | undefined
    const metadataAvatarUrl = sanitizeAvatarUrl(
      user.user_metadata?.avatarUrl as string | undefined,
    )
    const metadataAvatarPath = (user.user_metadata?.avatarPath ||
      user.user_metadata?.avatar_path) as string | undefined
    const hasAdmin = payload.usuarios.some((item) => item.role === 'admin')
    const resolvedRole =
      existing?.role ?? metadataRole ?? (hasAdmin ? 'funcionario' : 'admin')
    const resolvedCpf = existing?.cpf ?? metadataCpf
    const resolvedAvatarPath = existing?.avatarPath ?? metadataAvatarPath
    let resolvedAvatarUrl = sanitizeAvatarUrl(existing?.avatarUrl) ?? metadataAvatarUrl
    if (resolvedAvatarPath) {
      const signed = await createSignedAvatarUrl(resolvedAvatarPath)
      if (signed.url) {
        resolvedAvatarUrl = signed.url
      }
    }
    const nextUser: UserAccount = {
      id: user.id,
      name: fallbackName,
      displayName: existing?.displayName ?? metadataDisplayName,
      email: user.email ?? existing?.email ?? '',
      cpf: resolvedCpf,
      phone: existing?.phone ?? metadataPhone,
      avatarColor: existing?.avatarColor ?? metadataAvatarColor,
      avatarUrl: resolvedAvatarUrl,
      avatarPath: resolvedAvatarPath,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      active: existing?.active ?? true,
      role: resolvedRole,
    }
    const { avatarUrl: _avatarUrl, ...payloadUser } = nextUser
    void _avatarUrl

    const metaChanged = payload.meta?.workspaceId !== resolvedSyncId
    if (metaChanged) {
      payload.meta = { ...payload.meta, workspaceId: resolvedSyncId }
    }

    const shouldUpdate =
      !existing ||
      existing.name !== nextUser.name ||
      existing.email !== nextUser.email ||
      existing.cpf !== nextUser.cpf ||
      existing.role !== nextUser.role ||
      existing.displayName !== nextUser.displayName ||
      existing.phone !== nextUser.phone ||
      existing.avatarColor !== nextUser.avatarColor ||
      existing.avatarUrl !== nextUser.avatarUrl ||
      existing.avatarPath !== nextUser.avatarPath ||
      metaChanged

    if (shouldUpdate) {
      payload.usuarios = existing
        ? payload.usuarios.map((item) => (item.id === user.id ? payloadUser : item))
        : [...payload.usuarios, payloadUser]
      dataService.replaceAll(payload)
    }

    if (!user.user_metadata?.workspace_id && supabase) {
      void supabase.auth.updateUser({ data: { workspace_id: resolvedSyncId } })
    }

    const localIsNewer =
      localHasData &&
      !!localUpdatedAt &&
      (!remoteUpdatedAt || localUpdatedAt > remoteUpdatedAt)
    const shouldSeedRemote = !remoteError && !remotePayload && localHasData
    const shouldPushLocal = !remoteError && (shouldSeedRemote || localIsNewer || shouldUpdate)

    if (!remoteError) {
      const handler = createRemoteSync(resolvedSyncId)
      syncHandlerRef.current = handler
      setRemoteSync(handler)
    }

    if (shouldPushLocal) {
      const latest = dataService.getAll()
      await erpRemote.upsertState(resolvedSyncId, latest)
      await runBackup(resolvedSyncId, latest)
    }
    if (!remoteError) {
      const latest = dataService.getAll()
      void trackingRemote.upsertOrders(resolvedSyncId, buildTrackingPayloads(latest))
    }

    setCurrentUser(nextUser)
    setIsAuthenticated(true)
  }

  useEffect(() => {
    if (isDevMode) {
      return
    }
    if (!supabase) {
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (user && !isRecoveryMode) {
        void startSession(user)
      }
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      if (!user || isRecoveryMode) {
        setCurrentUser(null)
        setIsAuthenticated(false)
        return
      }
      void startSession(user)
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [isDevMode, isRecoveryMode])

  useEffect(() => {
    if (!isAuthenticated || !currentUser || !syncId) {
      return
    }
    const supabaseClient = supabase
    if (!supabaseClient) {
      return
    }
    if (currentUser.id === 'dev-user') {
      return
    }
    const channel = supabaseClient
      .channel(`erp_states_${syncId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'erp_states',
          filter: `user_id=eq.${syncId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            return
          }
          const row =
            (payload.new as { payload?: ERPData; updated_at?: string | null } | null) ??
            null
          const remotePayload = (row?.payload as ERPData | null) ?? null
          if (!remotePayload) {
            return
          }
          const local = dataService.getAll()
          const localHasData = hasMeaningfulData(local)
          const remoteUpdatedAt = resolveUpdatedAt(remotePayload, row?.updated_at ?? undefined)
          const localUpdatedAt = resolveUpdatedAt(local)
          const handler = syncHandlerRef.current ?? createRemoteSync(syncId)
          if (!syncHandlerRef.current) {
            syncHandlerRef.current = handler
            setRemoteSync(handler)
          }
          if (
            !localHasData ||
            (remoteUpdatedAt && (!localUpdatedAt || remoteUpdatedAt > localUpdatedAt))
          ) {
            setRemoteSync(null)
            dataService.replaceAll(remotePayload, { touchMeta: false, skipSync: true })
            setRemoteSync(handler)
          }
        },
      )
      .subscribe()
    return () => {
      void supabaseClient.removeChannel(channel)
    }
  }, [currentUser, isAuthenticated, syncId])

  useEffect(() => {
    if (!isAuthenticated || !currentUser || !supabase || !syncId) {
      return
    }
    if (currentUser.id === 'dev-user') {
      return
    }
    const SYNC_POLL_MS = 10000
    const interval = setInterval(async () => {
      const remote = await erpRemote.fetchState(syncId)
      if (remote.error) {
        return
      }
      const local = dataService.getAll()
      const localHasData = hasMeaningfulData(local)
      const remoteUpdatedAt = resolveUpdatedAt(remote.data, remote.updatedAt)
      const localUpdatedAt = resolveUpdatedAt(local)
      const handler = syncHandlerRef.current ?? createRemoteSync(syncId)
      if (!syncHandlerRef.current) {
        syncHandlerRef.current = handler
        setRemoteSync(handler)
      }
      if (
        remote.data &&
        (!localHasData || (remoteUpdatedAt && (!localUpdatedAt || remoteUpdatedAt > localUpdatedAt)))
      ) {
        setRemoteSync(null)
        dataService.replaceAll(remote.data, { touchMeta: false, skipSync: true })
        setRemoteSync(handler)
        return
      }
      if (!remote.data && localHasData) {
        await erpRemote.upsertState(syncId, local)
        await runBackup(syncId, local)
      }
    }, SYNC_POLL_MS)
    return () => clearInterval(interval)
  }, [currentUser, isAuthenticated, syncId])

  const handleLogin = (user: User) => {
    void startSession(user)
  }

  const handleDevLogin = () => {
    const devAccount = createDevAccount()
    if (typeof window !== 'undefined') {
      const backup = window.localStorage.getItem(DEV_BACKUP_KEY)
      if (!backup) {
        window.localStorage.setItem(DEV_BACKUP_KEY, JSON.stringify(dataService.getAll()))
      }
      window.localStorage.setItem(DEV_MODE_KEY, 'true')
    }
    dataService.replaceAll(createDevSeed(devAccount.id))
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DEV_SEEDED_KEY, 'true')
    }
    setIsDevMode(true)
    setCurrentUser(devAccount)
    setIsAuthenticated(true)
    setSyncId(null)
    setRemoteSync(null)
    syncHandlerRef.current = null
  }

  const handleLogout = () => {
    if (allowDevMode && typeof window !== 'undefined') {
      const devMode = window.localStorage.getItem(DEV_MODE_KEY) === 'true'
      if (devMode) {
        const backup = window.localStorage.getItem(DEV_BACKUP_KEY)
        if (backup) {
          dataService.replaceAll(JSON.parse(backup))
        }
        window.localStorage.removeItem(DEV_BACKUP_KEY)
        window.localStorage.removeItem(DEV_MODE_KEY)
        window.localStorage.removeItem(DEV_SEEDED_KEY)
        setIsDevMode(false)
        setCurrentUser(null)
        setIsAuthenticated(false)
        setSyncId(null)
        setRemoteSync(null)
        syncHandlerRef.current = null
        return
      }
    }
    if (supabase) {
      void supabase.auth.signOut()
    }
    setRemoteSync(null)
    syncHandlerRef.current = null
    setSyncId(null)
    setCurrentUser(null)
    setIsAuthenticated(false)
  }

  const openSession = useMemo(() => {
    const sessions = data.pdvCaixas.filter((session) => session.status === 'aberto')
    return sessions.sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0] ?? null
  }, [data.pdvCaixas])

  const handleQuickCashClose = () => {
    setIsQuickCashOpen(false)
    setQuickCashBalance(0)
  }

  const handleQuickCashSubmit = () => {
    if (!currentUser || openSession) {
      handleQuickCashClose()
      return
    }
    const openingBalance = Number.isFinite(quickCashBalance)
      ? Math.max(0, quickCashBalance)
      : 0
    const now = new Date().toISOString()
    dataService.upsertPdvCashSession({
      id: createId(),
      userId: currentUser.id,
      userName: resolveDisplayName(currentUser),
      openingBalance,
      status: 'aberto',
      openedAt: now,
    })
    refresh()
    handleQuickCashClose()
  }

  const handleQuickCashOpen = () => {
    if (openSession) {
      return
    }
    setIsQuickCashOpen(true)
  }

  const counts = useMemo(
    () => ({
      orcamentos: data.orcamentos.length,
      pedidos: data.pedidos.length,
    }),
    [data.orcamentos, data.pedidos],
  )

  const searchItems = useMemo<TopbarSearchItemInput[]>(() => {
    const items: TopbarSearchItemInput[] = []

    modes.forEach((entry) => {
      items.push({
        id: `pdv-${entry.id}`,
        title: entry.label,
        category: 'PDV',
        page: entry.id,
        keywords: [entry.label, entry.id],
      })
    })

    data.produtos.forEach((product) => {
      if (product.active === false) {
        return
      }
      items.push({
        id: product.id,
        title: product.name,
        subtitle: product.sku ? `SKU ${product.sku}` : undefined,
        category: 'Produtos',
        page: 'venda',
        intent: { type: 'open-product', productId: product.id },
        keywords: [product.sku, product.dimensions],
      })
      const variants = (product.variants ?? []).filter((variant) => variant.active !== false)
      variants.forEach((variant) => {
        const variantSku = variant.sku?.trim() ?? ''
        const combinedSku = variantSku ? formatSkuWithVariant(product.sku, variantSku) : ''
        const variantTitle = variant.name?.trim() || combinedSku || 'Variacao'
        const variantSubtitle = combinedSku
          ? `${product.name} • SKU ${combinedSku}`
          : product.name
        items.push({
          id: `variant-${product.id}-${variant.id}`,
          title: variantTitle,
          subtitle: variantSubtitle,
          category: 'Variacoes',
          page: 'venda',
          intent: { type: 'open-variant', productId: product.id, variantId: variant.id },
          keywords: [variant.name, variant.sku, combinedSku, product.name, product.sku],
        })
      })
    })

    data.orcamentos.forEach((quote) => {
      const client = data.clientes.find((item) => item.id === quote.clientId)
      items.push({
        id: quote.id,
        title: `Orcamento #${quote.id.slice(-6)}`,
        subtitle: client?.name ?? 'Cliente',
        category: 'Orcamentos',
        page: 'orcamentos',
        keywords: [client?.name, quote.status, quote.id],
      })
    })

    data.pedidos.forEach((order) => {
      const client = data.clientes.find((item) => item.id === order.clientId)
      items.push({
        id: order.id,
        title: `Pedido #${resolveOrderInternalCode(order)}`,
        subtitle: client?.name ?? 'Cliente',
        category: 'Pedidos',
        page: 'pedidos',
        keywords: [client?.name, order.status, order.id],
      })
    })

    return items
  }, [data.clientes, data.orcamentos, data.pedidos, data.produtos])

  const roleLabel = useMemo(() => {
    if (!currentUser) {
      return undefined
    }
    if (currentUser.employeeId) {
      const employee = data.funcionarios.find((item) => item.id === currentUser.employeeId)
      if (employee?.roleId) {
        return data.cargos.find((role) => role.id === employee.roleId)?.name
      }
    }
    return currentUser.role === 'admin' ? 'Administrador' : 'Operador'
  }, [currentUser, data.cargos, data.funcionarios])

  const resolveCheckoutTarget = () => {
    const active = mobileModal ?? mode
    return active === 'orcamento' ? 'orcamento' : 'venda'
  }

  const openMode = (nextMode: PdvMode) => {
    setMode(nextMode)
    if (isCompact) {
      setMobileModal(nextMode)
    }
  }

  const openItem = (target: PdvSearchTarget, id: string) => {
    setPendingOpen({ target, id })
    openMode(target)
  }

  const handleNavigate = (target: PdvSearchTarget, id?: string) => {
    if (id) {
      openItem(target, id)
      return
    }
    openMode(target)
  }

  const handleSearchSelect = (item: TopbarSearchItem) => {
    if (item.intent?.type === 'open-product') {
      const targetMode = resolveCheckoutTarget()
      setPendingAdd({ targetMode, productId: item.intent.productId })
      openMode(targetMode)
      return
    }
    if (item.intent?.type === 'open-variant') {
      const targetMode = resolveCheckoutTarget()
      setPendingAdd({
        targetMode,
        productId: item.intent.productId,
        variantId: item.intent.variantId,
      })
      openMode(targetMode)
      return
    }
    if (item.page === 'pedidos') {
      openItem('pedidos', item.id)
      return
    }
    if (item.page === 'orcamentos') {
      openItem('orcamentos', item.id)
      return
    }
    if (item.page && modes.some((entry) => entry.id === item.page)) {
      openMode(item.page as PdvMode)
    }
  }

  if (isRecoveryMode) {
    return (
      <ResetPassword
        onDone={() => {
          setIsRecoveryMode(false)
        }}
      />
    )
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <Login
        onLogin={handleLogin}
        onDevLogin={allowDevMode ? handleDevLogin : undefined}
      />
    )
  }

  const displayName = resolveDisplayName(currentUser)
  const openOrderId = pendingOpen?.target === 'pedidos' ? pendingOpen.id : undefined
  const openQuoteId = pendingOpen?.target === 'orcamentos' ? pendingOpen.id : undefined
  const cashOpenFormId = 'pdv-cash-open-form'
  const pendingAddPayload = pendingAdd
    ? { productId: pendingAdd.productId, variantId: pendingAdd.variantId }
    : null
  const activeMobileMode = mobileModal
    ? modes.find((entry) => entry.id === mobileModal) ?? null
    : null
  const resolveModeCount = (target: PdvMode) => {
    if (target === 'orcamentos') {
      return counts.orcamentos
    }
    if (target === 'pedidos') {
      return counts.pedidos
    }
    return null
  }
  const vendaMode = modes.find((entry) => entry.id === 'venda')
  const orcamentoMode = modes.find((entry) => entry.id === 'orcamento')
  const minorModes = modes.filter(
    (entry) => entry.id !== 'venda' && entry.id !== 'orcamento',
  )

  const renderModeContent = (activeMode: PdvMode) => {
    if (activeMode === 'venda') {
      return (
        <PdvCheckout
          mode="venda"
          onOpenCash={handleQuickCashOpen}
          pendingAddItem={pendingAdd?.targetMode === 'venda' ? pendingAddPayload : null}
          onConsumePendingAdd={() => setPendingAdd(null)}
        />
      )
    }
    if (activeMode === 'orcamento') {
      return (
        <PdvCheckout
          mode="orcamento"
          onOpenCash={handleQuickCashOpen}
          pendingAddItem={pendingAdd?.targetMode === 'orcamento' ? pendingAddPayload : null}
          onConsumePendingAdd={() => setPendingAdd(null)}
        />
      )
    }
    if (activeMode === 'orcamentos') {
      return <PdvQuotes openId={openQuoteId} onConsumeOpen={() => setPendingOpen(null)} />
    }
    if (activeMode === 'pedidos') {
      return <PdvOrders openId={openOrderId} onConsumeOpen={() => setPendingOpen(null)} />
    }
    if (activeMode === 'caixa') {
      return <PdvCash operatorId={currentUser.id} operatorName={displayName} />
    }
    if (activeMode === 'historico') {
      return <PdvHistory onOpen={(target, id) => handleNavigate(target, id)} />
    }
    return null
  }

  return (
    <div className="pdv">
      <Topbar
        breadcrumbs={[]}
        brand={<img className="topbar__logo" src={logotipo} alt="Umoya" />}
        userName={displayName}
        userRoleLabel={roleLabel}
        userAvatarUrl={currentUser.avatarUrl}
        userAvatarColor={currentUser.avatarColor}
        onLogout={handleLogout}
        isSensitiveHidden={isSensitiveHidden}
        onSensitiveToggle={() => setIsSensitiveHidden((prev) => !prev)}
        onSearchSelect={handleSearchSelect}
        searchItems={searchItems}
        searchPlaceholder="Pesquisar"
        showDevTools={allowDevMode}
      />

      <Modal
        open={isQuickCashOpen}
        onClose={handleQuickCashClose}
        title="Abrir caixa"
        size="sm"
        actions={
          <button
            className="button button--primary"
            type="submit"
            form={cashOpenFormId}
          >
            <span className="material-symbols-outlined modal__action-icon" aria-hidden="true">
              lock_open
            </span>
            <span className="modal__action-label">Abrir caixa</span>
          </button>
        }
      >
        <form
          id={cashOpenFormId}
          className="modal__form"
          onSubmit={(event) => {
            event.preventDefault()
            handleQuickCashSubmit()
          }}
        >
          <div className="modal__group">
            <label className="modal__label" htmlFor="pdv-quick-cash-opening">
              Saldo inicial
            </label>
            <input
              id="pdv-quick-cash-opening"
              className="modal__input"
              type="number"
              min="0"
              step="0.01"
              value={quickCashBalance}
              onChange={(event) => setQuickCashBalance(Number(event.target.value))}
            />
          </div>
        </form>
      </Modal>

      {isCompact ? (
        <div className="pdv__launcher" aria-label="Modos do PDV">
          <div className="pdv__launcher-top">
            {vendaMode && (
              <button
                type="button"
                className="button pdv__launcher-button pdv__launcher-primary pdv__launcher-button--venda"
                onClick={() => openMode(vendaMode.id)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {vendaMode.icon}
                </span>
                <span className="pdv__launcher-label">{vendaMode.label}</span>
              </button>
            )}
          </div>
          <div className="pdv__launcher-bottom">
            {orcamentoMode && (
              <button
                type="button"
                className="button pdv__launcher-button pdv__launcher-secondary pdv__launcher-button--orcamento"
                onClick={() => openMode(orcamentoMode.id)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {orcamentoMode.icon}
                </span>
                <span className="pdv__launcher-label">{orcamentoMode.label}</span>
              </button>
            )}
            <div className="pdv__launcher-minor" aria-label="Outros modos">
              {minorModes.map((entry) => {
                const count = resolveModeCount(entry.id)
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`button pdv__launcher-button pdv__launcher-button--minor pdv__launcher-button--${entry.id}`}
                    onClick={() => openMode(entry.id)}
                    aria-label={entry.label}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {entry.icon}
                    </span>
                    <span className="pdv__launcher-label">{entry.label}</span>
                    {typeof count === 'number' && (
                      <span className="badge pdv__launcher-badge">{count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="pdv__content">
          <nav className="pdv__nav" aria-label="Modos do PDV">
            {modes.map((entry) => {
              const count = resolveModeCount(entry.id)
              const isActive = mode === entry.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`button button--sm ${
                    isActive ? 'button--primary' : 'button--ghost'
                  }`}
                  onClick={() => openMode(entry.id)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {entry.icon}
                  </span>
                  <span>{entry.label}</span>
                  {typeof count === 'number' && <span className="badge">{count}</span>}
                </button>
              )
            })}
          </nav>

          {!openSession && mode !== 'caixa' && (
            <section className="panel">
              <div className="panel__header">
                <div>
                  <h2>Caixa fechado</h2>
                  <p>Abra o caixa para registrar vendas e reforcos.</p>
                </div>
                <div className="panel__actions">
                  <button
                    className="button button--primary button--sm"
                    type="button"
                    onClick={handleQuickCashOpen}
                  >
                    Abrir caixa
                  </button>
                </div>
              </div>
            </section>
          )}

          <main className="pdv__main">{renderModeContent(mode)}</main>
        </div>
      )}

      {isCompact && mobileModal && (
        <Modal
          open={!!mobileModal}
          onClose={() => setMobileModal(null)}
          title={activeMobileMode?.label ?? 'PDV'}
          size="lg"
          closeLabel="Voltar"
        >
          {renderModeContent(mobileModal)}
        </Modal>
      )}
    </div>
  )
}

export default PdvApp
