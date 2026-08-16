// Google People API — read-only fetch of your contacts, plus the mapping onto
// the `people` table.
//
// Conflict rule: Google owns the contact card, the app owns the CRM fields.
// A sync writes only the columns in GOOGLE_OWNED_FIELDS. It never touches
// notes, tags, how_we_met, archived, or any interaction. People added by hand
// have a null google_resource_name and are skipped entirely.

const CONNECTIONS_ENDPOINT = 'https://people.googleapis.com/v1/people/me/connections'

const PERSON_FIELDS = [
  'names',
  'emailAddresses',
  'phoneNumbers',
  'organizations',
  'photos',
  'urls',
  'biographies',
  'birthdays',
  'metadata',
].join(',')

export interface GooglePerson {
  resourceName: string
  names?: { displayName?: string; metadata?: { primary?: boolean } }[]
  emailAddresses?: { value?: string; metadata?: { primary?: boolean } }[]
  phoneNumbers?: { value?: string; metadata?: { primary?: boolean } }[]
  organizations?: { name?: string; title?: string }[]
  photos?: { url?: string; default?: boolean }[]
  urls?: { value?: string; type?: string }[]
  biographies?: { value?: string }[]
  birthdays?: { date?: { year?: number; month?: number; day?: number } }[]
  metadata?: { deleted?: boolean; sources?: { etag?: string }[] }
}

/** A person row shaped for insert/update. user_id is left to the column default. */
export interface MappedPerson {
  google_resource_name: string
  google_etag: string | null
  google_synced_at: string
  full_name: string
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  photo_url: string | null
  linkedin_url: string | null
  birthday: string | null
}

/** Columns a sync is allowed to overwrite on an existing row. */
export const GOOGLE_OWNED_FIELDS = [
  'google_etag',
  'google_synced_at',
  'full_name',
  'email',
  'phone',
  'company',
  'job_title',
  'photo_url',
  'linkedin_url',
  'birthday',
] as const

/** Picks the entry flagged primary, else the first one present. */
function primary<T extends { metadata?: { primary?: boolean } }>(list?: T[]) {
  if (!list?.length) return undefined
  return list.find((item) => item.metadata?.primary) ?? list[0]
}

function linkedInFrom(urls?: { value?: string }[]) {
  const match = urls?.find((u) => u.value?.toLowerCase().includes('linkedin.com'))
  return match?.value ?? null
}

function birthdayFrom(birthdays?: GooglePerson['birthdays']) {
  const date = birthdays?.[0]?.date
  // Google omits the year for most contacts; a date column needs one, so fall
  // back to a leap-safe placeholder year rather than dropping the birthday.
  if (!date?.month || !date?.day) return null
  const year = date.year ?? 1900
  return `${String(year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

export function mapGooglePerson(person: GooglePerson): MappedPerson | null {
  if (person.metadata?.deleted) return null

  const fullName = primary(person.names)?.displayName?.trim()
  const email = primary(person.emailAddresses)?.value ?? null
  // A contact with neither a name nor an email is noise (Google returns quite a
  // few of these from old device syncs).
  if (!fullName && !email) return null

  const organization = person.organizations?.[0]
  // Skip Google's generic silhouette so the UI can fall back to initials.
  const photo = person.photos?.find((p) => p.url && !p.default)?.url ?? null

  return {
    google_resource_name: person.resourceName,
    google_etag: person.metadata?.sources?.[0]?.etag ?? null,
    google_synced_at: new Date().toISOString(),
    full_name: fullName || email || 'Unnamed contact',
    email,
    phone: primary(person.phoneNumbers)?.value ?? null,
    company: organization?.name ?? null,
    job_title: organization?.title ?? null,
    photo_url: photo,
    linkedin_url: linkedInFrom(person.urls),
    birthday: birthdayFrom(person.birthdays),
  }
}

/** Raised when Google rejects a stored syncToken; caller should full-resync. */
export class SyncTokenExpiredError extends Error {
  constructor() {
    super('Google sync token expired')
    this.name = 'SyncTokenExpiredError'
  }
}

/**
 * Pages through every connection. Passing a syncToken returns only what changed
 * since it was issued; Google answers 410 when the token is too old to honour.
 */
export async function fetchConnections({
  accessToken,
  syncToken,
}: {
  accessToken: string
  syncToken?: string | null
}): Promise<{ people: GooglePerson[]; nextSyncToken: string | null }> {
  const collected: GooglePerson[] = []
  let pageToken: string | undefined
  let nextSyncToken: string | null = null

  do {
    const params = new URLSearchParams({
      personFields: PERSON_FIELDS,
      pageSize: '200',
      requestSyncToken: 'true',
    })
    if (syncToken) params.set('syncToken', syncToken)
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`${CONNECTIONS_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (res.status === 410) throw new SyncTokenExpiredError()
    if (!res.ok) {
      throw new Error(`Google People API failed (${res.status}): ${await res.text()}`)
    }

    const data = (await res.json()) as {
      connections?: GooglePerson[]
      nextPageToken?: string
      nextSyncToken?: string
    }

    collected.push(...(data.connections ?? []))
    pageToken = data.nextPageToken
    nextSyncToken = data.nextSyncToken ?? nextSyncToken
  } while (pageToken)

  return { people: collected, nextSyncToken }
}
