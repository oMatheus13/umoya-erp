import { useEffect, useRef, useState } from 'react'
import AppShell from './layouts/AppShell'
import Dashboard from './pages/Dashboard'
import DataTools from './pages/DataTools'
import Login from './pages/Login'
import Produtos from './pages/Produtos'
import Orcamentos from './pages/Orcamentos'
import Pedidos from './pages/Pedidos'
import Placeholder from './pages/Placeholder'
import Producao from './pages/Producao'
import ProducaoLotes from './pages/ProducaoLotes'
import ProducaoRefugo from './pages/ProducaoRefugo'
import ConsumoProdutos from './pages/ConsumoProdutos'
import Financeiro from './pages/Financeiro'
import Estoque from './pages/Estoque'
import EstoqueFormas from './pages/EstoqueFormas'
import EstoqueMateriais from './pages/EstoqueMateriais'
import Compras from './pages/Compras'
import Entregas from './pages/Entregas'
import Clientes from './pages/Clientes'
import Materiais from './pages/Materiais'
import Tabelas from './pages/Tabelas'
import Empresa from './pages/Empresa'
import Fornecedores from './pages/Fornecedores'
import Funcionarios from './pages/Funcionarios'
import Indicadores from './pages/Indicadores'
import Bi from './pages/Bi'
import Configuracoes from './pages/Configuracoes'
import UsuariosPermissoes from './pages/UsuariosPermissoes'
import Fiscal from './pages/Fiscal'
import Qualidade from './pages/Qualidade'
import RelatoriosProducao from './pages/RelatoriosProducao'
import RelatoriosVendas from './pages/RelatoriosVendas'
import RelatoriosConsumo from './pages/RelatoriosConsumo'
import Integracoes from './pages/Integracoes'
import AuditoriaLog from './pages/AuditoriaLog'
import AuditoriaHistorico from './pages/AuditoriaHistorico'
import AuditoriaBackup from './pages/AuditoriaBackup'
import AuditoriaAcesso from './pages/AuditoriaAcesso'
import Perfil from './pages/Perfil'
import RhPresenca from './pages/RhPresenca'
import RhPagamentos from './pages/RhPagamentos'
import RhHistorico from './pages/RhHistorico'
import RhOcorrencias from './pages/RhOcorrencias'
import type { User } from '@supabase/supabase-js'
import type { ERPData, UserAccount } from './types/erp'
import { erpRemote } from './services/erpRemote'
import { dataService, ensureStorageSeed, setRemoteSync } from './services/dataService'
import { supabase } from './services/supabaseClient'
import { createDevSeed, DEV_BACKUP_KEY, DEV_MODE_KEY, DEV_SEEDED_KEY } from './services/devSeed'
import type { SidebarMode } from './types/ui'
import { createPermissionCheck } from './utils/permissions'
import { isPermissionKey } from './data/permissions'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [activePage, setActivePage] = useState('dashboard')
  const [permissionsVersion, setPermissionsVersion] = useState(0)
  const allowDevMode =
    (import.meta.env && import.meta.env.DEV) || import.meta.env.VITE_DEV_ACCESS === 'true'
  const syncHandlerRef = useRef<((data: ERPData) => void) | null>(null)
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

  const pageTitles: Record<string, string> = {
    dashboard: 'Painel',
    clientes: 'Clientes e obras',
    produtos: 'Produtos e pecas',
    'cadastros-materiais': 'Materia-prima',
    fornecedores: 'Fornecedores',
    'cadastros-tabelas': 'Tabelas',
    orcamentos: 'Orcamentos',
    pedidos: 'Pedido de venda',
    producao: 'Ordens de producao',
    'producao-lotes': 'Lotes',
    'producao-refugo': 'Refugo e retrabalho',
    'producao-consumo': 'Consumo por produto',
    estoque: 'Estoque consolidado',
    'estoque-formas': 'Formas e moldes',
    'estoque-materiais': 'Materia-prima',
    compras: 'Compras',
    entregas: 'Logistica e entregas',
    financeiro: 'Financeiro',
    fiscal: 'Fiscal',
    funcionarios: 'Funcionarios',
    'rh-presenca': 'Presenca',
    'rh-pagamentos': 'Pagamentos',
    'rh-historico': 'Historico',
    'rh-ocorrencias': 'Ocorrencias',
    qualidade: 'Qualidade e manutencao',
    indicadores: 'Indicadores',
    bi: 'BI',
    'relatorios-producao': 'Producao por periodo',
    'relatorios-vendas': 'Vendas por cliente e obra',
    'relatorios-consumo': 'Consumo de material',
    'config-usuarios': 'Usuarios e permissoes',
    perfil: 'Meu perfil',
    'config-empresa': 'Empresa',
    configuracoes: 'Parametros',
    'config-integracoes': 'Integracoes',
    dados: 'Backup e exportacao',
    'auditoria-log': 'Log de acoes',
    'auditoria-historico': 'Historico de alteracoes',
    'auditoria-backup': 'Backup automatico',
    'auditoria-acesso': 'Controle de acesso',
  }

  const breadcrumbMap: Record<string, string[]> = {
    dashboard: ['Painel'],
    clientes: ['Cadastros', 'Clientes e obras'],
    produtos: ['Cadastros', 'Produtos e pecas'],
    'cadastros-materiais': ['Cadastros', 'Materia-prima'],
    fornecedores: ['Cadastros', 'Fornecedores'],
    'cadastros-tabelas': ['Cadastros', 'Tabelas'],
    orcamentos: ['Vendas', 'Orcamentos'],
    pedidos: ['Vendas', 'Pedido de venda'],
    producao: ['Producao', 'Ordens de producao'],
    'producao-lotes': ['Producao', 'Lotes'],
    'producao-refugo': ['Producao', 'Refugo e retrabalho'],
    'producao-consumo': ['Producao', 'Consumo por produto'],
    estoque: ['Estoque', 'Consolidado'],
    'estoque-formas': ['Estoque', 'Formas e moldes'],
    'estoque-materiais': ['Estoque', 'Materia-prima'],
    compras: ['Compras'],
    entregas: ['Logistica e entregas'],
    financeiro: ['Financeiro'],
    fiscal: ['Fiscal'],
    funcionarios: ['RH', 'Funcionarios'],
    'rh-presenca': ['RH', 'Presenca'],
    'rh-pagamentos': ['RH', 'Pagamentos'],
    'rh-historico': ['RH', 'Historico'],
    'rh-ocorrencias': ['RH', 'Ocorrencias'],
    qualidade: ['Qualidade e manutencao'],
    indicadores: ['Relatorios', 'Indicadores'],
    bi: ['Relatorios', 'BI'],
    'relatorios-producao': ['Relatorios', 'Producao por periodo'],
    'relatorios-vendas': ['Relatorios', 'Vendas por cliente e obra'],
    'relatorios-consumo': ['Relatorios', 'Consumo de material'],
    'config-usuarios': ['Configuracoes', 'Usuarios e permissoes'],
    perfil: ['Configuracoes', 'Meu perfil'],
    'config-empresa': ['Configuracoes', 'Empresa'],
    configuracoes: ['Configuracoes', 'Parametros'],
    'config-integracoes': ['Configuracoes', 'Integracoes'],
    dados: ['Configuracoes', 'Backup e exportacao'],
    'auditoria-log': ['Auditoria', 'Log de acoes'],
    'auditoria-historico': ['Auditoria', 'Historico de alteracoes'],
    'auditoria-backup': ['Auditoria', 'Backup automatico'],
    'auditoria-acesso': ['Auditoria', 'Controle de acesso'],
  }

  const breadcrumbs = breadcrumbMap[activePage] ?? ['Inicio', pageTitles[activePage] ?? 'Modulo']
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
    return currentUser.role === 'admin' ? 'Administrador' : 'Funcionario'
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
    payload.entregas.length > 0

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

  const runBackup = async (userId: string, payload: ERPData) => {
    if (shouldBackup()) {
      await erpRemote.backupState(userId, payload)
    }
  }

  const createRemoteSync = (userId: string) => {
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
      const result = await erpRemote.upsertState(userId, payload)
      if (!result.error) {
        await runBackup(userId, payload)
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
      }, 1200)
    }
  }

  const fetchRemoteState = async (userId: string) => {
    const timeout = new Promise<{ data: null; error: string }>((resolve) => {
      setTimeout(() => resolve({ data: null, error: 'timeout' }), 2500)
    })
    return Promise.race([erpRemote.fetchState(userId), timeout])
  }

  const startSession = async (user: User) => {
    setRemoteSync(null)
    syncHandlerRef.current = null
    const localSnapshot = dataService.getAll()
    const localHasData = hasMeaningfulData(localSnapshot)
    const remote = await fetchRemoteState(user.id)
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
    const hasAdmin = payload.usuarios.some((item) => item.role === 'admin')
    const resolvedRole =
      existing?.role ?? metadataRole ?? (hasAdmin ? 'funcionario' : 'admin')
    const resolvedCpf = existing?.cpf ?? metadataCpf
    const nextUser: UserAccount = {
      id: user.id,
      name: fallbackName,
      displayName: existing?.displayName ?? metadataDisplayName,
      email: user.email ?? existing?.email ?? '',
      cpf: resolvedCpf,
      phone: existing?.phone,
      avatarColor: existing?.avatarColor,
      avatarUrl: existing?.avatarUrl,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      active: existing?.active ?? true,
      role: resolvedRole,
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
      existing.avatarUrl !== nextUser.avatarUrl
    if (shouldUpdate) {
      payload.usuarios = existing
        ? payload.usuarios.map((item) => (item.id === user.id ? nextUser : item))
        : [...payload.usuarios, nextUser]
      dataService.replaceAll(payload)
    }

    const localIsNewer =
      localHasData &&
      !!localUpdatedAt &&
      (!remoteUpdatedAt || localUpdatedAt > remoteUpdatedAt)
    const shouldSeedRemote = !remoteError && !remotePayload && localHasData
    const shouldPushLocal = !remoteError && (shouldSeedRemote || localIsNewer || shouldUpdate)
    if (!remoteError) {
      const handler = createRemoteSync(user.id)
      syncHandlerRef.current = handler
      setRemoteSync(handler)
    }
    if (shouldPushLocal) {
      const latest = dataService.getAll()
      await erpRemote.upsertState(user.id, latest)
      await runBackup(user.id, latest)
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
      if (user) {
        void startSession(user)
      }
    })
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !currentUser || !supabase) {
      return
    }
    if (currentUser.id === 'dev-user') {
      return
    }
    const interval = setInterval(async () => {
      const remote = await erpRemote.fetchState(currentUser.id)
      if (remote.error) {
        return
      }
      const local = dataService.getAll()
      const localHasData = hasMeaningfulData(local)
      const remoteUpdatedAt = resolveUpdatedAt(remote.data, remote.updatedAt)
      const localUpdatedAt = resolveUpdatedAt(local)
      const handler = syncHandlerRef.current ?? createRemoteSync(currentUser.id)
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
        await erpRemote.upsertState(currentUser.id, local)
        await runBackup(currentUser.id, local)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated, currentUser?.id])

  if (!isAuthenticated) {
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
      setCurrentUser(null)
      setIsAuthenticated(false)
      setActivePage('dashboard')
      return
      }
    }
    if (supabase) {
      void supabase.auth.signOut()
    }
    setRemoteSync(null)
    syncHandlerRef.current = null
    setCurrentUser(null)
    setIsAuthenticated(false)
    setActivePage('dashboard')
  }

  const renderPage = () => {
    if (activePage === 'dashboard') {
      return <Dashboard onNavigate={setActivePage} />
    }
    if (activePage === 'orcamentos') {
      return <Orcamentos />
    }
    if (activePage === 'pedidos') {
      return <Pedidos />
    }
    if (activePage === 'produtos') {
      return <Produtos />
    }
    if (activePage === 'producao') {
      return <Producao />
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
      return <Compras />
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
    return <Placeholder title={pageTitles[activePage] ?? 'Modulo'} />
  }

  const content = canView(activePage) ? (
    renderPage()
  ) : (
    <Placeholder
      title="Sem permissao"
      description="Seu perfil nao possui acesso a esta area."
    />
  )

  return (
    <AppShell
      activePage={activePage}
      onNavigate={setActivePage}
      breadcrumbs={breadcrumbs}
      sidebarMode={sidebarMode}
      userName={currentUser?.displayName ?? currentUser?.name}
      userRoleLabel={userRoleLabel}
      userAvatarUrl={currentUser?.avatarUrl}
      userAvatarColor={currentUser?.avatarColor}
      onLogout={handleLogout}
      canView={canView}
      canEdit={canEdit(activePage)}
    >
      {content}
    </AppShell>
  )
}

export default App
