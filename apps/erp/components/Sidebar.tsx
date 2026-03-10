import { useState } from 'react'
import isotipo from '@shared/assets/brand/isotipo.svg'
import logotipo from '@shared/assets/brand/logotipo.svg'
import { NAVIGATION_GROUPS } from '../data/navigation'

type SidebarProps = {
  activePage: string
  onNavigate: (page: string) => void
  onHoverChange: (hovered: boolean) => void
  canView?: (pageId: string) => boolean
}

const Sidebar = ({ activePage, onNavigate, onHoverChange, canView }: SidebarProps) => {
  const sidebarGroups = NAVIGATION_GROUPS

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sidebarGroups
        .filter((group) => group.type === 'group')
        .map((group) => [group.id, true]),
    ),
  )

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  return (
    <aside
      className="app__sidebar sidebar"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div className="sidebar__brand">
        <img className="sidebar__logo sidebar__logo--full" src={logotipo} alt="Umoya" />
        <img className="sidebar__logo sidebar__logo--mark" src={isotipo} alt="Umoya" />
      </div>

      <nav className="sidebar__nav" aria-label="Navegação principal">
        {sidebarGroups.flatMap((group) => {
          if (group.type === 'section') {
            if (canView && !canView(group.id)) {
              return []
            }
            const isActive = activePage === group.id
            return (
              <div key={group.id} className="sidebar__group">
                <button
                  className={`sidebar__link sidebar__section${
                    isActive ? ' sidebar__section--active sidebar__link--active' : ''
                  }`}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavigate(group.id)}
                >
                  <span
                    className={isActive ? 'material-symbols-filled' : 'material-symbols-outlined'}
                    aria-hidden="true"
                  >
                    {group.icon}
                  </span>
                  <span>{group.label}</span>
                </button>
              </div>
            )
          }

          const visibleItems = canView
            ? group.items.filter((item) => canView(item.id))
            : group.items
          if (visibleItems.length === 0) {
            return []
          }
          const isOpen = openGroups[group.id]
          const isGroupActive = visibleItems.some((item) => item.id === activePage)
          return (
            <div key={group.id} className="sidebar__group">
              <button
                className={`sidebar__toggle sidebar__section${
                  isGroupActive ? ' sidebar__section--active' : ''
                }`}
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="sidebar__toggle-label">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {group.icon}
                  </span>
                  <span>{group.label}</span>
                </span>
                <span
                  className={`material-symbols-outlined sidebar__caret${
                    isOpen ? ' sidebar__caret--open' : ''
                  }`}
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </button>
              {isOpen && (
                <nav className="sidebar__subnav" aria-label={group.label}>
                  {visibleItems.map((item) => {
                    const isActive = activePage === item.id
                    return (
                      <button
                        key={item.id}
                        className={`sidebar__link sidebar__link--sub${
                          isActive ? ' sidebar__link--active' : ''
                        }`}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => onNavigate(item.id)}
                      >
                        <span
                          className={
                            isActive ? 'material-symbols-filled' : 'material-symbols-outlined'
                          }
                          aria-hidden="true"
                        >
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </button>
                    )
                  })}
                </nav>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

export default Sidebar
