'use client'

import Modal from '../../Modal'
import PassagePanel from './PassagePanel'
import type { BiblePassage } from '@/lib/bible/types'

export default function PassagePanelModal({
  passage,
  defaultNote,
  onClose,
}: {
  passage: BiblePassage | null
  defaultNote?: string
  onClose: () => void
}) {
  if (!passage) return null

  return (
    <Modal onClose={onClose} size="lg">
      <PassagePanel passage={passage} defaultNote={defaultNote} />
    </Modal>
  )
}
