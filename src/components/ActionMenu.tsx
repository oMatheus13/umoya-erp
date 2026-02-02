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
    <div className="action-menu">
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
