import { useEffect, useRef, useState } from 'react'
import AppShell from './layouts/AppShell'
import Dashboard from './pages/core/Dashboard'
import DataTools from './pages/configuracoes/DataTools'
import Login from '@shared/components/core/Login'
import SetupAdmin from './pages/core/SetupAdmin'
import ResetPassword from '@shared/components/core/ResetPassword'
import Produtos from './pages/cadastros/Produtos'
import Orcamentos from './pages/vendas/Orcamentos'
import Pedidos from './pages/vendas/Pedidos'
import Placeholder from './pages/shared/Placeholder'
import Producao from './pages/producao/Producao'
import ProducaoLotes from './pages/producao/ProducaoLotes'
import ProducaoRefugo from './pages/producao/ProducaoRefugo'
import ConsumoProdutos from './pages/producao/ConsumoProdutos'
import Financeiro from './pages/financeiro/Financeiro'
import Estoque from './pages/estoque/Estoque'
import EstoqueFormas from './pages/estoque/EstoqueFormas'
import EstoqueMateriais from './pages/estoque/EstoqueMateriais'
import Compras from './pages/compras/Compras'
import Entregas from './pages/logistica/Entregas'
import Clientes from './pages/cadastros/Clientes'
import Materiais from './pages/cadastros/Materiais'
import Tabelas from './pages/cadastros/Tabelas'
import Empresa from './pages/configuracoes/Empresa'
import Fornecedores from './pages/cadastros/Fornecedores'
import Funcionarios from './pages/rh/Funcionarios'
import Indicadores from './pages/relatorios/Indicadores'
import Bi from './pages/relatorios/Bi'
import Configuracoes from './pages/configuracoes/Configuracoes'
import UsuariosPermissoes from './pages/configuracoes/UsuariosPermissoes'
import Fiscal from './pages/financeiro/Fiscal'
import Qualidade from './pages/qualidade/Qualidade'
import RelatoriosProducao from './pages/relatorios/RelatoriosProducao'
import RelatoriosVendas from './pages/relatorios/RelatoriosVendas'
import RelatoriosConsumo from './pages/relatorios/RelatoriosConsumo'
import RelatoriosHistorico from './pages/relatorios/RelatoriosHistorico'
import MensagensContato from './pages/site/MensagensContato'
import Integracoes from './pages/configuracoes/Integracoes'
import AuditoriaLog from './pages/auditoria/AuditoriaLog'
import AuditoriaHistorico from './pages/auditoria/AuditoriaHistorico'
import AuditoriaBackup from './pages/auditoria/AuditoriaBackup'
import AuditoriaAcesso from './pages/auditoria/AuditoriaAcesso'
import Perfil from './pages/configuracoes/Perfil'
import RhPresenca from './pages/rh/RhPresenca'
import RhPagamentos from './pages/rh/RhPagamentos'
import RhHistorico from './pages/rh/RhHistorico'
import RhOcorrencias from './pages/rh/RhOcorrencias'
import type { User } from '@supabase/supabase-js'
import type { ERPData, UserAccount } from '@shared/types/erp'
import { erpRemote } from '@shared/services/erpRemote'
import { dataService, ensureStorageSeed, setRemoteSync } from '@shared/services/dataService'
import { trackingRemote } from '@shared/services/trackingRemote'
import { buildTrackingPayloads } from '@shared/services/trackingPayload'
import { supabase } from '@shared/services/supabaseClient'
import { createDevSeed, DEV_BACKUP_KEY, DEV_MODE_KEY, DEV_SEEDED_KEY } from '@shared/services/devSeed'
import { createSignedAvatarUrl } from '@shared/services/storageFiles'
import { sanitizeAvatarUrl } from '@shared/utils/avatar'
import type { PageIntent, PageIntentAction, SidebarMode } from '@shared/types/ui'
import { createPermissionCheck } from '@shared/utils/permissions'
import { PAGE_META } from './data/navigation'
import { isPermissionKey } from '@shared/data/permissions'

