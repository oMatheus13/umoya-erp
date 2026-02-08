import type {
  ERPData,
  Material,
  Product,
  ProductMaterialUsage,
  ProductVariant,
} from '../types/erp'
import { createEmptyState } from './storage'

export const DEV_MODE_KEY = 'umoya_erp_dev_mode'
export const DEV_BACKUP_KEY = 'umoya_erp_dev_backup'
export const DEV_SEEDED_KEY = 'umoya_erp_dev_seeded'

const today = () => new Date().toISOString()

export const createDevSeed = (userId: string): ERPData => {
  const seed = createEmptyState()
  const now = today()

  seed.empresa = {
    name: 'Umoya Pre-Moldados LTDA',
    tradeName: 'Umoya',
    document: '12.345.678/0001-90',
    email: 'contato@umoya.com.br',
    phone: '(11) 99999-0000',
    street: 'Rua da Fabrica',
    number: '120',
    neighborhood: 'Distrito Industrial',
    city: 'Sao Paulo',
    state: 'SP',
    zip: '01000-000',
    website: 'www.umoya.com.br',
  }

  const materials: Material[] = [
    {
      id: 'mat-cimento',
      name: 'Cimento CP II',
      unit: 'saco_50kg',
      kind: 'cimento',
      cost: 32,
      marketUnitPrice: 36,
      lotSize: 40,
      marketLotPrice: 1400,
      stock: 18,
      active: true,
    },
    {
      id: 'mat-areia',
      name: 'Areia lavada',
      unit: 'm3',
      kind: 'areia',
      cost: 180,
      marketUnitPrice: 200,
      stock: 3.5,
      active: true,
    },
    {
      id: 'mat-trelica',
      name: 'Trelica TG8',
      unit: 'unidade',
      kind: 'trelica',
      metersPerUnit: 12,
      cost: 48,
      marketUnitPrice: 60,
      stock: 20,
      active: true,
    },
  ]
  seed.materiais = materials

  seed.moldes = [
    {
      id: 'mold-1',
      name: 'Forma viga 5m',
      code: 'FV-5M',
      length: 5,
      stock: 9,
    },
    {
      id: 'mold-2',
      name: 'Forma pingadeira',
      code: 'FP-30',
      length: 0.3,
      stock: 12,
    },
  ]

  seed.fornecedores = [
    {
      id: 'for-1',
      name: 'Cimentos Alfa',
      contact: 'Mario',
      phone: '(11) 98888-0000',
      city: 'Sao Paulo',
      active: true,
    },
  ]

  const pingadeiraVariants: ProductVariant[] = [
    {
      id: 'var-ping-30',
      productId: 'prod-pingadeira',
      name: 'Pingadeira 30cm',
      length: 0.3,
      stock: 14,
      sku: 'PING-30',
      priceOverride: 42,
      costOverride: 18,
    },
    {
      id: 'var-ping-50',
      productId: 'prod-pingadeira',
      name: 'Pingadeira 50cm',
      length: 0.5,
      stock: 9,
      sku: 'PING-50',
      priceOverride: 55,
      costOverride: 24,
    },
  ]

  const vigaUsages: ProductMaterialUsage[] = [
    {
      id: 'usage-viga-areia',
      materialId: 'mat-areia',
      quantity: 0.03,
      usageUnit: 'balde',
    },
    {
      id: 'usage-viga-cimento',
      materialId: 'mat-cimento',
      quantity: 0.08,
      usageUnit: 'saco',
    },
    {
      id: 'usage-viga-trelica',
      materialId: 'mat-trelica',
      quantity: 1,
      usageUnit: 'metro',
    },
  ]

  const pingadeiraUsages: ProductMaterialUsage[] = [
    {
      id: 'usage-ping-areia',
      materialId: 'mat-areia',
      quantity: 0.02,
      usageUnit: 'balde',
    },
    {
      id: 'usage-ping-cimento',
      materialId: 'mat-cimento',
      quantity: 0.05,
      usageUnit: 'saco',
    },
  ]

  const products: Product[] = [
    {
      id: 'prod-viga',
      name: 'Viga pre-moldada',
      price: 60,
      priceMin: 52,
      maxDiscountPercent: 12,
      costPrice: 35,
      laborCost: 10,
      laborBasis: 'metro',
      unit: 'metro_linear',
      active: true,
      producedInternally: true,
      materialUsages: vigaUsages,
      hasVariants: false,
    },
    {
      id: 'prod-pingadeira',
      name: 'Pingadeira',
      price: 45,
      priceMin: 40,
      maxDiscountPercent: 10,
      costPrice: 20,
      laborCost: 8,
      laborBasis: 'unidade',
      unit: 'unidade',
      active: true,
      producedInternally: true,
      materialUsages: pingadeiraUsages,
      variants: pingadeiraVariants,
      hasVariants: true,
    },
  ]

  seed.produtos = products

  seed.clientes = [
    {
      id: 'cli-1',
      name: 'Construtora Azul',
      document: '12.345.678/0001-00',
      phone: '(11) 90000-0000',
      city: 'Sao Paulo',
      active: true,
      obras: [
        {
          id: 'obra-1',
          name: 'Residencial Sol',
          address: 'Rua das Flores, 520',
          city: 'Sao Paulo',
          active: true,
        },
      ],
    },
  ]

  seed.orcamentos = [
    {
      id: 'orc-1',
      clientId: 'cli-1',
      obraId: 'obra-1',
      items: [
        {
          productId: 'prod-viga',
          quantity: 10,
          unitPrice: 120,
          customLength: 2,
        },
      ],
      total: 1200,
      fulfillment: 'producao',
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      status: 'aprovado',
      createdAt: now,
      convertedOrderId: 'ped-1',
    },
  ]

  seed.pedidos = [
    {
      id: 'ped-1',
      clientId: 'cli-1',
      obraId: 'obra-1',
      items: [
        {
          productId: 'prod-viga',
          quantity: 10,
          unitPrice: 120,
          customLength: 2,
        },
      ],
      total: 1200,
      paymentMethod: 'pix',
      fulfillment: 'producao',
      status: 'pago',
      createdAt: now,
      sourceQuoteId: 'orc-1',
    },
  ]

  seed.ordensProducao = [
    {
      id: 'op-1',
      orderId: 'ped-1',
      productId: 'prod-viga',
      quantity: 10,
      status: 'em_producao',
      plannedAt: now,
      source: 'pedido',
      customLength: 2,
    },
  ]

  seed.entregas = [
    {
      id: 'del-1',
      orderId: 'ped-1',
      productionOrderId: 'op-1',
      clientId: 'cli-1',
      obraId: 'obra-1',
      address: 'Rua das Flores, 520',
      status: 'pendente',
      createdAt: now,
      scheduledAt: new Date().toISOString().slice(0, 10),
    },
  ]

  seed.financeiro = [
    {
      id: 'fin-1',
      type: 'entrada',
      description: 'Pedido ped-1',
      amount: 1200,
      createdAt: now,
      cashboxId: 'caixa_bancario',
    },
    {
      id: 'fin-2',
      type: 'saida',
      description: 'Compra: Cimento CP II x40',
      amount: 1400,
      category: 'Compras',
      createdAt: now,
      cashboxId: 'caixa_operacional',
    },
  ]
  seed.pdvCaixas = []
  seed.pdvMovimentacoes = []

  seed.comprasHistorico = [
    {
      id: 'cmp-1',
      supplierId: 'for-1',
      purchaseDate: new Date().toISOString().slice(0, 10),
      notes: 'Compra de reposicao',
      items: [
        {
          id: 'cmp-item-1',
          type: 'material',
          materialId: 'mat-cimento',
          description: 'Cimento CP II',
          quantity: 40,
          unitPrice: 35,
          pricingMode: 'lot',
          total: 1400,
        },
      ],
      total: 1400,
      createdAt: now,
    },
  ]

  seed.usuarios = [
    {
      id: userId,
      name: 'Dev Umoya',
      displayName: 'Dev',
      email: 'dev@umoya.local',
      role: 'admin',
      createdAt: now,
      active: true,
    },
  ]

  return seed
}
