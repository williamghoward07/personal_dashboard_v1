'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { ArrowLeft, Upload } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardHeader, GlassCardContent } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { parseStravaCsvRows } from '@/lib/health/strava-csv'
import ActivityImportReviewTable, { type ActivityReviewRow } from './ActivityImportReviewTable'

export default function StravaImportBoard() {
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ActivityReviewRow[] | null>(null)
  const [skippedRows, setSkippedRows] = useState(0)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)

  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    setParseError(null)

    try {
      const text = await file.text()
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
      const { candidates, skippedRows: skipped } = parseStravaCsvRows(parsed.data)

      if (candidates.length === 0) {
        setParseError(
          "Couldn't find any usable rows — this parser expects Strava's own bulk-export activities.csv column names, which may not match a re-saved or edited file."
        )
        setRows([])
        setSkippedRows(skipped)
        return
      }

      setSkippedRows(skipped)
      setRows(
        candidates.map((c, i) => ({
          id: `${i}`,
          included: true,
          date: c.occurred_at.slice(0, 10),
          activity_type: c.activity_type,
          duration_minutes: c.duration_minutes,
          distance_km: c.distance_km,
          elevation_gain_m: c.elevation_gain_m,
          external_id: c.external_id,
        }))
      )
    } catch {
      setParseError("Couldn't read that file — make sure it's the activities.csv from a Strava bulk export.")
    } finally {
      setParsing(false)
    }
  }

  const handleCommit = async () => {
    if (!rows) return
    const included = rows.filter((r) => r.included)
    if (included.length === 0) return

    setCommitting(true)
    setCommitError(null)

    try {
      const res = await fetch('/api/health/activity-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: included.map((r) => ({
            occurred_at: r.date,
            activity_type: r.activity_type,
            duration_minutes: r.duration_minutes,
            distance_km: r.distance_km,
            elevation_gain_m: r.elevation_gain_m,
            external_id: r.external_id,
          })),
        }),
      })

      if (!res.ok) {
        setCommitError('Failed to save activities — nothing was committed.')
        return
      }

      router.push('/health')
    } catch {
      setCommitError('Failed to save activities — nothing was committed.')
    } finally {
      setCommitting(false)
    }
  }

  const includedCount = rows?.filter((r) => r.included).length ?? 0

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <div>
        <Link
          href="/health"
          className="flex w-fit items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Health
        </Link>
        <h1 className="mt-1 font-display text-headline-lg font-bold text-on-surface">Import Strava data</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Upload the activities.csv from a Strava bulk export (Settings → My Account → Download or Delete Your
          Account), review what was found, then commit the ones you want to keep. Re-uploading the same file
          later updates matching activities in place rather than duplicating them.
        </p>
      </div>

      <ModuleGlassCard accent="mint" className="flex flex-col gap-4">
        <GlassCardHeader>
          <h2 className="font-display text-sm font-semibold text-foreground">1. Choose activities.csv</h2>
        </GlassCardHeader>
        <GlassCardContent className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            Strava export CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-on-surface-variant file:mr-3 file:rounded-md file:border file:border-outline-variant file:bg-surface-container-lowest file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-on-surface"
            />
          </label>

          {parseError && <p className="text-xs text-error">{parseError}</p>}

          <div>
            <Button type="button" size="sm" disabled={!file || parsing} onClick={handleParse}>
              <Upload className="h-4 w-4" />
              {parsing ? 'Reading CSV…' : 'Parse CSV'}
            </Button>
          </div>
        </GlassCardContent>
      </ModuleGlassCard>

      {rows && rows.length > 0 && (
        <>
          {skippedRows > 0 && (
            <p className="text-xs text-on-surface-variant">
              {skippedRows} row{skippedRows === 1 ? '' : 's'} in the CSV couldn&apos;t be read (missing or
              unrecognised date/type) and {skippedRows === 1 ? 'was' : 'were'} left out below.
            </p>
          )}

          <ActivityImportReviewTable rows={rows} onChange={setRows} />

          {commitError && <p className="text-xs text-error">{commitError}</p>}

          <div className="flex items-center gap-2">
            <Button type="button" disabled={committing || includedCount === 0} onClick={handleCommit}>
              {committing ? 'Saving…' : `Commit ${includedCount} activit${includedCount === 1 ? 'y' : 'ies'}`}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRows(null)}>
              Start over
            </Button>
          </div>
        </>
      )}
    </main>
  )
}
