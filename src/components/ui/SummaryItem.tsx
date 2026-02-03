import type { ReactNode } from 'react'

type SummaryItemProps = {
  label: string
  value: ReactNode
  meta?: ReactNode
}

const SummaryItem = ({ label, value, meta }: SummaryItemProps) => {
  return (
    <div className="ui-summary__item">
      <span className="ui-summary__label">{label}</span>
      <strong className="ui-summary__value">{value}</strong>
      {meta && <span className="ui-summary__meta">{meta}</span>}
    </div>
  )
}

export default SummaryItem
