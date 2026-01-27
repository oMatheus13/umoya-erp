import { useMemo, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { dataService } from '../services/dataService'
import { useERPData } from '../store/appStore'
import type { ProductionOrder } from '../types/erp'
import { formatDateShort } from '../utils/format'
import { createId } from '../utils/ids'

const statusLabels: Record<ProductionOrder['status'], string> = {
  aberta: 'Aberta',
  em_producao: 'Em producao',
  finalizada: 'Finalizada',
}

const Producao = () => {
  const { data, refresh } = useERPData()
  const [status, setStatus] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const productionOrders = useMemo(
    () =>
      [...data.ordensProducao].sort((a, b) =>
        (b.plannedAt ?? '').localeCompare(a.plannedAt ?? ''),
      ),
    [data.ordensProducao],
  )
  const productionSummary = useMemo(() => {
    return productionOrders.reduce(
      (acc, order) => {
        acc.total += 1
        if (order.status === 'aberta') {
          acc.open += 1
        }
        if (order.status === 'em_producao') {
          acc.active += 1
        }
        if (order.status === 'finalizada') {
          acc.done += 1
        }
        return acc
      },
      { total: 0, open: 0, active: 0, done: 0 },
    )
  }, [productionOrders])

  const getOrder = (id: string) => data.pedidos.find((order) => order.id === id)
  const getClientName = (id: string) =>
    data.clientes.find((client) => client.id === id)?.name ?? 'Cliente'
  const getProductName = (id: string) =>
    data.produtos.find((product) => product.id === id)?.name ?? 'Produto'
  const getVariant = (productId: string, variantId?: string) =>
    data.produtos
      .find((product) => product.id === productId)
      ?.variants?.find((variant) => variant.id === variantId)

  const updateProduction = (next: ProductionOrder) => {
    const payload = dataService.getAll()
    payload.ordensProducao = payload.ordensProducao.map((item) =>
      item.id === next.id ? next : item,
    )
    dataService.replaceAll(payload)
    refresh()
  }

  const handleStart = (order: ProductionOrder) => {
    if (order.status !== 'aberta') {
      return
    }
    updateProduction({
      ...order,
      status: 'em_producao',
      plannedAt: order.plannedAt ?? new Date().toISOString(),
    })
    setStatus(`Ordem ${order.id.slice(0, 6)} em producao.`)
  }

  const handleFinish = (order: ProductionOrder) => {
    if (order.status !== 'em_producao') {
      return
    }
    const nextOrder: ProductionOrder = {
      ...order,
      status: 'finalizada',
      finishedAt: new Date().toISOString(),
    }
    const payload = dataService.getAll()
    payload.ordensProducao = payload.ordensProducao.map((item) =>
      item.id === order.id ? nextOrder : item,
    )
    if (order.productId && order.quantity > 0) {
      const index = payload.produtos.findIndex((product) => product.id === order.productId)
      if (index >= 0) {
        const current = payload.produtos[index]
        const variants = current.variants ?? []
        const targetVariantId = order.variantId ?? variants[0]?.id
        const updatedVariants = variants.map((variant) =>
          variant.id === targetVariantId
            ? { ...variant, stock: (variant.stock ?? 0) + order.quantity }
            : variant,
        )
        payload.produtos[index] = {
          ...current,
          variants: updatedVariants,
        }
      }
    }
    dataService.replaceAll(payload)
    refresh()
    setStatus(`Ordem ${order.id.slice(0, 6)} finalizada.`)
  }

  const handleManualOrder = () => {
    const payload = dataService.getAll()
    const firstOrder = payload.pedidos[0]
    if (!firstOrder) {
      setStatus('Nenhum pedido disponivel para abrir producao.')
      return
    }
    const next: ProductionOrder = {
      id: createId(),
      orderId: firstOrder.id,
      productId: firstOrder.items[0]?.productId ?? '',
      variantId: firstOrder.items[0]?.variantId,
      quantity: firstOrder.items[0]?.quantity ?? 0,
      status: 'aberta',
      plannedAt: new Date().toISOString(),
    }
    payload.ordensProducao = [...payload.ordensProducao, next]
    dataService.replaceAll(payload)
    refresh()
    setStatus('Ordem de producao criada manualmente.')
  }

  const orderToDelete = deleteId
    ? data.ordensProducao.find((order) => order.id === deleteId)
    : null

  const handleDelete = () => {
    if (!deleteId) {
      return
    }
    const payload = dataService.getAll()
    const target = payload.ordensProducao.find((order) => order.id === deleteId)
    if (target && target.status === 'finalizada') {
      const productIndex = payload.produtos.findIndex(
        (product) => product.id === target.productId,
      )
      if (productIndex >= 0) {
        const current = payload.produtos[productIndex]
        const variants = current.variants ?? []
        const targetVariantId = target.variantId ?? variants[0]?.id
        payload.produtos[productIndex] = {
          ...current,
          variants: variants.map((variant) =>
            variant.id === targetVariantId
              ? { ...variant, stock: (variant.stock ?? 0) - target.quantity }
              : variant,
          ),
        }
      }
    }
    payload.ordensProducao = payload.ordensProducao.filter((order) => order.id !== deleteId)
    dataService.replaceAll(payload)
    refresh()
    setStatus('Ordem de producao excluida.')
    setDeleteId(null)
  }

  return (
    <section className="producao">
      <header className="producao__header">
        <div className="producao__headline">
          <span className="producao__eyebrow">Operacao</span>
          <h1 className="producao__title">Producao</h1>
          <p className="producao__subtitle">
            Ordens sao criadas automaticamente quando um pedido e marcado como pago.
          </p>
        </div>
        <div className="producao__actions">
          <button className="button button--ghost" type="button" onClick={handleManualOrder}>
            Criar ordem manual
          </button>
        </div>
      </header>

      {status && <p className="producao__status">{status}</p>}

      <div className="producao__summary">
        <article className="producao__stat">
          <span className="producao__stat-label">Total</span>
          <strong className="producao__stat-value">{productionSummary.total}</strong>
        </article>
        <article className="producao__stat">
          <span className="producao__stat-label">Abertas</span>
          <strong className="producao__stat-value">{productionSummary.open}</strong>
        </article>
        <article className="producao__stat">
          <span className="producao__stat-label">Em producao</span>
          <strong className="producao__stat-value">{productionSummary.active}</strong>
        </article>
        <article className="producao__stat">
          <span className="producao__stat-label">Finalizadas</span>
          <strong className="producao__stat-value">{productionSummary.done}</strong>
        </article>
      </div>

      <div className="producao__layout">
        <section className="producao__panel">
          <div className="producao__panel-header">
            <div>
              <h2>Ordens recentes</h2>
              <p>Movimente as ordens para iniciar ou finalizar a producao.</p>
            </div>
            <span className="producao__panel-meta">{productionOrders.length} registros</span>
          </div>
          <div className="producao__list">
            {productionOrders.length === 0 && (
              <div className="producao__empty">
                Nenhuma ordem criada. Marque pedidos como pagos para gerar producao.
              </div>
            )}
            {productionOrders.map((order) => {
              const pedido = getOrder(order.orderId)
              const item = pedido?.items[0]
              const productId = item?.productId ?? order.productId
              const variant = productId
                ? getVariant(productId, item?.variantId ?? order.variantId)
                : undefined
              return (
                <div key={order.id} className="producao__card">
                  <div className="producao__info">
                    <strong>Ordem #{order.id.slice(0, 6)}</strong>
                    <span>{pedido ? getClientName(pedido.clientId) : 'Pedido'}</span>
                    <span>
                      {productId ? getProductName(productId) : 'Produto'}
                      {variant ? ` • ${variant.name}` : ''}
                      {' • '}
                      {order.quantity}
                    </span>
                  </div>
                  <div className="producao__meta">
                    <span className={`badge badge--${order.status}`}>
                      {statusLabels[order.status]}
                    </span>
                    <span>Inicio: {formatDateShort(order.plannedAt ?? '')}</span>
                    <span>Fim: {formatDateShort(order.finishedAt ?? '')}</span>
                  </div>
                  <div className="producao__actions">
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => handleStart(order)}
                      disabled={order.status !== 'aberta'}
                    >
                      Iniciar
                    </button>
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={() => handleFinish(order)}
                      disabled={order.status !== 'em_producao'}
                    >
                      Finalizar
                    </button>
                    <button
                      className="button button--danger"
                      type="button"
                      onClick={() => setDeleteId(order.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={!!deleteId}
        title="Excluir ordem de producao?"
        description={
          orderToDelete
            ? `A ordem #${orderToDelete.id.slice(0, 6)} sera removida.`
            : 'Esta acao nao pode ser desfeita.'
        }
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </section>
  )
}

export default Producao
