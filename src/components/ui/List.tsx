import type { ReactNode } from 'react'

type ListProps = {
  children: ReactNode
  className?: string
}

const List = ({ children, className }: ListProps) => {
  return <div className={`ui-list${className ? ` ${className}` : ''}`}>{children}</div>
}

export default List
