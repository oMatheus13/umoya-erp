import { useMemo } from 'react'
import { useERPData } from '../../store/appStore'
import { formatCurrency, formatDateShort } from '../../utils/format'
import { resolveOrderCode } from '../../utils/orderCode'

type PdvHistoryProps = {
  onOpen?: (target: 'pedidos' | 'orcamentos', id: string) => void
}

const PdvHistory = ({ onOpen }: PdvHistoryProps) => {
  const { data } = useERPData()

  const orders = useMemo(
    () =>
      [...data.pedidos]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20),
    [data.pedidos],
  )
  const quotes = useMemo(
    () =>
      [...data.orcamentos]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20),
    [data.orcamentos],
  )

  const resolveClient = (clientId: string) =>
    data.clientes.find((client) => client.id === clientId)?.name ?? 'Cliente'

  return (
    <div className="pdv__history">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Ultimas vendas</h2>
            <p>Historico de vendas recentes.</p>
          </div>
          <span className="panel__meta">{orders.length} vendas</span>
        </div>
        <div className="list">
          {orders.map((order) => (
            <button
              key={order.id}
              type="button"
              className="list__item list__item--button list__item--center"
              onClick={() => onOpen?.('pedidos', order.id)}
              aria-label={`Abrir pedido ${resolveOrderCode(order)}`}
            >
              <div>
                <strong>#{resolveOrderCode(order)}</strong>
                <span className="list__meta">
                  {resolveClient(order.clientId)} · {formatDateShort(order.createdAt)}
                </span>
              </div>
              <strong>{formatCurrency(order.total)}</strong>
            </button>
          ))}
          {orders.length === 0 && <div className="list__empty">Sem vendas recentes.</div>}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Ultimos orcamentos</h2>
            <p>Historico de propostas recentes.</p>
          </div>
          <span className="panel__meta">{quotes.length} orcamentos</span>
        </div>
        <div className="list">
          {quotes.map((quote) => (
            <button
              key={quote.id}
              type="button"
              className="list__item list__item--button list__item--center"
              onClick={() => onOpen?.('orcamentos', quote.id)}
              aria-label={`Abrir orcamento ${quote.id.slice(-6)}`}
            >
              <div>
                <strong>#{quote.id.slice(-6)}</strong>
                <span className="list__meta">
                  {resolveClient(quote.clientId)} · {formatDateShort(quote.createdAt)}
                </span>
              </div>
              <strong>{formatCurrency(quote.total)}</strong>
            </button>
          ))}
          {quotes.length === 0 && (
            <div className="list__empty">Sem orcamentos recentes.</div>
          )}
        </div>
      </section>
    </div>
  )
}

export default PdvHistory
