import { Sparkles, Send } from 'lucide-react'

export default function AiQueryBar() {
  return (
    <form className="relative overflow-hidden rounded-xl border border-outline-variant bg-linear-to-br from-surface-container-low to-surface-container-lowest p-6 transition-all hover:border-academic-orange/40 hover:shadow-[0_0_15px_rgba(255,107,0,0.15)]">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-academic-orange bg-academic-orange/20 text-academic-orange">
          <Sparkles className="h-4 w-4" />
        </div>
        <h2 className="font-display text-headline-md text-on-surface">System Query</h2>
      </div>
      <div className="relative mt-4">
        <input
          type="text"
          placeholder="Ask across your modules — deadlines, spending, sessions, research..."
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-3.5 pl-4 pr-12 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-academic-orange"
          disabled
        />
        <button
          type="submit"
          disabled
          className="absolute right-3 top-1/2 -translate-y-1/2 text-academic-orange disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
