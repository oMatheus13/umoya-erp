import type { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  meta?: ReactNode
}

const PageHeader = ({ eyebrow, title, subtitle, actions, meta }: PageHeaderProps) => {
  return (
    <header className="ui-page__header">
      <div className="ui-page__headline">
        {eyebrow && <span className="ui-page__eyebrow">{eyebrow}</span>}
        <h1 className="ui-page__title">{title}</h1>
        {subtitle && <p className="ui-page__subtitle">{subtitle}</p>}
      </div>
      {(meta || actions) && (
        <div className="ui-page__aside">
          {meta && <div className="ui-page__meta">{meta}</div>}
          {actions && <div className="ui-page__actions">{actions}</div>}
        </div>
      )}
    </header>
  )
}

export default PageHeader
