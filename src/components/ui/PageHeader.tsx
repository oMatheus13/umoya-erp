import type { ReactNode } from 'react'
import { PAGE_META } from '../../data/navigation'
import { usePageId } from './PageContext'

type PageHeaderProps = {
  title?: string
  subtitle?: string
  actions?: ReactNode
  meta?: ReactNode
}

const PageHeader = ({ title, subtitle, actions, meta }: PageHeaderProps) => {
  const pageId = usePageId()
  const resolvedTitle = pageId ? PAGE_META[pageId]?.title ?? title : title
  return (
    <header className="page-header">
      <div className="page-header__headline">
        <h1 className="page-header__title">{resolvedTitle ?? 'Módulo'}</h1>
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
