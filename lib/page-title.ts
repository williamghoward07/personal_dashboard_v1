'use client'

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { activeNavItem } from '@/lib/nav-items'

/**
 * One source of truth for "where am I", consumed by two surfaces: the top
 * bar's `BIO-SYSTEM v1.0 / <MODULE> // <CONTEXT>` breadcrumb (DESIGN.md
 * §5.1) and the browser tab title. A page publishes once with
 * `usePageTitle()` and both update.
 *
 * Every page in this app is client-rendered under one root layout and no
 * route defines its own metadata, so Next's `generateMetadata` (server-only
 * — see node_modules/next/dist/docs/.../generate-metadata.md) can't see a
 * workspace's name. A client context plus a `document.title` effect is the
 * mechanism that can.
 *
 * The store is a plain subscribe/snapshot object rather than React state on
 * purpose: publishing happens from a child's effect, and pushing into an
 * external store keeps that out of the `setState`-in-an-effect pattern the
 * repo's lint config rejects.
 */

export const APP_NAME = 'Study Copilot'
export const BREADCRUMB_PREFIX = 'BIO-SYSTEM v1.0'

export interface PageTitle {
  /** Overrides the nav-derived module name. Rarely needed. */
  module?: string
  /** The specific thing on screen — a workspace name, an essay title. */
  context?: string
}

const EMPTY: PageTitle = {}

// ---------------------------------------------------------------------------
// Pure formatting / derivation
// ---------------------------------------------------------------------------

/**
 * The module name for a route: its nav label, else the first path segment
 * humanised (so a page with no tab still gets a real breadcrumb rather than
 * a bare "Study Copilot").
 */
export function moduleLabelForPath(pathname: string): string {
  const fromNav = activeNavItem(pathname)
  if (fromNav) return fromNav.label
  const segment = pathname.split('/').filter(Boolean)[0]
  return segment ? segment.replace(/-/g, ' ') : 'Home'
}

/** `BIO-SYSTEM v1.0 / WORKSPACES // COASTAL EROSION ESSAY` (DESIGN.md §5.1). */
export function formatBreadcrumb(module: string, context?: string | null): string {
  const head = `${BREADCRUMB_PREFIX} / ${module.toUpperCase()}`
  const leaf = context?.trim()
  return leaf ? `${head} // ${leaf.toUpperCase()}` : head
}

/**
 * `Coastal Erosion Essay — Study Copilot`. The home page keeps the bare app
 * name; everywhere else the most specific thing available leads, because a
 * tab strip only shows the first few characters.
 */
export function formatDocumentTitle(module: string, context?: string | null): string {
  const leaf = context?.trim() || module
  if (!leaf || leaf === 'Home' || leaf === APP_NAME) return APP_NAME
  return `${leaf} — ${APP_NAME}`
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type Listener = () => void

interface PageTitleStore {
  subscribe: (listener: Listener) => () => void
  getSnapshot: () => PageTitle
  /** `null` retracts this publisher's entry (i.e. the page unmounted). */
  publish: (key: object, value: PageTitle | null) => void
}

function createPageTitleStore(): PageTitleStore {
  // Keyed by publisher so an unmounting page can only ever retract its own
  // entry; the most recently published one wins.
  const entries = new Map<object, PageTitle>()
  const listeners = new Set<Listener>()
  let snapshot: PageTitle = EMPTY

  const recompute = () => {
    let latest: PageTitle | undefined
    for (const value of entries.values()) latest = value
    const next = latest ?? EMPTY
    // useSyncExternalStore compares snapshots by identity, so only swap the
    // object when something actually changed.
    if (next.module === snapshot.module && next.context === snapshot.context) return
    snapshot = next
    for (const listener of listeners) listener()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => snapshot,
    publish(key, value) {
      if (value === null) entries.delete(key)
      else entries.set(key, value)
      recompute()
    },
  }
}

const PageTitleStoreContext = createContext<PageTitleStore | null>(null)

const noopSubscribe = () => () => {}
const emptySnapshot = () => EMPTY

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createPageTitleStore)
  return createElement(PageTitleStoreContext.Provider, { value: store }, children)
}

// ---------------------------------------------------------------------------
// Publish / consume
// ---------------------------------------------------------------------------

/**
 * Publishes what this page is showing. Call it once, near the top of the
 * page's component and above any early return:
 *
 * ```ts
 * usePageTitle(workspace?.name)
 * ```
 *
 * `undefined`/`null` while data loads is fine — the breadcrumb falls back to
 * the module on its own. Outside a `PageTitleProvider` (the login page) it
 * is a no-op.
 */
export function usePageTitle(context?: string | null, options?: { module?: string }): void {
  const store = useContext(PageTitleStoreContext)
  const keyRef = useRef<object>({})
  const moduleName = options?.module

  useEffect(() => {
    if (!store) return
    const key = keyRef.current
    store.publish(key, { module: moduleName, context: context ?? undefined })
    return () => store.publish(key, null)
  }, [store, moduleName, context])
}

/** The raw published entry. Prefer `useResolvedPageTitle`. */
export function usePublishedPageTitle(): PageTitle {
  const store = useContext(PageTitleStoreContext)
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? emptySnapshot,
    emptySnapshot
  )
}

export interface ResolvedPageTitle {
  /** Always set — nav label, published override, or humanised path segment. */
  module: string
  context?: string
  breadcrumb: string
  documentTitle: string
}

export function useResolvedPageTitle(): ResolvedPageTitle {
  const pathname = usePathname()
  const published = usePublishedPageTitle()

  return useMemo(() => {
    const moduleName = published.module ?? moduleLabelForPath(pathname ?? '/')
    const context = published.context
    return {
      module: moduleName,
      context,
      breadcrumb: formatBreadcrumb(moduleName, context),
      documentTitle: formatDocumentTitle(moduleName, context),
    }
  }, [published, pathname])
}

/**
 * Keeps `document.title` in step with the published context. Rendered by
 * `AppChrome` rather than run as a hook there so the login page — which
 * renders no chrome — keeps the static metadata title.
 */
export function PageTitleDocumentSync(): null {
  const { documentTitle } = useResolvedPageTitle()

  useEffect(() => {
    document.title = documentTitle
  }, [documentTitle])

  return null
}
