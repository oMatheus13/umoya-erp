import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

type ModalSize = 'sm' | 'md' | 'lg'

type ModalProps = {
  open: boolean
  title?: string
  size?: ModalSize
  actions?: ReactNode
  onClose: () => void
  children: ReactNode
}

const Modal = ({ open, title, size = 'md', actions, onClose, children }: ModalProps) => {
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

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) {
    return null
  }

  const sizeClass = `modal__dialog--${size}`

  const modal = (
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
          <div className="modal__actions">
            {actions}
            <button className="button button--ghost" type="button" onClick={onClose}>
              <span
                className="material-symbols-outlined modal__action-icon"
                aria-hidden="true"
              >
                close
              </span>
              <span className="modal__action-label">Cancelar</span>
            </button>
          </div>
        </div>
        <div className="modal__content">{children}</div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return modal
  }

  return createPortal(modal, document.body)
}

export default Modal
