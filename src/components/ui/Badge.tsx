import type { ReactNode } from 'react'

type BadgeProps = {
  children: ReactNode
  tone?: 'neutral' | 'info' | 'warning' | 'danger'
}

const Badge = ({ children, tone = 'neutral' }: BadgeProps) => {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>
}

export default Badge
