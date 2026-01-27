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
import Clientes from './pages/Clientes'
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
    dashboard: 'Visao geral',
    orcamentos: 'Orcamentos',
    pedidos: 'Pedidos',
    produtos: 'Produtos',
    producao: 'Producao',
    financeiro: 'Financeiro',
    clientes: 'Clientes',
    fornecedores: 'Fornecedores',
    funcionarios: 'Funcionarios',
    indicadores: 'Indicadores',
    bi: 'BI',
    dados: 'Dados',
    configuracoes: 'Configuracoes',
  }

  const breadcrumbMap: Record<string, string[]> = {
    dashboard: ['Inicio', 'Visao geral'],
    orcamentos: ['Inicio', 'Orcamentos'],
    pedidos: ['Inicio', 'Pedidos'],
    produtos: ['Inicio', 'Produtos'],
    producao: ['Inicio', 'Producao'],
    financeiro: ['Inicio', 'Financeiro'],
    clientes: ['Inicio', 'Clientes'],
    fornecedores: ['Inicio', 'Fornecedores'],
    funcionarios: ['Inicio', 'Funcionarios'],
    indicadores: ['Relatorios', 'Indicadores'],
    bi: ['Relatorios', 'BI'],
    dados: ['Sistema', 'Dados'],
    configuracoes: ['Sistema', 'Configuracoes'],
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
      return <Dashboard />
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
    if (activePage === 'financeiro') {
      return <Financeiro />
    }
    if (activePage === 'clientes') {
      return <Clientes />
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
