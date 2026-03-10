import type { ReactNode } from 'react'

type SectionHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
}

const SectionHeader = ({ title, subtitle, actions }: SectionHeaderProps) => {
  return (
    <div className="ui-section__header">
      <div>
        <h2 className="ui-section__title">{title}</h2>
        {subtitle && <p className="ui-section__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ui-section__actions">{actions}</div>}
    </div>
  )
}

export default SectionHeader
