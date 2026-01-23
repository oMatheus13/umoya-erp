import Modal from './Modal'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onClose: () => void
}

const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  onConfirm,
  onClose,
}: ConfirmDialogProps) => (
  <Modal open={open} title={title} onClose={onClose} size="sm">
    {description && <p className="modal__description">{description}</p>}
    <div className="form__actions">
      <button className="button button--ghost" type="button" onClick={onClose}>
        {cancelLabel}
      </button>
      <button className="button button--danger" type="button" onClick={onConfirm}>
        {confirmLabel}
      </button>
    </div>
  </Modal>
)

export default ConfirmDialog
