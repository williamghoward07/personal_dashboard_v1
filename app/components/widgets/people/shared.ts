import type { Interaction, InteractionChannel, InteractionPerson, Person } from '@/lib/types'

/** Write wrapper provided by PeopleBoard so card-level failures reach the banner. */
export type RunMutation = (
  fn: () => PromiseLike<{ error: { message: string } | null }>,
) => Promise<boolean>

export const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-people-amber'
export const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'
export const saveButtonClass =
  'rounded-lg bg-people-amber px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110'
export const cancelButtonClass =
  'rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high'

export const CHANNELS: { value: InteractionChannel; label: string }[] = [
  { value: 'in_person', label: 'In person' },
  { value: 'call', label: 'Call' },
  { value: 'video', label: 'Video' },
  { value: 'message', label: 'Message' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
]

export function channelLabel(channel: InteractionChannel) {
  return CHANNELS.find((c) => c.value === channel)?.label ?? 'Other'
}

/** "12 Mar 2026" — short, unambiguous, and stable across locales. */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Value for a datetime-local input, in local time rather than UTC. */
export function toLocalInputValue(iso: string) {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function peopleForInteraction(
  interactionId: string,
  links: InteractionPerson[],
  people: Person[],
) {
  const ids = new Set(
    links.filter((l) => l.interaction_id === interactionId).map((l) => l.person_id),
  )
  return people.filter((p) => ids.has(p.id))
}

export function interactionsForPerson(
  personId: string,
  links: InteractionPerson[],
  interactions: Interaction[],
) {
  const ids = new Set(
    links.filter((l) => l.person_id === personId).map((l) => l.interaction_id),
  )
  return interactions.filter((i) => ids.has(i.id))
}

/** Names of everyone on an interaction, e.g. "Alice Smith, Bob Jones". */
export function attendeeNames(
  interactionId: string,
  links: InteractionPerson[],
  people: Person[],
) {
  return peopleForInteraction(interactionId, links, people)
    .map((p) => p.full_name)
    .join(', ')
}
