'use client'

// Visual proof surface for the BIO-SYSTEM shared components (DESIGN.md §4).
// Every component in components/ui is rendered here in every variant and
// every accent, so a regression is visible rather than theoretical.

import { useState } from 'react'
import {
  Activity,
  BookOpen,
  Brain,
  Check,
  ExternalLink,
  Flame,
  Link2,
  Plus,
  Search,
  Settings,
  Trash2,
} from 'lucide-react'

import { Button, type ButtonProps } from '@/components/ui/button'
import { CountBadge } from '@/components/ui/count-badge'
import {
  DataTable,
  DataTableAvatar,
  DataTableBody,
  DataTableBulkBar,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableRowActions,
} from '@/components/ui/data-table'
import { EntityChip } from '@/components/ui/entity-chip'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { GlassCardContent, GlassCardHeader } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { MetadataChip } from '@/components/ui/metadata-chip'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { Progress } from '@/components/ui/progress'
import { ProgressRing } from '@/components/ui/progress-ring'
import { StatTile } from '@/components/ui/stat-tile'
import { StatusBadge } from '@/components/ui/status-badge'
import { Timeline, TimelineEntry } from '@/components/ui/timeline'
import WidgetCard from '@/app/components/WidgetCard'
import { ACCENTS, ACCENT_VAR, type UiAccent } from '@/lib/theme'

const UI_ACCENTS: readonly UiAccent[] = [...ACCENTS, 'ws']

const BUTTON_VARIANTS: readonly NonNullable<ButtonProps['variant']>[] = [
  'default',
  'secondary',
  'outline',
  'quiet',
  'ghost',
  'icon',
  'destructive',
  'accent',
  'dashed',
]

const SURFACES = [
  ['surface-container-lowest', 'bg-surface-container-lowest'],
  ['background / surface', 'bg-background'],
  ['surface-container-low', 'bg-surface-container-low'],
  ['surface-container', 'bg-surface-container'],
  ['surface-container-high', 'bg-surface-container-high'],
  ['surface-container-highest', 'bg-surface-container-highest'],
  ['surface-bright', 'bg-surface-bright'],
  ['outline-variant', 'bg-outline-variant'],
  ['outline', 'bg-outline'],
] as const

const SPACING = [
  ['unit — 4px', 'w-unit'],
  ['gutter — 16px', 'w-gutter'],
  ['card-gap — 20px', 'w-card-gap'],
  ['container-padding — 24px', 'w-container-padding'],
  ['margin-desktop — 40px', 'w-margin-desktop'],
] as const

type TableRow = { id: string; handle: string; name: string; accent: UiAccent; status: string }

