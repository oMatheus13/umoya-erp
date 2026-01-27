import { useState } from 'react'
import isotipo from '../assets/brand/isotipo.svg'
import logotipo from '../assets/brand/logotipo.svg'

type SidebarProps = {
  activePage: string
  onNavigate: (page: string) => void
  onHoverChange: (hovered: boolean) => void
}

const Sidebar = ({ activePage, onNavigate, onHoverChange }: SidebarProps) => {
  const [reportsOpen, setReportsOpen] = useState(true)
  const navItems = [
    { id: 'dashboard', label: 'Visao geral', icon: 'dashboard' },
    { id: 'orcamentos', label: 'Orcamentos', icon: 'description' },
    { id: 'pedidos', label: 'Pedidos', icon: 'shopping_bag' },
    { id: 'produtos', label: 'Produtos', icon: 'qr_code_2' },
    { id: 'producao', label: 'Producao', icon: 'factory' },
    { id: 'financeiro', label: 'Financeiro', icon: 'payments' },
    { id: 'clientes', label: 'Clientes', icon: 'groups' },
    { id: 'fornecedores', label: 'Fornecedores', icon: 'inventory' },
    { id: 'funcionarios', label: 'Funcionarios', icon: 'badge' },
    { id: 'dados', label: 'Dados', icon: 'cloud_upload' },
    { id: 'configuracoes', label: 'Configuracoes', icon: 'settings' },
  ]

  const relatorioItems = [
    { id: 'indicadores', label: 'Indicadores', icon: 'bar_chart' },
    { id: 'bi', label: 'BI', icon: 'query_stats' },
  ]

  return (
    <aside
      className="app__sidebar sidebar"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div className="sidebar__brand">
        <img className="sidebar__logo sidebar__logo--full" src={logotipo} alt="Umoya" />
        <img className="sidebar__logo sidebar__logo--mark" src={isotipo} alt="Umoya" />
      </div>

      <nav className="sidebar__nav" aria-label="Navegacao principal">
        {navItems.map((item) => {
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              className={`sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <span
                className={isActive ? 'material-symbols-filled' : 'material-symbols-outlined'}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar__group">
        <button
          className="sidebar__toggle"
          type="button"
          aria-expanded={reportsOpen}
          onClick={() => setReportsOpen((prev) => !prev)}
        >
          <span className="sidebar__toggle-label">
            <span className="material-symbols-outlined" aria-hidden="true">
              insights
            </span>
            <span>Relatorios</span>
          </span>
          <span
            className={`material-symbols-outlined sidebar__caret${
              reportsOpen ? ' sidebar__caret--open' : ''
            }`}
            aria-hidden="true"
          >
            expand_more
          </span>
        </button>
        {reportsOpen && (
          <nav className="sidebar__subnav" aria-label="Relatorios">
            {relatorioItems.map((item) => {
              const isActive = activePage === item.id
              return (
                <button
                  key={item.id}
                  className={`sidebar__link sidebar__link--sub${
                    isActive ? ' sidebar__link--active' : ''
                  }`}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavigate(item.id)}
                >
                  <span
                    className={isActive ? 'material-symbols-filled' : 'material-symbols-outlined'}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
