import Pedidos from '../../pages/vendas/Pedidos'

type PdvOrdersProps = {
  openId?: string
  onConsumeOpen?: () => void
}

const PdvOrders = ({ openId, onConsumeOpen }: PdvOrdersProps) => {
  return (
    <div className="pdv__module">
      <Pedidos openOrderId={openId} onConsumeOpen={onConsumeOpen} />
    </div>
  )
}

export default PdvOrders