const TABLE_ROWS: TableRow[] = [
  { id: '1', handle: '@coastal.geo', name: 'Coastal Geo', accent: 'mint', status: 'Linked' },
  { id: '2', handle: '@erosion.watch', name: 'Erosion Watch', accent: 'amber', status: 'Unlinked' },
  { id: '3', handle: '@fieldwork.uk', name: 'Fieldwork UK', accent: 'blue', status: 'Linked' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="headline-md text-primary">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-40 shrink-0 label-caps text-outline">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

export default function DesignSystemTestPage() {
  const [tab, setTab] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [compactTab, setCompactTab] = useState<'day' | 'week' | 'month'>('week')
  const [chips, setChips] = useState(['Ada Lovelace', 'Coastal Erosion Essay', 'GEOG2041'])
  const [activeTag, setActiveTag] = useState<string | null>('method')

  return (
    <main className="mx-auto flex max-w-[1720px] flex-col gap-10 p-container-padding">
      <header className="flex flex-col gap-2">
        <h1 className="headline-xl text-primary">BIO-SYSTEM component check</h1>
        <p className="body-md text-on-surface-variant">
          Every shared component in <code className="font-mono text-sm">components/ui</code>, in
          every variant and accent. The reference is DESIGN.md §4.
        </p>
      </header>

      {/* ---------------------------------------------------------------- */}
      <Section title="§2 Surface ladder">
        <div className="grid grid-cols-3 gap-card-gap md:grid-cols-5 lg:grid-cols-9">
          {SURFACES.map(([label, bg]) => (
            <div key={label} className="flex flex-col gap-2">
              <div className={`h-16 rounded-xl border border-outline-variant ${bg}`} />
              <span className="text-[11px] text-on-surface-variant">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-card-gap">
          {UI_ACCENTS.map((accent) => (
            <div key={accent} className="flex flex-col items-center gap-2">
              <div
                className="h-12 w-12 rounded-full"
                style={{ background: ACCENT_VAR[accent], ...(accent === 'ws' ? { ['--ws-accent' as string]: ACCENT_VAR.pink } : {}) }}
              />
              <span className="label-caps text-outline">{accent}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="§3 Type scale">
        <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-container-padding">
          <span className="data-display text-primary">94.2</span>
          <span className="headline-xl text-primary">headline-xl — Instagram Follows</span>
          <span className="headline-lg text-primary">headline-lg — 482</span>
          <span className="headline-lg-mobile text-primary">headline-lg-mobile</span>
          <span className="headline-md text-primary">headline-md — Scoped Sources</span>
          <span className="body-lg text-on-surface">body-lg — lead paragraph, rarely used.</span>
          <span className="body-md text-on-surface">body-md — default body copy.</span>
          <span className="body-sm text-on-surface">body-sm — the workhorse: cells, inputs.</span>
          <span className="label-caps text-on-surface-variant">label-caps metadata</span>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="§5.3 Spacing steps">
        <div className="flex flex-col gap-2">
          {SPACING.map(([label, w]) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`h-3 rounded-sm bg-primary-container ${w}`} />
              <span className="text-xs text-on-surface-variant">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="§4.4 Buttons">
        {BUTTON_VARIANTS.map((variant) => (
          <Row key={variant ?? 'default'} label={String(variant)}>
            <Button variant={variant} size="sm">
              Small
            </Button>
            <Button variant={variant}>Medium</Button>
            <Button variant={variant} size="lg">
              Large
            </Button>
            <Button variant={variant}>
              <Plus className="h-4 w-4" /> With icon
            </Button>
            <Button variant={variant} size="icon" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant={variant} size="icon-sm" aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant={variant} disabled>
              Disabled
            </Button>
          </Row>
        ))}
        <Row label="primary / accent">
          {UI_ACCENTS.map((accent) => (
            <div
              key={accent}
              className="flex items-center gap-2"
              style={accent === 'ws' ? ({ ['--ws-accent' as string]: ACCENT_VAR.pink } as React.CSSProperties) : undefined}
            >
              <Button accent={accent} size="sm">
                {accent}
              </Button>
              <Button variant="accent" accent={accent} size="sm">
                {accent}
              </Button>
            </div>
          ))}
        </Row>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="§4.6 Inputs">
        <Row label="default / card / ghost">
          <Input placeholder="Chrome input (rounded-lg)" className="w-64" />
          <Input variant="card" placeholder="In-card input (rounded-xl)" className="w-64" />
          <Input variant="ghost" placeholder="Inline editable cell" className="w-64" />
        </Row>
        <Row label="sizes">
          <Input size="sm" placeholder="sm" className="w-40" />
          <Input size="md" placeholder="md" className="w-40" />
          <Input size="lg" placeholder="lg" className="w-40" />
          <Input placeholder="disabled" className="w-40" disabled />
        </Row>
        <Row label="leading icon">
          <div className="relative w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline"
              aria-hidden
            />
            <Input placeholder="Search everything" className="pl-9" accent="orange" />
          </div>
        </Row>
        <Row label="focus accent">
          {UI_ACCENTS.map((accent) => (
            <Input
              key={accent}
              accent={accent}
              size="sm"
              placeholder={accent}
              className="w-28"
              style={accent === 'ws' ? ({ ['--ws-accent' as string]: ACCENT_VAR.pink } as React.CSSProperties) : undefined}
            />
          ))}
        </Row>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="§4.7 Progress">
        <Row label="bar">
          <div className="flex w-80 flex-col gap-3">
            <Progress value={30} size="sm" />
            <Progress value={62} />
            <Progress value={91} size="lg" />
            <Progress indeterminate />
          </div>
        </Row>
        <Row label="rings">
          {UI_ACCENTS.map((accent) => (
            <ProgressRing
              key={accent}
              accent={accent}
              value={(UI_ACCENTS.indexOf(accent) + 1) * 10}
              style={accent === 'ws' ? ({ ['--ws-accent' as string]: ACCENT_VAR.pink } as React.CSSProperties) : undefined}
            />
          ))}
        </Row>
        <Row label="ring sizes">
          <ProgressRing accent="mint" value={45} size="sm" />
          <ProgressRing accent="mint" value={45} size="md" />
          <ProgressRing accent="mint" value={45} size="lg" />
          <ProgressRing accent="mint" indeterminate size="md" />
        </Row>
        <Row label="stat tiles">
          <div className="grid w-full grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile
              label="Task progress"
              value="62%"
              detail="8 of 13 done"
              percent={62}
              accent="teal"
              icon={<Check className="h-5 w-5" strokeWidth={2} />}
              ringTitle="Scoped actions completed"
            />
            <StatTile
              label="Sources"
              value="14"
              unit="links"
              detail="6 with a DOI"
              percent={40}
              accent="pink"
              icon={<Link2 className="h-5 w-5" strokeWidth={2} />}
            />
            <StatTile
              label="Thinking log"
              value="27"
              detail="9 in the last week"
              percent={33}
              accent="purple"
              icon={<Brain className="h-5 w-5" strokeWidth={2} />}
            />
            <StatTile label="Streak" value="12" unit="days" detail="Best: 21" accent="orange" />
          </div>
        </Row>
        <Row label="hero / bare">
          <StatTile
            label="Focus index"
            value="94.2"
            unit="IDX"
            size="lg"
            percent={94}
            accent="mint"
            icon={<Activity className="h-5 w-5" strokeWidth={2} />}
            className="w-80"
          />
          <StatTile label="Bare variant" value="482" detail="no card shell" variant="bare" percent={70} accent="blue" />
        </Row>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="§4.5 Badges and chips">
        <Row label="StatusBadge">
          {UI_ACCENTS.map((accent) => (
            <StatusBadge
              key={accent}
              accent={accent}
              style={accent === 'ws' ? ({ ['--ws-accent' as string]: ACCENT_VAR.pink } as React.CSSProperties) : undefined}
            >
              {accent}
            </StatusBadge>
          ))}
        </Row>
        <Row label="dot / pulse / ping">
          <StatusBadge accent="mint" dot="static">
            Static
          </StatusBadge>
          <StatusBadge accent="orange" dot="pulse">
            Active
          </StatusBadge>
          <StatusBadge accent="crimson" dot="ping">
            Streaming
          </StatusBadge>
          <StatusBadge accent="blue" size="sm" dot>
            Small
          </StatusBadge>
          <StatusBadge accent="amber" icon={<Flame className="h-3 w-3" />}>
            With icon
          </StatusBadge>
        </Row>
        <Row label="CountBadge">
          {UI_ACCENTS.map((accent) => (
            <CountBadge
              key={accent}
              accent={accent}
              count={12}
              style={accent === 'ws' ? ({ ['--ws-accent' as string]: ACCENT_VAR.pink } as React.CSSProperties) : undefined}
            />
          ))}
          <CountBadge accent="mint" count={1240} max={99} />
        </Row>
        <Row label="MetadataChip">
          <MetadataChip accent="teal">6 Sources</MetadataChip>
          <MetadataChip accent="purple">4 Scoped actions</MetadataChip>
          <MetadataChip accent="orange" icon={<BookOpen className="h-3 w-3" />}>
            GEOG2041
          </MetadataChip>
          <MetadataChip>Unfiled</MetadataChip>
        </Row>
        <Row label="EntityChip">
          {chips.map((name, index) => (
            <EntityChip
              key={name}
              name={name}
              accent={UI_ACCENTS[index % UI_ACCENTS.length]}
              onRemove={() => setChips((current) => current.filter((c) => c !== name))}
            />
          ))}
          <EntityChip name="Read only" accent="amber" />
          {chips.length === 0 && (
            <Button size="sm" variant="ghost" onClick={() => setChips(['Ada Lovelace'])}>
              Reset chips
            </Button>
          )}
        </Row>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="§4.10 Filter tabs">
        <Row label="md">
          <FilterTabs
            aria-label="Filter follows"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: 'All', count: 482 },
              { value: 'linked', label: 'Linked', count: 128 },
              { value: 'unlinked', label: 'Unlinked', count: 354 },
            ]}
          />
        </Row>
        <Row label="compact">
          <FilterTabs
            size="compact"
            accent="blue"
            aria-label="Range"
            value={compactTab}
            onChange={setCompactTab}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
        </Row>
        <Row label="accents">
          {UI_ACCENTS.map((accent) => (
            <div
              key={accent}
              style={accent === 'ws' ? ({ ['--ws-accent' as string]: ACCENT_VAR.pink } as React.CSSProperties) : undefined}
            >
              <FilterTabs
                size="compact"
                accent={accent}
                aria-label={`${accent} example`}
                value="on"
                onChange={() => {}}
                options={[
                  { value: 'on', label: accent },
                  { value: 'off', label: 'Off' },
                ]}
              />
            </div>
          ))}
        </Row>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="§4.8 Data table">
        <DataTableBulkBar>
          <span className="label-caps text-on-surface-variant">2 selected</span>
          <Button size="sm" variant="secondary">
            Link to person
          </Button>
          <Button size="sm" variant="destructive">
            Archive
          </Button>
        </DataTableBulkBar>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low">
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Account</DataTableHeaderCell>
                <DataTableHeaderCell>Display name</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {TABLE_ROWS.map((row, index) => (
                <DataTableRow key={row.id} selected={index === 0}>
                  <DataTableCell>
                    <span className="flex items-center gap-3">
                      <DataTableAvatar name={row.name} accent={row.accent} />
                      <span className="font-mono text-sm">{row.handle}</span>
                    </span>
                  </DataTableCell>
                  <DataTableCell>{row.name}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      size="sm"
                      accent={row.status === 'Linked' ? 'mint' : 'amber'}
                      dot={row.status === 'Linked' ? 'static' : false}
                    >
                      {row.status}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell align="right">
                    <DataTableRowActions>
                      <Button variant="icon" size="icon-sm" aria-label="Open">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="destructive" size="icon-sm" aria-label="Unlink">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </DataTableRowActions>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="§4.9 Timeline">
        <Timeline className="max-w-2xl">
          <TimelineEntry
            accent="teal"
            kind="Decision"
            kindIcon={<Check className="h-3 w-3" />}
            timestamp="Today, 14:15"
            dateTime="2026-09-20T14:15:00Z"
            tags={['method', 'scope']}
            activeTag={activeTag}
            onTagClick={(tag) => setActiveTag((current) => (current === tag ? null : tag))}
          >
            Narrowed the case study to Holderness so the sediment-budget data actually exists for
            the whole period.
          </TimelineEntry>
          <TimelineEntry
            accent="pink"
            kind="Question"
            timestamp="Yesterday, 18:30"
            tags={['sources']}
            footnote="Raised while reading Dean (2019)."
          >
            Does the 1991 baseline survey use the same datum as the 2018 LiDAR?
          </TimelineEntry>
          <TimelineEntry accent="neutral" timestamp="12 Sep, 09:40">
            Plain entry with no kind pill and no tags.
          </TimelineEntry>
        </Timeline>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="Cards">
        <div className="grid grid-cols-1 gap-card-gap sm:grid-cols-2 xl:grid-cols-4">
          {(['mint', 'blue', 'orange', 'pink'] as const).map((accent) => (
            <WidgetCard
              key={accent}
              accent={accent}
              title={`WidgetCard — ${accent}`}
              icon={<Activity className="h-4 w-4" />}
              action={<CountBadge count={3} accent={accent} />}
            >
              Hover for the §4.3 Cyber Glow in this card accent.
            </WidgetCard>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-card-gap sm:grid-cols-2 lg:grid-cols-5">
          {ACCENTS.slice(0, 5).map((accent) => (
            <ModuleGlassCard key={accent} accent={accent}>
              <GlassCardHeader>
                <h3 className="label-caps text-on-surface-variant">{accent}</h3>
              </GlassCardHeader>
              <GlassCardContent className="flex items-center justify-center py-4">
                <ProgressRing accent={accent} value={40 + ACCENTS.indexOf(accent) * 12} />
              </GlassCardContent>
            </ModuleGlassCard>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="Workspace accent (--ws-accent)">
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-container-padding"
          style={{ ['--ws-accent' as string]: ACCENT_VAR.crimson } as React.CSSProperties}
        >
          <span className="label-caps text-outline">accent=&quot;ws&quot; follows the container</span>
          <StatusBadge accent="ws" dot="pulse">
            Live
          </StatusBadge>
          <CountBadge accent="ws" count={7} />
          <MetadataChip accent="ws">6 Sources</MetadataChip>
          <EntityChip accent="ws" name="Coastal Erosion Essay" onRemove={() => {}} />
          <Button accent="ws" size="sm">
            Primary
          </Button>
          <Button variant="accent" accent="ws" size="sm">
            Ghost accent
          </Button>
          <ProgressRing accent="ws" value={68} size="sm" />
        </div>
      </Section>
    </main>
  )
}
