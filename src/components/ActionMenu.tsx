import { useEffect, useId, useRef, useState } from 'react'

export type ActionMenuItem = {
  label: string
  onClick: () => void
  variant?: 'danger'
  disabled?: boolean
}

type ActionMenuProps = {
  label?: string
  items: ActionMenuItem[]
}

const ActionMenu = ({ label = 'Opcoes', items }: ActionMenuProps) => {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) {
        return
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div className="action-menu" ref={containerRef}>
      <button
        className="action-menu__trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          more_horiz
        </span>
        <span className="sr-only">{label}</span>
      </button>
      {open && (
        <div className="action-menu__list" role="menu" id={menuId}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`action-menu__item${item.variant === 'danger' ? ' action-menu__item--danger' : ''}`}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              disabled={item.disabled}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ActionMenu
