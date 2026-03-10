import type { PermissionKey, PermissionLevel } from '@shared/types/erp'

export const PERMISSION_LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: 'none', label: 'Sem acesso' },
  { value: 'view', label: 'Visualizar' },
  { value: 'edit', label: 'Editar' },
]

export type PermissionGroup = {
  id: string
  label: string
  items: { key: PermissionKey; label: string }[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'painel',
    label: 'Painel',
    items: [{ key: 'dashboard', label: 'Resumo geral' }],
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    items: [
      { key: 'clientes', label: 'Clientes e obras' },
      { key: 'produtos', label: 'Produtos e peças' },
      { key: 'cadastros-materiais', label: 'Matéria-prima' },
      { key: 'fornecedores', label: 'Fornecedores' },
      { key: 'cadastros-tabelas', label: 'Tabelas' },
    ],
  },
  {
    id: 'vendas',
    label: 'Vendas',
    items: [
      { key: 'orcamentos', label: 'Orçamentos' },
      { key: 'pedidos', label: 'Pedido de venda' },
    ],
  },
  {
    id: 'producao',
    label: 'Produção',
    items: [
      { key: 'producao', label: 'Ordens de produção' },
      { key: 'producao-lotes', label: 'Lotes' },
      { key: 'producao-refugo', label: 'Refugo e retrabalho' },
      { key: 'producao-consumo', label: 'Consumo por produto' },
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    items: [
      { key: 'estoque', label: 'Estoque consolidado' },
      { key: 'estoque-formas', label: 'Formas e moldes' },
      { key: 'estoque-materiais', label: 'Matéria-prima' },
    ],
  },
  {
    id: 'operacao',
    label: 'Operação',
    items: [
      { key: 'compras', label: 'Compras' },
      { key: 'entregas', label: 'Logística e entregas' },
      { key: 'financeiro', label: 'Financeiro' },
      { key: 'fiscal', label: 'Fiscal' },
    ],
  },
  {
    id: 'rh',
    label: 'RH',
    items: [
      { key: 'funcionarios', label: 'Funcionários' },
      { key: 'rh-presenca', label: 'Presença' },
      { key: 'rh-pagamentos', label: 'Pagamentos' },
      { key: 'rh-historico', label: 'Histórico' },
      { key: 'rh-ocorrencias', label: 'Ocorrências' },
    ],
  },
  {
    id: 'qualidade',
    label: 'Qualidade e manutenção',
    items: [{ key: 'qualidade', label: 'Qualidade e manutenção' }],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    items: [
      { key: 'indicadores', label: 'Indicadores' },
      { key: 'bi', label: 'BI' },
      { key: 'relatorios-historico', label: 'Historico completo' },
      { key: 'relatorios-producao', label: 'Produção por período' },
      { key: 'relatorios-vendas', label: 'Vendas por cliente e obra' },
      { key: 'relatorios-consumo', label: 'Consumo de material' },
    ],
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    items: [
      { key: 'perfil', label: 'Meu perfil' },
      { key: 'config-usuarios', label: 'Usuários e permissões' },
      { key: 'config-empresa', label: 'Empresa' },
      { key: 'configuracoes', label: 'Parâmetros' },
      { key: 'config-integracoes', label: 'Integrações' },
      { key: 'dados', label: 'Backup e exportação' },
    ],
  },
  {
    id: 'auditoria',
    label: 'Auditoria e segurança',
    items: [
      { key: 'auditoria-log', label: 'Log de ações' },
      { key: 'auditoria-historico', label: 'Histórico de alterações' },
      { key: 'auditoria-backup', label: 'Backup automático' },
      { key: 'auditoria-acesso', label: 'Controle de acesso' },
    ],
  },
]

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap((group) =>
  group.items.map((item) => item.key),
)

export const PERMISSION_KEY_SET = new Set<PermissionKey>(ALL_PERMISSION_KEYS)

export const isPermissionKey = (value: string): value is PermissionKey =>
  PERMISSION_KEY_SET.has(value as PermissionKey)
