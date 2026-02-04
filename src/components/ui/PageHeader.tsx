import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  meta?: ReactNode
}

const PageHeader = ({ title, subtitle, actions, meta }: PageHeaderProps) => {
  return (
    <header className="page-header">
      <div className="page-header__headline">
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {(meta || actions) && (
        <div className="page-header__aside">
          {meta && <div className="page-header__meta">{meta}</div>}
          {actions && <div className="page-header__actions">{actions}</div>}
        </div>
      )}
    </header>
  )
}

export default PageHeader
