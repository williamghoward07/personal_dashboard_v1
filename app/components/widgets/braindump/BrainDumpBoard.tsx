'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { ChevronDown, Square } from 'lucide-react'
import { brainDumpStore as store } from '@/lib/braindump/store'
import DraftList from '../../capture/DraftList'
import styles from './BrainDump.module.css'

const CAPTURE_HEADING = 'brain-dump-capture'
const REVIEW_HEADING = 'brain-dump-review'

type Step = 'capture' | 'review'

export default function BrainDumpBoard() {
  const { text, loading, error, drafts, lastExtractedText } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )
  const [selectedStep, setSelectedStep] = useState<Step | null>(null)
  const step = loading ? 'capture' : selectedStep ?? (drafts.length > 0 ? 'review' : 'capture')
  const stepperRef = useRef<HTMLElement>(null)
  const focusStep = useRef<Step | null>(null)
  const alreadyExtracted = text.trim() === lastExtractedText

  useEffect(() => {
    if (focusStep.current !== step) return
    focusStep.current = null
    if (stepperRef.current && getComputedStyle(stepperRef.current).display !== 'none') {
      document.getElementById(step === 'capture' ? CAPTURE_HEADING : REVIEW_HEADING)?.focus()
    }
  }, [step])

  const showStep = (next: Step) => {
    if (next !== step) focusStep.current = next
    setSelectedStep(next)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (alreadyExtracted) return
    setSelectedStep('capture')
    if (await store.submit(text)) {
      focusStep.current = 'review'
      setSelectedStep('review')
    }
  }

  return (
    <div className={styles.board} data-step={step}>
      <nav ref={stepperRef} className={styles.steps} aria-label="Brain dump steps">
        <button
          type="button"
          aria-current={step === 'capture' ? 'step' : undefined}
          aria-controls={CAPTURE_HEADING}
          onClick={() => showStep('capture')}
        >
          <span aria-hidden="true">1</span>
          Capture
        </button>
        <button
          type="button"
          aria-current={step === 'review' ? 'step' : undefined}
          aria-controls={REVIEW_HEADING}
          disabled={loading || (step !== 'review' && drafts.length === 0)}
          onClick={() => showStep('review')}
        >
          <span aria-hidden="true">2</span>
          Review
        </button>
      </nav>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <button type="button" className={styles.preview} aria-label="Back to capture" onClick={() => showStep('capture')}>
        <span>
          <strong>Capture</strong>
          <span>{text.trim() || 'Write another capture'}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      <div className={styles.panels}>
        <section className={styles.capture} aria-labelledby={CAPTURE_HEADING}>
          <h2 id={CAPTURE_HEADING} tabIndex={-1}>Capture</h2>
          <form className={styles.captureForm} onSubmit={handleSubmit}>
            <textarea
              value={text}
              onChange={(event) => store.setText(event.target.value)}
              rows={7}
              readOnly={loading}
              placeholder="Write or paste tasks, dates, and things to remember."
              aria-label="Capture text"
              aria-describedby="brain-dump-capture-help"
            />
            {loading ? (
              <button type="button" className={styles.primaryButton} onClick={store.stop}>
                <Square size={14} aria-hidden="true" />
                Stop
              </button>
            ) : (
              <button type="submit" className={styles.primaryButton} disabled={!text.trim() || alreadyExtracted}>
                Extract items
              </button>
            )}
            <p className={styles.captureHelp} id="brain-dump-capture-help" role="status">
              {loading
                ? 'Extracting drafts…'
                : alreadyExtracted
                  ? 'Drafts extracted. Edit the capture to extract again.'
                  : 'Extraction creates drafts. Confirm to save.'}
            </p>
          </form>
        </section>

        <DraftList store={store} tone="purple" reviewHeadingId={REVIEW_HEADING} />
      </div>
    </div>
  )
}
