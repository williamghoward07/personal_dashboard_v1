'use client'

import { useEffect, useMemo, useState } from 'react'
import { AtSign, Link2, Upload, UserCheck, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { InstagramAccount, InstagramEvent, InstagramImport, Person } from '@/lib/types'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import { relationshipLabel } from '@/lib/people/instagram-import'
import WidgetCard from '../../WidgetCard'
import InstagramImportModal from './InstagramImportModal'
import PersonFormModal, { type PersonFormValues } from './PersonFormModal'
import { formatDate } from './shared'

type Filter = 'all' | 'followed_you' | 'you_followed'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'followed_you', label: 'Followed you' },
  { id: 'you_followed', label: 'You followed' },
]

const PAGE = 8
const EVENT_LIMIT = 200
const MIGRATION_HINT = 'Has supabase/migrations/20260917030000_instagram_log.sql been run?'

interface AddingPerson {
  account: InstagramAccount
  preset: Partial<Person>
}

// Timeline of new follows / followers, built from pasted screenshot
// imports (see InstagramImportModal). Accounts can be turned into People
// contacts, or linked to one with the same name.
export default function InstagramLogCard({ people, onChange }: { people: Person[]; onChange: () => void }) {
  const todayKey = useMemo(() => londonDayBoundsUTC().startDateKey, [])
  const [accounts, setAccounts] = useState<InstagramAccount[]>([])
  const [events, setEvents] = useState<InstagramEvent[]>([])
  const [lastImport, setLastImport] = useState<InstagramImport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [shown, setShown] = useState(PAGE)
  const [importOpen, setImportOpen] = useState(false)
  // Preset kept in state: PersonFormModal re-seeds whenever initialValues changes identity.
  const [adding, setAdding] = useState<AddingPerson | null>(null)

  const refresh = () => {
    Promise.all([
      supabase.from('instagram_accounts').select('*'),
      supabase
        .from('instagram_events')
        .select('*')
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(EVENT_LIMIT),
      supabase.from('instagram_imports').select('*').order('created_at', { ascending: false }).limit(1),
    ]).then(([a, e, i]) => {
      const firstError = a.error ?? e.error ?? i.error
      setError(firstError ? `Couldn't load the Instagram log: ${firstError.message}. ${MIGRATION_HINT}` : null)
      setAccounts((a.data ?? []) as InstagramAccount[])
      setEvents((e.data ?? []) as InstagramEvent[])
      setLastImport(((i.data ?? [])[0] as InstagramImport | undefined) ?? null)
      setLoading(false)
    })
  }

  useEffect(refresh, [])

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const peopleByName = useMemo(
    () => new Map(people.filter((p) => !p.archived).map((p) => [p.full_name.trim().toLowerCase(), p])),
    [people]
  )

  const counts = useMemo(
    () => ({
      following: accounts.filter((a) => a.i_follow).length,
      followers: accounts.filter((a) => a.follows_me).length,
      mutual: accounts.filter((a) => a.i_follow && a.follows_me).length,
    }),
    [accounts]
  )

  const visibleEvents = useMemo(
    () => events.filter((e) => filter === 'all' || e.kind === filter),
    [events, filter]
  )

  const linkPerson = async (accountId: string, personId: string) => {
    const { error: linkError } = await supabase
      .from('instagram_accounts')
      .update({ person_id: personId, updated_at: new Date().toISOString() })
      .eq('id', accountId)
    if (linkError) {
      setError(`Couldn't link: ${linkError.message}`)
      return false
    }
    refresh()
    return true
  }

  const startAdding = (account: InstagramAccount) =>
    setAdding({
      account,
      preset: {
        full_name: account.display_name ?? account.username,
        notes: `Instagram: @${account.username}`,
        tags: ['instagram'],
      },
    })

  const savePerson = async (values: PersonFormValues) => {
    if (!adding) return
    const { data, error: insertError } = await supabase.from('people').insert(values).select('id').single()
    if (insertError || !data) {
      setError(`Couldn't add person: ${insertError?.message ?? 'unknown error'}`)
      return
    }
    if (await linkPerson(adding.account.id, data.id)) setAdding(null)
    onChange()
  }

  const firstImport = !lastImport && accounts.length === 0

  return (
    <WidgetCard
      title="Instagram log"
      accent="amber"
      icon={<AtSign className="h-4 w-4" />}
      action={
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-people-amber"
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </button>
      }
      className="sm:col-span-2"
    >
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {error && <p className="text-xs text-error">{error}</p>}
          {message && <p className="text-xs text-people-amber">{message}</p>}

          {firstImport ? (
            <div className="flex flex-col gap-2 text-xs">
              <p>
                Keep track of who you&apos;ve followed and who&apos;s followed you, without adding anyone by hand:
                screenshot your Following list (sorted newest first) and your new-follower notifications, let Claude
                read them, and paste its reply here.
              </p>
              <p>
                Start with a <span className="text-on-surface">baseline</span> import so the people already there
                aren&apos;t all logged as new.
              </p>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="w-fit rounded-lg bg-people-amber px-3 py-1.5 text-xs font-medium text-surface-container-lowest hover:brightness-110"
              >
                Import first snapshot
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs">
                <span className="text-on-surface">{counts.followers}</span> follow you ·{' '}
                <span className="text-on-surface">{counts.following}</span> you follow ·{' '}
                <span className="text-on-surface">{counts.mutual}</span> mutual
                {lastImport && <> · last import {formatDate(lastImport.created_at)}</>}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setFilter(id)
                      setShown(PAGE)
                    }}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                      filter === id
                        ? 'border-people-amber/50 bg-people-amber/10 text-people-amber'
                        : 'border-outline-variant text-on-surface-variant hover:border-outline'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {visibleEvents.length === 0 ? (
                <p className="text-xs">Nothing new logged yet — import a newer set of screenshots.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-outline-variant/40">
                  {visibleEvents.slice(0, shown).map((event) => {
                    const account = accountsById.get(event.account_id)
                    if (!account) return null
                    const person = account.person_id ? peopleById.get(account.person_id) : undefined
                    const sameName = !person
                      ? peopleByName.get((account.display_name ?? '').trim().toLowerCase())
                      : undefined
                    const relation = relationshipLabel(account)
                    return (
                      <li key={event.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
                        {event.kind === 'followed_you' ? (
                          <UserPlus className="h-3.5 w-3.5 shrink-0 text-people-amber" aria-label="Followed you" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" aria-label="You followed" />
                        )}
                        <a
                          href={`https://www.instagram.com/${account.username}/`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-sm text-on-surface hover:underline"
                        >
                          @{account.username}
                        </a>
                        {account.display_name && (
                          <span className="min-w-0 truncate text-xs text-on-surface-variant">{account.display_name}</span>
                        )}
                        {relation === 'Mutual' && (
                          <span className="rounded-full bg-people-amber/10 px-1.5 py-0.5 text-[10px] text-people-amber">
                            Mutual
                          </span>
                        )}
                        <span className="ml-auto flex shrink-0 items-center gap-2">
                          <span className="text-[11px] tabular-nums text-on-surface-variant">
                            {event.kind === 'followed_you' ? 'followed you' : 'you followed'} ·{' '}
                            {formatDate(event.occurred_on)}
                          </span>
                          {person ? (
                            <span className="rounded-full border border-outline-variant px-1.5 py-0.5 text-[10px] text-on-surface">
                              {person.full_name}
                            </span>
                          ) : sameName ? (
                            <button
                              type="button"
                              onClick={() => void linkPerson(account.id, sameName.id)}
                              title={`Link @${account.username} to ${sameName.full_name}`}
                              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-on-surface-variant hover:bg-surface-container-high hover:text-people-amber"
                            >
                              <Link2 className="h-3 w-3" />
                              Link to {sameName.full_name}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startAdding(account)}
                              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-on-surface-variant hover:bg-surface-container-high hover:text-people-amber"
                            >
                              <UserPlus className="h-3 w-3" />
                              Add to People
                            </button>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}

              {visibleEvents.length > shown && (
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE)}
                  className="w-fit text-xs text-on-surface-variant hover:text-on-surface hover:underline"
                >
                  Show {Math.min(PAGE, visibleEvents.length - shown)} more
                </button>
              )}
            </>
          )}
        </div>
      )}

      <InstagramImportModal
        isOpen={importOpen}
        todayKey={todayKey}
        known={accounts}
        firstImport={firstImport}
        onClose={() => setImportOpen(false)}
        onImported={(text) => {
          setMessage(text)
          refresh()
        }}
      />

      <PersonFormModal
        isOpen={adding !== null}
        heading={adding ? `Add @${adding.account.username} to People` : 'New person'}
        initialValues={adding?.preset ?? null}
        onClose={() => setAdding(null)}
        onSave={savePerson}
      />
    </WidgetCard>
  )
}
