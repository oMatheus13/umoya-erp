import type { ReactNode } from 'react'

type PageProps = {
  children: ReactNode
  className?: string
}

const Page = ({ children, className }: PageProps) => {
  return <section className={`ui-page${className ? ` ${className}` : ''}`}>{children}</section>
}

export default Page
