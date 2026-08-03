export default function TopAppBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-outline-variant bg-surface/80 px-8 backdrop-blur-xl">
      <span className="font-display text-headline-md font-bold tracking-wide text-secondary-container">
        STUDY COPILOT
      </span>
      <span className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
        Geography · University
      </span>
    </header>
  )
}
