import type { ReactNode } from 'react'

type PanelProps = {
  children: ReactNode
  className?: string
}

const Panel = ({ children, className }: PanelProps) => {
  return <div className={`ui-panel${className ? ` ${className}` : ''}`}>{children}</div>
}

export default Panel
