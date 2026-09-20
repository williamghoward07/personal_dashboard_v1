'use client'

import Modal from './Modal'

export default function ConfirmDialog({
  isOpen,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!isOpen) return null

  return (
    <Modal onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <p className="whitespace-pre-line text-sm text-on-surface-variant">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-error-container px-3 py-1.5 text-sm text-on-error-container hover:brightness-110"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
