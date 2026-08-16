import { GlassCard, GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function GlinuiTestPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <GlassCard className="flex w-full max-w-sm flex-col gap-4">
        <GlassCardHeader>
          <h1 className="text-lg font-semibold">glinui component check</h1>
        </GlassCardHeader>
        <GlassCardContent className="flex flex-col gap-4">
          <Progress value={42} />
          <Input placeholder="Type something" />
          <Button>Click me</Button>
        </GlassCardContent>
      </GlassCard>
    </main>
  )
}
