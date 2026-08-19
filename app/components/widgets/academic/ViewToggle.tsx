'use client'

export type AcademicView = 'modules' | 'tasks'

export default function ViewToggle({
  view,
  onChange,
}: {
  view: AcademicView
  onChange: (view: AcademicView) => void
}) {
  return (
    <div className="inline-flex rounded-full border border-outline-variant p-0.5">
      {(['modules', 'tasks'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1 text-sm capitalize transition-colors ${
            view === v
              ? 'bg-academic-orange/10 text-academic-orange'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  )
}