function App() {
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    return params.get('type') === 'recovery'
  })
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [syncId, setSyncId] = useState<string | null>(null)
  const [activePage, setActivePage] = useState('dashboard')
  const [isPageTransitioning, setIsPageTransitioning] = useState(false)
  const [pageIntent, setPageIntent] = useState<PageIntent | null>(null)
  const [permissionsVersion, setPermissionsVersion] = useState(0)
  const allowDevMode =
    (import.meta.env && import.meta.env.DEV) || import.meta.env.VITE_DEV_ACCESS === 'true'
  const setupSecret = import.meta.env.VITE_SETUP_TOKEN as string | undefined
  const setupToken =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('setup')
      : null
  const allowSetup = !!setupSecret && setupToken === setupSecret
  const syncHandlerRef = useRef<((data: ERPData) => void) | null>(null)
  const pendingPageRef = useRef<string | null>(null)
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const PAGE_TRANSITION_MS = 90
  const SYNC_DEBOUNCE_MS = 400
  const SYNC_POLL_MS = 10000
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    if (typeof window === 'undefined') {
      return 'expanded'
    }
    const stored = window.localStorage.getItem('umoya_sidebar_mode')
    if (stored === 'expanded' || stored === 'collapsed' || stored === 'hover') {
      return stored
    }
    return 'expanded'
  })

  const pageTitle = PAGE_META[activePage]?.title
  const breadcrumbs = PAGE_META[activePage]?.breadcrumbs ?? ['Início', pageTitle ?? 'Módulo']
  const [dataSnapshot, setDataSnapshot] = useState(() => dataService.getAll())
  useEffect(() => {
    const handleSync = () => {
      setDataSnapshot(dataService.getAll())
    }
    handleSync()
    if (typeof window !== 'undefined') {
      window.addEventListener('umoya:data', handleSync)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('umoya:data', handleSync)
      }
    }
  }, [])
  useEffect(() => {
    setDataSnapshot(dataService.getAll())
  }, [permissionsVersion])
  const permissionCheck = createPermissionCheck(dataSnapshot, currentUser)
  const canView = (pageId: string) =>
    !isPermissionKey(pageId) ? true : permissionCheck.canView(pageId)
  const canEdit = (pageId: string) =>
    !isPermissionKey(pageId) ? true : permissionCheck.canEdit(pageId)
  const userRoleLabel = (() => {
    if (!currentUser) {
      return undefined
    }
    if (currentUser.employeeId) {
      const employee = dataSnapshot.funcionarios.find(
        (item) => item.id === currentUser.employeeId,
      )
      if (employee?.roleId) {
        return dataSnapshot.cargos.find((role) => role.id === employee.roleId)?.name
      }
    }
    return currentUser.role === 'admin' ? 'Administrador' : 'Funcionário'
  })()

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

  const resolveSyncId = (user: User) =>
    (user.app_metadata?.workspace_id as string | undefined) ?? user.id

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

  const clearPageTransition = () => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current)
      transitionTimeoutRef.current = null
    }
    pendingPageRef.current = null
    setPageIntent(null)
    setIsPageTransitioning(false)
  }

  const handleNavigate = (page: string, intentAction?: PageIntentAction) => {
    if (page === activePage) {
      if (intentAction) {
        setPageIntent({ page, action: intentAction })
      }
      return
    }
    if (intentAction) {
      setPageIntent({ page, action: intentAction })
    } else {
      setPageIntent(null)
    }
    pendingPageRef.current = page
    if (isPageTransitioning) {
      return
    }
    setIsPageTransitioning(true)
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current)
    }
    transitionTimeoutRef.current = setTimeout(() => {
      const nextPage = pendingPageRef.current ?? page
      pendingPageRef.current = null
      setActivePage(nextPage)
      setIsPageTransitioning(false)
    }, PAGE_TRANSITION_MS)
  }

  const consumePageIntent = () => {
    setPageIntent(null)
  }

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }
    }
  }, [])

  const createRemoteSync = (syncId: string) => {
    let pending: ERPData | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let inFlight = false

    const flush = async () => {
      if (!pending || inFlight) {
        return
      }
      inFlight = true
      const payload = pending
      pending = null
      const result = await erpRemote.upsertState(syncId, payload)
      if (!result.error) {
        await runBackup(syncId, payload)
        await trackingRemote.upsertOrders(syncId, buildTrackingPayloads(payload))
      }
      if (result.error) {
        pending = payload
        if (!timer) {
          timer = setTimeout(() => {
            timer = null
            void flush()
          }, 4000)
        }
      }
      inFlight = false
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

  const fetchRemoteState = async (syncId: string) => {
    type RemoteState = Awaited<ReturnType<typeof erpRemote.fetchState>>
    const timeout = new Promise<RemoteState>((resolve) => {
      setTimeout(() => resolve({ data: null, error: 'timeout' }), 8000)
    })
    return Promise.race<RemoteState>([erpRemote.fetchState(syncId), timeout])
  }

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

  const startDevSession = (seed: boolean) => {
    const devUserId = 'dev-user'
    const devUser: UserAccount = {
      id: devUserId,
      name: 'Dev Umoya',
      displayName: 'Dev',
      email: 'dev@umoya.local',
      createdAt: new Date().toISOString(),
      role: 'admin',
      active: true,
    }
    if (typeof window !== 'undefined') {
      const backup = window.localStorage.getItem(DEV_BACKUP_KEY)
      if (!backup) {
        window.localStorage.setItem(DEV_BACKUP_KEY, JSON.stringify(dataService.getAll()))
      }
      window.localStorage.setItem(DEV_MODE_KEY, 'true')
    }
    setRemoteSync(null)
    syncHandlerRef.current = null
    setSyncId(null)
    if (seed) {
      dataService.replaceAll(createDevSeed(devUserId))
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DEV_SEEDED_KEY, 'true')
      }
    } else if (typeof window !== 'undefined') {
      const seeded = window.localStorage.getItem(DEV_SEEDED_KEY) === 'true'
      if (!seeded) {
        dataService.replaceAll(createDevSeed(devUserId))
        window.localStorage.setItem(DEV_SEEDED_KEY, 'true')
      }
    }
    setCurrentUser(devUser)
    setIsAuthenticated(true)
  }

  useEffect(() => {
    ensureStorageSeed()
    if (allowDevMode && typeof window !== 'undefined') {
      const devMode = window.localStorage.getItem(DEV_MODE_KEY) === 'true'
      if (devMode) {
        startDevSession(false)
        return
      }
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
  }, [isRecoveryMode])

  useEffect(() => {
    const supabaseClient = supabase
    if (!isAuthenticated || !currentUser || !supabaseClient || !syncId) {
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
          const row = (payload.new as { payload?: ERPData; updated_at?: string | null } | null) ?? null
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
  }, [isAuthenticated, currentUser?.id, syncId])

  useEffect(() => {
    if (!isAuthenticated || !currentUser || !supabase || !syncId) {
      return
    }
    if (currentUser.id === 'dev-user') {
      return
    }
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
        (!localHasData ||
          (remoteUpdatedAt && (!localUpdatedAt || remoteUpdatedAt > localUpdatedAt)))
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
  }, [isAuthenticated, currentUser?.id, syncId])

  const exitRecoveryMode = () => {
    setIsRecoveryMode(false)
  }

  if (isRecoveryMode) {
    return <ResetPassword onDone={exitRecoveryMode} />
  }

  if (!isAuthenticated) {
    if (allowSetup) {
      return (
        <SetupAdmin
          onComplete={(user) => {
            void startSession(user)
          }}
        />
      )
    }
    return (
      <Login
        onLogin={(user) => {
          void startSession(user)
        }}
        onDevLogin={
          allowDevMode
            ? () => {
                startDevSession(true)
              }
            : undefined
        }
      />
    )
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
      setRemoteSync(null)
      syncHandlerRef.current = null
      setSyncId(null)
      setCurrentUser(null)
      setIsAuthenticated(false)
      setActivePage('dashboard')
      clearPageTransition()
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
    setActivePage('dashboard')
    clearPageTransition()
  }

  const renderPage = () => {
    if (activePage === 'dashboard') {
      return <Dashboard onNavigate={handleNavigate} />
    }
    if (activePage === 'orcamentos') {
      return (
        <Orcamentos
          pageIntent={pageIntent?.page === 'orcamentos' ? pageIntent.action : undefined}
          onConsumeIntent={consumePageIntent}
        />
      )
    }
    if (activePage === 'pedidos') {
      return <Pedidos />
    }
    if (activePage === 'produtos') {
      return (
        <Produtos
          pageIntent={pageIntent?.page === 'produtos' ? pageIntent.action : undefined}
          onConsumeIntent={consumePageIntent}
        />
      )
    }
    if (activePage === 'producao') {
      return (
        <Producao
          pageIntent={pageIntent?.page === 'producao' ? pageIntent.action : undefined}
          onConsumeIntent={consumePageIntent}
        />
      )
    }
    if (activePage === 'producao-lotes') {
      return <ProducaoLotes />
    }
    if (activePage === 'producao-refugo') {
      return <ProducaoRefugo />
    }
    if (activePage === 'producao-consumo') {
      return <ConsumoProdutos />
    }
    if (activePage === 'estoque') {
      return <Estoque />
    }
    if (activePage === 'estoque-formas') {
      return <EstoqueFormas />
    }
    if (activePage === 'estoque-materiais') {
      return <EstoqueMateriais />
    }
    if (activePage === 'compras') {
      return (
        <Compras
          pageIntent={pageIntent?.page === 'compras' ? pageIntent.action : undefined}
          onConsumeIntent={consumePageIntent}
          onNavigate={handleNavigate}
        />
      )
    }
    if (activePage === 'entregas') {
      return <Entregas />
    }
    if (activePage === 'financeiro') {
      return <Financeiro />
    }
    if (activePage === 'fiscal') {
      return <Fiscal />
    }
    if (activePage === 'clientes') {
      return <Clientes />
    }
    if (activePage === 'cadastros-materiais') {
      return <Materiais />
    }
    if (activePage === 'cadastros-tabelas') {
      return <Tabelas />
    }
    if (activePage === 'config-empresa') {
      return <Empresa />
    }
    if (activePage === 'fornecedores') {
      return <Fornecedores />
    }
    if (activePage === 'funcionarios') {
      return <Funcionarios currentUser={currentUser} />
    }
    if (activePage === 'rh-presenca') {
      return <RhPresenca />
    }
    if (activePage === 'rh-pagamentos') {
      return <RhPagamentos />
    }
    if (activePage === 'rh-historico') {
      return <RhHistorico />
    }
    if (activePage === 'rh-ocorrencias') {
      return <RhOcorrencias />
    }
    if (activePage === 'qualidade') {
      return <Qualidade />
    }
    if (activePage === 'indicadores') {
      return <Indicadores />
    }
    if (activePage === 'bi') {
      return <Bi />
    }
    if (activePage === 'relatorios-producao') {
      return <RelatoriosProducao />
    }
    if (activePage === 'relatorios-vendas') {
      return <RelatoriosVendas />
    }
    if (activePage === 'relatorios-consumo') {
      return <RelatoriosConsumo />
    }
    if (activePage === 'relatorios-historico') {
      return <RelatoriosHistorico />
    }
    if (activePage === 'site-contatos') {
      return <MensagensContato />
    }
    if (activePage === 'dados') {
      return <DataTools />
    }
    if (activePage === 'auditoria-log') {
      return <AuditoriaLog />
    }
    if (activePage === 'auditoria-historico') {
      return <AuditoriaHistorico />
    }
    if (activePage === 'auditoria-backup') {
      return <AuditoriaBackup />
    }
    if (activePage === 'auditoria-acesso') {
      return <AuditoriaAcesso />
    }
    if (activePage === 'config-usuarios') {
      return (
        <UsuariosPermissoes
          currentUser={currentUser}
          onPermissionsChange={() => setPermissionsVersion((prev) => prev + 1)}
        />
      )
    }
    if (activePage === 'config-integracoes') {
      return <Integracoes />
    }
    if (activePage === 'perfil') {
      return <Perfil currentUser={currentUser} onUpdate={setCurrentUser} />
    }
    if (activePage === 'configuracoes') {
      return (
        <Configuracoes
          sidebarMode={sidebarMode}
          onSidebarModeChange={(mode) => {
            setSidebarMode(mode)
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('umoya_sidebar_mode', mode)
            }
          }}
        />
      )
    }
    return <Placeholder title={pageTitle ?? 'Módulo'} />
  }

  const content = canView(activePage) ? (
    renderPage()
  ) : (
    <Placeholder
      title="Sem permissão"
      description="Seu perfil não possui acesso a esta área."
    />
  )

  return (
    <AppShell
      activePage={activePage}
      onNavigate={handleNavigate}
      breadcrumbs={breadcrumbs}
      sidebarMode={sidebarMode}
      userName={currentUser?.displayName ?? currentUser?.name}
      userRoleLabel={userRoleLabel}
      userAvatarUrl={currentUser?.avatarUrl}
      userAvatarColor={currentUser?.avatarColor}
      onLogout={handleLogout}
      canView={canView}
      canEdit={canEdit(activePage)}
      isPageTransitioning={isPageTransitioning}
      showDevTools={allowDevMode}
    >
      {content}
    </AppShell>
  )
}

export default App
