import { useState } from 'react'
import isotipo from '../assets/brand/isotipo.svg'
import logotipo from '../assets/brand/logotipo.svg'

type SidebarProps = {
  activePage: string
  onNavigate: (page: string) => void
  onHoverChange: (hovered: boolean) => void
}

type SidebarItem = {
  id: string
  label: string
  icon: string
}

type SidebarGroup =
  | {
      type: 'section'
      id: string
      label: string
      icon: string
    }
  | {
      type: 'group'
      id: string
      label: string
      icon: string
      items: SidebarItem[]
    }

const Sidebar = ({ activePage, onNavigate, onHoverChange }: SidebarProps) => {
  const sidebarGroups: SidebarGroup[] = [
    {
      type: 'section',
      id: 'dashboard',
      label: 'Painel',
      icon: 'space_dashboard',
    },
    {
      type: 'group',
      id: 'cadastros',
      label: 'Cadastros',
      icon: 'library_books',
      items: [
        { id: 'clientes', label: 'Clientes e obras', icon: 'groups' },
        { id: 'produtos', label: 'Produtos e pecas', icon: 'qr_code_2' },
        { id: 'cadastros-materiais', label: 'Materia-prima', icon: 'inventory_2' },
        { id: 'fornecedores', label: 'Fornecedores', icon: 'inventory' },
        { id: 'cadastros-tabelas', label: 'Tabelas', icon: 'table_chart' },
      ],
    },
    {
      type: 'group',
      id: 'vendas',
      label: 'Vendas',
      icon: 'sell',
      items: [
        { id: 'orcamentos', label: 'Orcamentos', icon: 'description' },
        { id: 'pedidos', label: 'Pedido de venda', icon: 'shopping_bag' },
      ],
    },
    {
      type: 'group',
      id: 'producao-group',
      label: 'Producao',
      icon: 'factory',
      items: [
        { id: 'producao', label: 'Ordens de producao', icon: 'factory' },
        { id: 'producao-lotes', label: 'Lotes', icon: 'view_module' },
        { id: 'producao-refugo', label: 'Refugo e retrabalho', icon: 'report_problem' },
      ],
    },
    {
      type: 'section',
      id: 'estoque',
      label: 'Estoque',
      icon: 'warehouse',
    },
    {
      type: 'section',
      id: 'compras',
      label: 'Compras',
      icon: 'shopping_cart',
    },
    {
      type: 'section',
      id: 'entregas',
      label: 'Logistica e entregas',
      icon: 'local_shipping',
    },
    {
      type: 'section',
      id: 'financeiro',
      label: 'Financeiro',
      icon: 'payments',
    },
    {
      type: 'section',
      id: 'fiscal',
      label: 'Fiscal',
      icon: 'receipt',
    },
    {
      type: 'group',
      id: 'rh',
      label: 'RH',
      icon: 'badge',
      items: [
        { id: 'funcionarios', label: 'Funcionarios', icon: 'badge' },
        { id: 'rh-presenca', label: 'Presenca', icon: 'how_to_reg' },
        { id: 'rh-pagamentos', label: 'Pagamentos', icon: 'payments' },
        { id: 'rh-historico', label: 'Historico', icon: 'history' },
        { id: 'rh-ocorrencias', label: 'Ocorrencias', icon: 'report' },
      ],
    },
    {
      type: 'section',
      id: 'qualidade',
      label: 'Qualidade e manutencao',
      icon: 'verified',
    },
    {
      type: 'group',
      id: 'relatorios',
      label: 'Relatorios',
      icon: 'insights',
      items: [
        { id: 'indicadores', label: 'Indicadores', icon: 'bar_chart' },
        { id: 'bi', label: 'BI', icon: 'query_stats' },
        { id: 'relatorios-producao', label: 'Producao por periodo', icon: 'factory' },
        { id: 'relatorios-vendas', label: 'Vendas por cliente e obra', icon: 'trending_up' },
        { id: 'relatorios-consumo', label: 'Consumo de material', icon: 'science' },
      ],
    },
    {
      type: 'group',
      id: 'configuracoes-group',
      label: 'Configuracoes',
      icon: 'settings',
      items: [
        { id: 'config-usuarios', label: 'Usuarios e permissoes', icon: 'admin_panel_settings' },
        { id: 'config-empresa', label: 'Empresa', icon: 'apartment' },
        { id: 'configuracoes', label: 'Parametros', icon: 'tune' },
        { id: 'config-integracoes', label: 'Integracoes', icon: 'hub' },
        { id: 'dados', label: 'Backup e exportacao', icon: 'cloud_upload' },
      ],
    },
    {
      type: 'group',
      id: 'auditoria',
      label: 'Auditoria e seguranca',
      icon: 'security',
      items: [
        { id: 'auditoria-log', label: 'Log de acoes', icon: 'history' },
        { id: 'auditoria-historico', label: 'Historico de alteracoes', icon: 'manage_search' },
        { id: 'auditoria-backup', label: 'Backup automatico', icon: 'backup' },
        { id: 'auditoria-acesso', label: 'Controle de acesso', icon: 'shield' },
      ],
    },
  ]

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sidebarGroups
        .filter((group) => group.type === 'group')
        .map((group) => [group.id, true]),
    ),
  )

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

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
        {sidebarGroups.map((group) => {
          if (group.type === 'section') {
            const isActive = activePage === group.id
            return (
              <div key={group.id} className="sidebar__group">
                <button
                  className={`sidebar__link sidebar__section${
                    isActive ? ' sidebar__section--active' : ''
                  }`}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavigate(group.id)}
                >
                  <span
                    className={isActive ? 'material-symbols-filled' : 'material-symbols-outlined'}
                    aria-hidden="true"
                  >
                    {group.icon}
                  </span>
                  <span>{group.label}</span>
                </button>
              </div>
            )
          }

          const isOpen = openGroups[group.id]
          return (
            <div key={group.id} className="sidebar__group">
              <button
                className="sidebar__toggle sidebar__section"
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="sidebar__toggle-label">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {group.icon}
                  </span>
                  <span>{group.label}</span>
                </span>
                <span
                  className={`material-symbols-outlined sidebar__caret${
                    isOpen ? ' sidebar__caret--open' : ''
                  }`}
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </button>
              {isOpen && (
                <nav className="sidebar__subnav" aria-label={group.label}>
                  {group.items.map((item) => {
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
                          className={
                            isActive ? 'material-symbols-filled' : 'material-symbols-outlined'
                          }
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
          )
        })}
      </nav>
    </aside>
  )
}

export default Sidebar
