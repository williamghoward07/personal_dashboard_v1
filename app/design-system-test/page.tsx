import { ModuleGlassCard } from "@/components/ui/module-glass-card"
import { GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card"
import { ProgressRing } from "@/components/ui/progress-ring"
import type { Accent } from "@/lib/theme"

const MODULES: { accent: Accent; label: string; value: number }[] = [
  { accent: "mint", label: "Health", value: 72 },
  { accent: "blue", label: "Money", value: 45 },
  { accent: "orange", label: "Education", value: 90 },
  { accent: "pink", label: "Research", value: 20 },
  { accent: "purple", label: "Habits", value: 100 },
]

export default function DesignSystemTestPage() {
  return (
    <main className="min-h-screen p-10">
      <h1 className="mb-8 text-2xl font-semibold text-foreground">
        BIO-SYSTEM x Liquid Glass — foundation check
      </h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {MODULES.map((mod) => (
          <ModuleGlassCard key={mod.accent} accent={mod.accent}>
            <GlassCardHeader>
              <h2 className="text-sm font-semibold uppercase tracking-wide">{mod.label}</h2>
            </GlassCardHeader>
            <GlassCardContent className="flex items-center justify-center py-4">
              <ProgressRing accent={mod.accent} value={mod.value} />
            </GlassCardContent>
          </ModuleGlassCard>
        ))}
      </div>
    </main>
  )
}
