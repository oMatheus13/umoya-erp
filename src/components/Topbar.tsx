import { useEffect, useState } from 'react'

type TopbarProps = {
  breadcrumbs: string[]
  userName?: string
  userRoleLabel?: string
  userAvatarUrl?: string
  userAvatarColor?: string
  onLogout?: () => void
  onMenuToggle?: () => void
  isMenuOpen?: boolean
  readOnly?: boolean
  isSensitiveHidden?: boolean
  onSensitiveToggle?: () => void
  onProfileOpen?: () => void
}

const Topbar = ({
  breadcrumbs: _breadcrumbs,
  userName,
  userRoleLabel,
  userAvatarUrl,
  userAvatarColor,
  onLogout,
  onMenuToggle,
  isMenuOpen,
  readOnly,
  isSensitiveHidden,
  onSensitiveToggle,
  onProfileOpen,
}: TopbarProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const avatarFallback = userName?.[0] ?? 'U'
  const avatarPalette: Record<string, string> = {
    lime: 'var(--color-lime)',
    ink: 'var(--color-ink)',
    sand: '#d9d3c7',
    night: '#1b1f2a',
  }
  const avatarBackground = userAvatarColor
    ? avatarPalette[userAvatarColor] ?? userAvatarColor
    : 'var(--color-ink)'

  useEffect(() => {
    if (!isSearchOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen])
  return (
    <header className="topbar">
      <div className="topbar__left">
        {onMenuToggle && (
          <button
            className="topbar__menu"
            type="button"
            onClick={onMenuToggle}
            aria-label="Abrir menu"
            aria-expanded={isMenuOpen}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              menu
            </span>
          </button>
        )}
        <button
          className="topbar__search-toggle"
          type="button"
          onClick={() => setIsSearchOpen(true)}
          aria-label="Buscar no ERP"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            search
          </span>
        </button>
        <div className="topbar__search">
          <span className="material-symbols-outlined" aria-hidden="true">
            search
          </span>
          <input type="search" placeholder="Buscar no ERP" aria-label="Buscar no ERP" />
        </div>
      </div>
      <div className="topbar__right">
        {readOnly && <span className="topbar__badge">Somente leitura</span>}
        <button
          className="topbar__icon"
          type="button"
          onClick={onSensitiveToggle}
          aria-label={isSensitiveHidden ? 'Mostrar informacoes' : 'Ocultar informacoes'}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {isSensitiveHidden ? 'visibility_off' : 'visibility'}
          </span>
        </button>
        <button className="topbar__icon" type="button" aria-label="Notificacoes">
          <span className="material-symbols-outlined" aria-hidden="true">
            notifications
          </span>
        </button>
        <div className="topbar__profile">
          <button className="topbar__profile-main" type="button" onClick={onProfileOpen}>
            {userAvatarUrl ? (
              <img className="topbar__avatar" src={userAvatarUrl} alt={userName ?? 'Usuario'} />
            ) : (
              <span className="topbar__avatar" style={{ background: avatarBackground }}>
                {avatarFallback}
              </span>
            )}
            <span className="topbar__profile-text">
              <span className="topbar__profile-name">{userName ?? 'Usuario'}</span>
              <span className="topbar__profile-role">{userRoleLabel ?? 'Equipe'}</span>
            </span>
          </button>
          {onLogout && (
            <button className="topbar__logout-icon" type="button" onClick={onLogout}>
              <span className="material-symbols-outlined" aria-hidden="true">
                logout
              </span>
            </button>
          )}
        </div>
      </div>
      {isSearchOpen && (
        <div
          className="topbar__search-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsSearchOpen(false)}
        >
          <div className="topbar__search-surface" onClick={(event) => event.stopPropagation()}>
            <span className="material-symbols-outlined" aria-hidden="true">
              search
            </span>
            <input type="search" placeholder="Buscar no ERP" aria-label="Buscar no ERP" autoFocus />
            <button
              className="topbar__search-close"
              type="button"
              onClick={() => setIsSearchOpen(false)}
              aria-label="Fechar busca"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

export default Topbar
