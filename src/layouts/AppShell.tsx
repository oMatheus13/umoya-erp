import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import type { SidebarMode } from '../types/ui'

type AppShellProps = {
  children: ReactNode
  activePage: string
  onNavigate: (page: string) => void
  breadcrumbs: string[]
  sidebarMode: SidebarMode
  userName?: string
  onLogout?: () => void
}

const AppShell = ({
  children,
  activePage,
  onNavigate,
  breadcrumbs,
  sidebarMode,
  userName,
  onLogout,
}: AppShellProps) => {
  const [isSidebarHovered, setIsSidebarHovered] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const isCollapsed = sidebarMode !== 'expanded'
  const isHoverMode = sidebarMode === 'hover'

  const appClassName = useMemo(() => {
    const classes = ['app']
    if (isCollapsed) {
      classes.push('app--sidebar-collapsed')
    }
    if (isHoverMode && isSidebarHovered) {
      classes.push('app--sidebar-hover')
    }
    if (isMobileSidebarOpen) {
      classes.push('app--mobile-sidebar-open')
    }
    return classes.join(' ')
  }, [isCollapsed, isHoverMode, isSidebarHovered, isMobileSidebarOpen])

  const handleHoverChange = (next: boolean) => {
    if (!isHoverMode) {
      return
    }
    setIsSidebarHovered(next)
  }

  useEffect(() => {
    if (sidebarMode !== 'hover') {
      setIsSidebarHovered(false)
      return
    }
    if (typeof document === 'undefined') {
      return
    }
    const sidebar = document.querySelector('.app__sidebar')
    setIsSidebarHovered(sidebar ? sidebar.matches(':hover') : false)
  }, [sidebarMode])

  const handleNavigate = (page: string) => {
    onNavigate(page)
    setIsMobileSidebarOpen(false)
  }

  return (
    <div className={appClassName}>
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        onHoverChange={handleHoverChange}
      />
      {isMobileSidebarOpen && (
        <button
          className="app__overlay"
          type="button"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <main className="app__main">
        <Topbar
          breadcrumbs={breadcrumbs}
          userName={userName}
          onLogout={onLogout}
          onMenuToggle={() => setIsMobileSidebarOpen((prev) => !prev)}
          isMenuOpen={isMobileSidebarOpen}
        />
        <div className="app__content">{children}</div>
      </main>
    </div>
  )
}

export default AppShell
