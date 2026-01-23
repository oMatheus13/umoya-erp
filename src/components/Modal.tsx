import { useEffect, useId } from 'react'
import type { ReactNode } from 'react'

type ModalSize = 'sm' | 'md' | 'lg'

type ModalProps = {
  open: boolean
  title?: string
  size?: ModalSize
  onClose: () => void
  children: ReactNode
}

const Modal = ({ open, title, size = 'md', onClose, children }: ModalProps) => {
  const titleId = useId()

  useEffect(() => {
    if (!open) {
      return
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) {
    return null
  }

  const sizeClass = `modal__dialog--${size}`

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`modal__dialog ${sizeClass}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          {title && (
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
          )}
          <button className="button button--ghost" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default Modal
