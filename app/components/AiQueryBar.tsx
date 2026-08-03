export default function AiQueryBar() {
  return (
    <form className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white/60 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5">
      <span className="text-lg" aria-hidden>
        ✦
      </span>
      <input
        type="text"
        placeholder="Ask across your modules — deadlines, spending, sessions, research..."
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-black/40 dark:placeholder:text-white/40"
        disabled
      />
      <button
        type="submit"
        disabled
        className="rounded-lg bg-black/80 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white/80 dark:text-black"
      >
        Ask
      </button>
    </form>
  )
}