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
import Indicadores from './pages/Indicadores'
import Bi from './pages/Bi'
import { ensureStorageSeed } from './services/dataService'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activePage, setActivePage] = useState('dashboard')

  const pageTitles: Record<string, string> = {
    dashboard: 'Visao geral',
    orcamentos: 'Orcamentos',
    pedidos: 'Pedidos',
    produtos: 'Produtos',
    producao: 'Producao',
    financeiro: 'Financeiro',
    clientes: 'Clientes',
    fornecedores: 'Fornecedores',
    indicadores: 'Indicadores',
    bi: 'BI',
    dados: 'Dados',
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
    indicadores: ['Relatorios', 'Indicadores'],
    bi: ['Relatorios', 'BI'],
    dados: ['Sistema', 'Dados'],
  }

  const breadcrumbs = breadcrumbMap[activePage] ?? ['Inicio', pageTitles[activePage] ?? 'Modulo']

  useEffect(() => {
    ensureStorageSeed()
  }, [])

  if (!isAuthenticated) {
    return <Login onSubmit={() => setIsAuthenticated(true)} />
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
    if (activePage === 'indicadores') {
      return <Indicadores />
    }
    if (activePage === 'bi') {
      return <Bi />
    }
    if (activePage === 'dados') {
      return <DataTools />
    }
    return <Placeholder title={pageTitles[activePage] ?? 'Modulo'} />
  }

  return (
    <AppShell
      activePage={activePage}
      onNavigate={setActivePage}
      breadcrumbs={breadcrumbs}
    >
      {renderPage()}
    </AppShell>
  )
}

export default App
