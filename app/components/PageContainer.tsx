import type { ReactNode } from 'react'

export default function PageContainer({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-8 py-6">
      <h1 className="text-xl font-semibold text-black/80 dark:text-white/80">
        {title}
      </h1>
      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {children}
      </div>
    </main>
  )
}
