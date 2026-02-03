import type { ReactNode } from 'react'

type SummaryProps = {
  children: ReactNode
  className?: string
}

const Summary = ({ children, className }: SummaryProps) => {
  return <div className={`ui-summary${className ? ` ${className}` : ''}`}>{children}</div>
}

export default Summary
