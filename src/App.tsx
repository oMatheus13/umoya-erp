import { useEffect, useMemo, useState } from 'react'
import AppShell from './layouts/AppShell'
import Dashboard from './pages/Dashboard'
import DataTools from './pages/DataTools'
import Login from './pages/Login'
import Produtos from './pages/Produtos'
import Orcamentos from './pages/Orcamentos'
import Pedidos from './pages/Pedidos'
import Placeholder from './pages/Placeholder'
import Producao from './pages/Producao'
import ConsumoProdutos from './pages/ConsumoProdutos'
import Financeiro from './pages/Financeiro'
import Estoque from './pages/Estoque'
import EstoqueFormas from './pages/EstoqueFormas'
import EstoqueMateriais from './pages/EstoqueMateriais'
import Compras from './pages/Compras'
import Entregas from './pages/Entregas'
import Clientes from './pages/Clientes'
import Materiais from './pages/Materiais'
import Empresa from './pages/Empresa'
import Fornecedores from './pages/Fornecedores'
import Funcionarios from './pages/Funcionarios'
import Indicadores from './pages/Indicadores'
import Bi from './pages/Bi'
import Configuracoes from './pages/Configuracoes'
import UsuariosPermissoes from './pages/UsuariosPermissoes'
import Perfil from './pages/Perfil'
import RhPresenca from './pages/RhPresenca'
import RhPagamentos from './pages/RhPagamentos'
import RhHistorico from './pages/RhHistorico'
import RhOcorrencias from './pages/RhOcorrencias'
import type { User } from '@supabase/supabase-js'
import type { UserAccount } from './types/erp'
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
  const dataSnapshot = useMemo(() => dataService.getAll(), [permissionsVersion])
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

  const fetchRemoteState = async (userId: string) => {
    const timeout = new Promise<{ data: null; error: string }>((resolve) => {
      setTimeout(() => resolve({ data: null, error: 'timeout' }), 4500)
    })
    return Promise.race([erpRemote.fetchState(userId), timeout])
  }

  const startSession = async (user: User) => {
    setRemoteSync(null)
    const remote = await fetchRemoteState(user.id)
    if (remote.data) {
      dataService.replaceAll(remote.data)
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

    let createdUser = false
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
      createdUser = !existing
    }

    setRemoteSync((data) => {
      void erpRemote.upsertState(user.id, data)
    })
    if (!remote.data || createdUser) {
      await erpRemote.upsertState(user.id, dataService.getAll())
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
    if (activePage === 'clientes') {
      return <Clientes />
    }
    if (activePage === 'cadastros-materiais') {
      return <Materiais />
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
    if (activePage === 'indicadores') {
      return <Indicadores />
    }
    if (activePage === 'bi') {
      return <Bi />
    }
    if (activePage === 'dados') {
      return <DataTools />
    }
    if (activePage === 'config-usuarios') {
      return (
        <UsuariosPermissoes
          currentUser={currentUser}
          onPermissionsChange={() => setPermissionsVersion((prev) => prev + 1)}
        />
      )
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
