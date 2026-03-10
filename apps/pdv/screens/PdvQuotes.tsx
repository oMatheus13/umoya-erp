import Orcamentos from '../../erp/pages/vendas/Orcamentos'

type PdvQuotesProps = {
  openId?: string
  onConsumeOpen?: () => void
}

const PdvQuotes = ({ openId, onConsumeOpen }: PdvQuotesProps) => {
  return (
    <div className="pdv__module">
      <Orcamentos openQuoteId={openId} onConsumeOpen={onConsumeOpen} />
    </div>
  )
}

export default PdvQuotes
