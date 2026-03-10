import type { ReactNode } from 'react'

type SectionProps = {
  children: ReactNode
  className?: string
}

const Section = ({ children, className }: SectionProps) => {
  return <section className={`ui-section${className ? ` ${className}` : ''}`}>{children}</section>
}

export default Section
