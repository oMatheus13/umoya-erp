export type NavigationItem = {
  id: string
  label: string
  icon: string
}

export type NavigationGroup =
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
      items: NavigationItem[]
    }

export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    type: 'section',
    id: 'dashboard',
    label: 'Visão Geral',
    icon: 'dashboard_2',
  },

  {
    type: 'group',
    id: 'site-group',
    label: 'Site',
    icon: 'public',
    items: [
      { id: 'site-contatos', label: 'Mensagens do Site', icon: 'mail' },
    ],
  },
  {
    type: 'group',
    id: 'cadastros',
    label: 'Cadastros',
    icon: 'app_registration',
    items: [
      { id: 'clientes', label: 'Clientes e Obras', icon: 'groups' },
      { id: 'produtos', label: 'Produtos e Peças', icon: 'shoppingmode' },
      { id: 'cadastros-materiais', label: 'Matéria-prima', icon: 'brick' },
      { id: 'fornecedores', label: 'Fornecedores', icon: 'inventory' },
      { id: 'cadastros-tabelas', label: 'Tabelas', icon: 'table' },
    ],
  },
  {
    type: 'group',
    id: 'vendas',
    label: 'Vendas',
    icon: 'point_of_sale',
    items: [
      { id: 'orcamentos', label: 'Orçamentos', icon: 'description' },
      { id: 'pedidos', label: 'Pedidos', icon: 'shopping_bag' },
    ],
  },
  {
    type: 'group',
    id: 'producao-group',
    label: 'Produção',
    icon: 'factory',
    items: [
      { id: 'producao', label: 'Ordens', icon: 'forklift' },
      { id: 'producao-lotes', label: 'Lotes', icon: 'view_module' },
      { id: 'producao-refugo', label: 'Refugo e Retrabalho', icon: 'report_problem' },
      { id: 'producao-consumo', label: 'Consumo Por Produto', icon: 'science' },
    ],
  },
  {
    type: 'group',
    id: 'estoque-group',
    label: 'Estoque',
    icon: 'warehouse',
    items: [
      { id: 'estoque', label: 'Estoque Consolidado', icon: 'warehouse' },
      { id: 'estoque-formas', label: 'Formas e Moldes', icon: 'view_module' },
      { id: 'estoque-materiais', label: 'Matéria-prima', icon: 'inventory_2' },
    ],
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
    label: 'Logística e Entregas',
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
      { id: 'funcionarios', label: 'Funcionários', icon: 'badge' },
      { id: 'rh-presenca', label: 'Presença', icon: 'how_to_reg' },
      { id: 'rh-pagamentos', label: 'Pagamentos', icon: 'payments' },
      { id: 'rh-historico', label: 'Histórico', icon: 'history' },
      { id: 'rh-ocorrencias', label: 'Ocorrências', icon: 'report' },
    ],
  },
  {
    type: 'section',
    id: 'qualidade',
    label: 'Qualidade e Manutenção',
    icon: 'verified',
  },
  {
    type: 'group',
    id: 'relatorios',
    label: 'Relatórios',
    icon: 'insights',
    items: [
      { id: 'indicadores', label: 'Indicadores', icon: 'bar_chart' },
      { id: 'bi', label: 'BI', icon: 'query_stats' },
      { id: 'relatorios-historico', label: 'Historico completo', icon: 'history' },
      { id: 'relatorios-producao', label: 'Produção Por Período', icon: 'factory' },
      { id: 'relatorios-vendas', label: 'Vendas por Cliente e Obra', icon: 'trending_up' },
      { id: 'relatorios-consumo', label: 'Consumo de Material', icon: 'science' },
    ],
  },
  {
    type: 'group',
    id: 'configuracoes-group',
    label: 'Configurações',
    icon: 'settings',
    items: [
      { id: 'perfil', label: 'Meu Perfil', icon: 'account_circle' },
      { id: 'config-usuarios', label: 'Usuários e Permissões', icon: 'admin_panel_settings' },
      { id: 'config-empresa', label: 'Empresa', icon: 'apartment' },
      { id: 'configuracoes', label: 'Parâmetros', icon: 'tune' },
      { id: 'config-integracoes', label: 'Integrações', icon: 'hub' },
      { id: 'dados', label: 'Backup e Exportação', icon: 'cloud_upload' },
    ],
  },
  {
    type: 'group',
    id: 'auditoria',
    label: 'Auditoria e Segurança',
    icon: 'security',
    items: [
      { id: 'auditoria-log', label: 'Log de Ações', icon: 'history' },
      { id: 'auditoria-historico', label: 'Histórico de Alterações', icon: 'manage_search' },
      { id: 'auditoria-backup', label: 'Backup Automático', icon: 'backup' },
      { id: 'auditoria-acesso', label: 'Controle de Acesso', icon: 'shield' },
    ],
  },
]

export type PageMeta = {
  title: string
  breadcrumbs: string[]
}

const buildPageMeta = (groups: NavigationGroup[]) => {
  const entries: Array<[string, PageMeta]> = []
  groups.forEach((group) => {
    if (group.type === 'section') {
      entries.push([group.id, { title: group.label, breadcrumbs: [group.label] }])
      return
    }
    group.items.forEach((item) => {
      entries.push([
        item.id,
        { title: item.label, breadcrumbs: [group.label, item.label] },
      ])
    })
  })
  return Object.fromEntries(entries) as Record<string, PageMeta>
}

export const PAGE_META = buildPageMeta(NAVIGATION_GROUPS)
