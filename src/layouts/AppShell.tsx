import { useMemo, useState, type ReactNode } from 'react'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'

type AppShellProps = {
  children: ReactNode
  activePage: string
  onNavigate: (page: string) => void
  breadcrumbs: string[]
}

const AppShell = ({ children, activePage, onNavigate, breadcrumbs }: AppShellProps) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isSidebarHovered, setIsSidebarHovered] = useState(false)

  const appClassName = useMemo(() => {
    const classes = ['app']
    if (isSidebarCollapsed) {
      classes.push('app--sidebar-collapsed')
    }
    if (isSidebarCollapsed && isSidebarHovered) {
      classes.push('app--sidebar-hover')
    }
    return classes.join(' ')
  }, [isSidebarCollapsed, isSidebarHovered])

  const handleToggle = () => {
    setIsSidebarCollapsed((prev) => !prev)
    setIsSidebarHovered(false)
  }

  const handleHoverChange = (next: boolean) => {
    if (!isSidebarCollapsed) {
      return
    }
    setIsSidebarHovered(next)
  }

  return (
    <div className={appClassName}>
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggle}
        onHoverChange={handleHoverChange}
      />
      <main className="app__main">
        <Topbar breadcrumbs={breadcrumbs} />
        <div className="app__content">{children}</div>
      </main>
    </div>
  )
}

export default AppShell
