// Thin Microsoft Graph client: read-only OneNote here, plus the generic
// graphRequest used by the To Do sync (lib/microsoft/todo.ts). Mirrors the inline
// "decrypt refresh token -> refresh access token -> call the API" pattern
// used by app/api/google/contacts/sync/route.ts rather than a cached-token
// approach — every call here is already made on-demand (a user opening a
// picker/section/page), so refreshing once per call stays trivially within
// Graph's OneNote throttle (120 requests/min, 400/hour per user per app).
import { decryptSecret } from '@/lib/crypto'
import { refreshAccessToken } from './oauth'
import type { Integration } from '@/lib/types'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

export class MicrosoftNotConnectedError extends Error {
  constructor() {
    super('Microsoft OneNote is not connected')
    this.name = 'MicrosoftNotConnectedError'
  }
}

export class GraphApiError extends Error {
  status: number | null
  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'GraphApiError'
    this.status = status
  }
}

export async function getAccessToken(integration: Integration): Promise<string> {
  if (!integration.encrypted_refresh_token) throw new MicrosoftNotConnectedError()
  const refreshToken = decryptSecret(integration.encrypted_refresh_token)
  const tokens = await refreshAccessToken(refreshToken)
  return tokens.access_token
}

async function graphGetJson<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new GraphApiError(`Graph request failed (${res.status}): ${detail}`, res.status)
  }
  return res.json()
}

/**
 * General Graph call for the To Do client: any method, optional JSON body,
 * absolute (@odata.nextLink) or relative path. Asks for London times in
 * responses. Returns null for 204 No Content.
 */
export async function graphRequest<T>(
  accessToken: string,
  pathOrUrl: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T | null> {
  const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${GRAPH_BASE}${pathOrUrl}`
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="Europe/London"',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) {
    const detail = await res.text()
    console.error(`Graph ${init.method ?? 'GET'} ${url} -> ${res.status}: ${detail}`)
    throw new GraphApiError(`Graph request failed (${res.status}) on ${init.method ?? 'GET'} ${url}: ${detail}`, res.status)
  }
  if (res.status === 204) return null
  return res.json()
}

export interface OneNotePage {
  id: string
  title: string
  lastModifiedDateTime: string
  links?: { oneNoteWebUrl?: { href: string } }
}

export interface FlatSection {
  id: string
  name: string
  notebookName: string
}

interface RawSection {
  id: string
  displayName: string
  parentNotebook?: { displayName?: string }
  parentSectionGroup?: { displayName?: string }
}

/**
 * Every section across every notebook, flattened for a simple picker UI.
 * Notebook-scoped listing (/notebooks/{id}/sections) only returns sections
 * directly under the notebook — anything inside a folder (a "section
 * group" in Graph's terms) is excluded. The unscoped /me/onenote/sections
 * endpoint returns every section regardless of nesting; $expand pulls back
 * enough of its parent chain to still show where each one lives.
 */
export async function listAllSectionsFlattened(accessToken: string): Promise<FlatSection[]> {
  const data = await graphGetJson<{ value: RawSection[] }>(
    accessToken,
    '/me/onenote/sections?$expand=parentNotebook,parentSectionGroup&$select=id,displayName,parentNotebook,parentSectionGroup',
  )
  return data.value.map((section) => {
    const notebookName = section.parentNotebook?.displayName ?? 'Notebook'
    return {
      id: section.id,
      name: section.displayName,
      notebookName: section.parentSectionGroup?.displayName
        ? `${notebookName} / ${section.parentSectionGroup.displayName}`
        : notebookName,
    }
  })
}

export async function listPages(accessToken: string, sectionId: string): Promise<OneNotePage[]> {
  const data = await graphGetJson<{ value: OneNotePage[] }>(
    accessToken,
    `/me/onenote/sections/${sectionId}/pages?$select=id,title,lastModifiedDateTime,links`,
  )
  return data.value
}
