import type { ReactNode } from 'react'

type ListItemProps = {
  title: ReactNode
  value?: ReactNode
  meta?: ReactNode
}

const ListItem = ({ title, value, meta }: ListItemProps) => {
  return (
    <div className="ui-list__item">
      <div className="ui-list__item-main">
        <span className="ui-list__item-title">{title}</span>
        {meta && <span className="ui-list__item-meta">{meta}</span>}
      </div>
      {value !== undefined && <strong className="ui-list__item-value">{value}</strong>}
    </div>
  )
}

export default ListItem
