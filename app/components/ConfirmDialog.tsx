'use client'

import Modal from './Modal'

export default function ConfirmDialog({
  isOpen,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!isOpen) return null

  return (
    <Modal onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-black/80 dark:text-white/80">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </Modal>
  )
}
