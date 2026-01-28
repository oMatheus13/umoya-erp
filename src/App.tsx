import { useEffect, useState } from 'react'
import AppShell from './layouts/AppShell'
import Dashboard from './pages/Dashboard'
import DataTools from './pages/DataTools'
import Login from './pages/Login'
import Produtos from './pages/Produtos'
import Orcamentos from './pages/Orcamentos'
import Pedidos from './pages/Pedidos'
import Placeholder from './pages/Placeholder'
import Producao from './pages/Producao'
import Financeiro from './pages/Financeiro'
import Estoque from './pages/Estoque'
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
import type { User } from '@supabase/supabase-js'
import type { UserAccount } from './types/erp'
import { erpRemote } from './services/erpRemote'
import { dataService, ensureStorageSeed, setRemoteSync } from './services/dataService'
import { supabase } from './services/supabaseClient'
import type { SidebarMode } from './types/ui'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [activePage, setActivePage] = useState('dashboard')
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
    estoque: 'Estoque',
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
    estoque: ['Estoque'],
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

  const startSession = async (user: User) => {
    setRemoteSync(null)
    const remote = await erpRemote.fetchState(user.id)
    if (remote.data) {
      dataService.replaceAll(remote.data)
    }
    const payload = dataService.getAll()
    const existing = payload.usuarios.find((item) => item.id === user.id)
    const displayName =
      existing?.name ?? (user.user_metadata?.name as string | undefined) ?? user.email ?? 'Usuario'
    const metadataCpf = user.user_metadata?.cpf as string | undefined
    const metadataRole = user.user_metadata?.role as UserAccount['role'] | undefined
    const hasAdmin = payload.usuarios.some((item) => item.role === 'admin')
    const resolvedRole =
      existing?.role ?? metadataRole ?? (hasAdmin ? 'funcionario' : 'admin')
    const resolvedCpf = existing?.cpf ?? metadataCpf
    const nextUser: UserAccount = {
      id: user.id,
      name: displayName,
      email: user.email ?? existing?.email ?? '',
      cpf: resolvedCpf,
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
      existing.role !== nextUser.role
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

  useEffect(() => {
    ensureStorageSeed()
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
      />
    )
  }

  const handleLogout = () => {
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
    if (activePage === 'estoque') {
      return <Estoque />
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
    if (activePage === 'indicadores') {
      return <Indicadores />
    }
    if (activePage === 'bi') {
      return <Bi />
    }
    if (activePage === 'dados') {
      return <DataTools />
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

  return (
    <AppShell
      activePage={activePage}
      onNavigate={setActivePage}
      breadcrumbs={breadcrumbs}
      sidebarMode={sidebarMode}
      userName={currentUser?.name}
      onLogout={handleLogout}
    >
      {renderPage()}
    </AppShell>
  )
}

export default App
