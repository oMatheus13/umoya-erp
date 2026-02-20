import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import { PageProvider } from '../components/ui/PageContext'
import type { PageIntentAction, SidebarMode } from '../types/ui'

type AppShellProps = {
  children: ReactNode
  activePage: string
  onNavigate: (page: string, intent?: PageIntentAction) => void
  breadcrumbs: string[]
  sidebarMode: SidebarMode
  userName?: string
  userRoleLabel?: string
  userAvatarUrl?: string
  userAvatarColor?: string
  onLogout?: () => void
  canView?: (pageId: string) => boolean
  canEdit?: boolean
  isPageTransitioning?: boolean
  showDevTools?: boolean
}

const AppShell = ({
  children,
  activePage,
  onNavigate,
  breadcrumbs,
  sidebarMode,
  userName,
  userRoleLabel,
  userAvatarUrl,
  userAvatarColor,
  onLogout,
  canView,
  canEdit,
  isPageTransitioning,
  showDevTools,
}: AppShellProps) => {
  const [isSidebarHovered, setIsSidebarHovered] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSensitiveHidden, setIsSensitiveHidden] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem('umoya_sensitive_hidden') === 'true'
  })
  const isCollapsed = sidebarMode !== 'expanded'
  const isHoverMode = sidebarMode === 'hover'
  const isReadOnly = canEdit === false

  const appClassName = useMemo(() => {
    const classes = ['app']
    if (isCollapsed) {
      classes.push('app--sidebar-collapsed')
    }
    if (isHoverMode && isSidebarHovered) {
      classes.push('app--sidebar-hover')
    }
    if (isReadOnly) {
      classes.push('app--readonly')
    }
    if (isMobileSidebarOpen) {
      classes.push('app--mobile-sidebar-open')
    }
    return classes.join(' ')
  }, [isCollapsed, isHoverMode, isReadOnly, isSidebarHovered, isMobileSidebarOpen])

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

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.sensitiveHidden = isSensitiveHidden ? 'true' : 'false'
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'umoya_sensitive_hidden',
        isSensitiveHidden ? 'true' : 'false',
      )
    }
  }, [isSensitiveHidden])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    const container = document.querySelector('.app__content')
    if (!container) {
      return
    }
    const clear = () => {
      container.querySelectorAll('.sensitive-blur').forEach((node) => {
        node.classList.remove('sensitive-blur')
      })
    }
    if (!isSensitiveHidden) {
      clear()
      return
    }
    const mark = () => {
      clear()
      const nodes = container.querySelectorAll<HTMLElement>(
        'td, th, span, strong, p, div, li, small, label',
      )
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          return
        }
        if (node.textContent?.includes('R$')) {
          node.classList.add('sensitive-blur')
        }
      })
    }
    const id = window.requestAnimationFrame(mark)
    return () => window.cancelAnimationFrame(id)
  }, [isSensitiveHidden, activePage])

  const handleNavigate = (page: string, intent?: PageIntentAction) => {
    onNavigate(page, intent)
    setIsMobileSidebarOpen(false)
  }

  return (
    <div className={appClassName}>
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        onHoverChange={handleHoverChange}
        canView={canView}
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
          userRoleLabel={userRoleLabel}
          userAvatarUrl={userAvatarUrl}
          userAvatarColor={userAvatarColor}
          onLogout={onLogout}
          onMenuToggle={() => setIsMobileSidebarOpen((prev) => !prev)}
          isMenuOpen={isMobileSidebarOpen}
          readOnly={isReadOnly}
          isSensitiveHidden={isSensitiveHidden}
          onSensitiveToggle={() => setIsSensitiveHidden((prev) => !prev)}
          onProfileOpen={() => onNavigate('perfil')}
          onNavigate={handleNavigate}
          canView={canView}
          showDevTools={showDevTools}
        />
        <PageProvider pageId={activePage}>
          <div
            className="app__content"
            data-readonly={isReadOnly ? 'true' : undefined}
            data-page-transition={isPageTransitioning ? 'out' : undefined}
          >
            {children}
          </div>
        </PageProvider>
      </main>
    </div>
  )
}

export default AppShell
