import { useId, useState, type ChangeEvent } from 'react'

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

const ActionMenu = ({ label = 'Acoes', items }: ActionMenuProps) => {
  const [value, setValue] = useState('')
  const menuId = useId()
  const singleItem = items.length === 1 ? items[0] : null

  if (singleItem) {
    return (
      <button
        type="button"
        className="action-menu action-menu--single button button--ghost button--sm"
        onClick={singleItem.onClick}
        disabled={singleItem.disabled}
        aria-label={singleItem.label}
      >
        <span className="material-symbols-outlined action-menu__icon" aria-hidden="true">
          edit
        </span>
        <span className="action-menu__label">{singleItem.label}</span>
      </button>
    )
  }

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = event.target.value
    setValue('')
    if (!selected) {
      return
    }
    const index = Number(selected)
    const action = items[index]
    if (action && !action.disabled) {
      action.onClick()
    }
  }

  return (
    <div className="action-menu button button--ghost button--icon">
      <span className="material-symbols-outlined action-menu__icon" aria-hidden="true">
        more_vert
      </span>
      <label className="sr-only" htmlFor={menuId}>
        {label}
      </label>
      <select
        id={menuId}
        className="action-menu__select"
        value={value}
        onChange={handleChange}
      >
        <option value="">{label}</option>
        {items.map((item, index) => (
          <option key={item.label} value={index} disabled={item.disabled}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default ActionMenu
