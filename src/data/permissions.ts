import type { PermissionKey, PermissionLevel } from '../types/erp'

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
      { key: 'produtos', label: 'Produtos e pecas' },
      { key: 'cadastros-materiais', label: 'Materia-prima' },
      { key: 'fornecedores', label: 'Fornecedores' },
      { key: 'cadastros-tabelas', label: 'Tabelas' },
    ],
  },
  {
    id: 'vendas',
    label: 'Vendas',
    items: [
      { key: 'orcamentos', label: 'Orcamentos' },
      { key: 'pedidos', label: 'Pedido de venda' },
    ],
  },
  {
    id: 'producao',
    label: 'Producao',
    items: [
      { key: 'producao', label: 'Ordens de producao' },
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
      { key: 'estoque-materiais', label: 'Materia-prima' },
    ],
  },
  {
    id: 'operacao',
    label: 'Operacao',
    items: [
      { key: 'compras', label: 'Compras' },
      { key: 'entregas', label: 'Logistica e entregas' },
      { key: 'financeiro', label: 'Financeiro' },
      { key: 'fiscal', label: 'Fiscal' },
    ],
  },
  {
    id: 'rh',
    label: 'RH',
    items: [
      { key: 'funcionarios', label: 'Funcionarios' },
      { key: 'rh-presenca', label: 'Presenca' },
      { key: 'rh-pagamentos', label: 'Pagamentos' },
      { key: 'rh-historico', label: 'Historico' },
      { key: 'rh-ocorrencias', label: 'Ocorrencias' },
    ],
  },
  {
    id: 'qualidade',
    label: 'Qualidade e manutencao',
    items: [{ key: 'qualidade', label: 'Qualidade e manutencao' }],
  },
  {
    id: 'relatorios',
    label: 'Relatorios',
    items: [
      { key: 'indicadores', label: 'Indicadores' },
      { key: 'bi', label: 'BI' },
      { key: 'relatorios-producao', label: 'Producao por periodo' },
      { key: 'relatorios-vendas', label: 'Vendas por cliente e obra' },
      { key: 'relatorios-consumo', label: 'Consumo de material' },
    ],
  },
  {
    id: 'configuracoes',
    label: 'Configuracoes',
    items: [
      { key: 'perfil', label: 'Meu perfil' },
      { key: 'config-usuarios', label: 'Usuarios e permissoes' },
      { key: 'config-empresa', label: 'Empresa' },
      { key: 'configuracoes', label: 'Parametros' },
      { key: 'config-integracoes', label: 'Integracoes' },
      { key: 'dados', label: 'Backup e exportacao' },
    ],
  },
  {
    id: 'auditoria',
    label: 'Auditoria e seguranca',
    items: [
      { key: 'auditoria-log', label: 'Log de acoes' },
      { key: 'auditoria-historico', label: 'Historico de alteracoes' },
      { key: 'auditoria-backup', label: 'Backup automatico' },
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
