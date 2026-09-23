import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import {
  APP_NAME,
  PageTitleDocumentSync,
  PageTitleProvider,
  formatBreadcrumb,
  formatDocumentTitle,
  moduleLabelForPath,
  usePageTitle,
  useResolvedPageTitle,
} from './page-title'

const { pathnameRef } = vi.hoisted(() => ({ pathnameRef: { current: '/' } }))
vi.mock('next/navigation', () => ({ usePathname: () => pathnameRef.current }))

describe('moduleLabelForPath', () => {
  it('uses the nav label for a known route', () => {
    expect(moduleLabelForPath('/workspaces')).toBe('Workspaces')
    expect(moduleLabelForPath('/workspaces/abc-123')).toBe('Workspaces')
    expect(moduleLabelForPath('/')).toBe('Home')
  })

  it('humanises the first segment of a route with no tab', () => {
    expect(moduleLabelForPath('/design-system-test')).toBe('design system test')
  })

  it('never returns empty', () => {
    expect(moduleLabelForPath('')).toBe('Home')
  })
})

describe('formatBreadcrumb', () => {
  it('omits the context half when there is none', () => {
    expect(formatBreadcrumb('Education')).toBe('BIO-SYSTEM v1.0 / EDUCATION')
    expect(formatBreadcrumb('Education', '   ')).toBe('BIO-SYSTEM v1.0 / EDUCATION')
  })

  it('appends the context after a double slash, uppercased', () => {
    expect(formatBreadcrumb('Workspaces', 'Coastal Erosion Essay')).toBe(
      'BIO-SYSTEM v1.0 / WORKSPACES // COASTAL EROSION ESSAY'
    )
  })

  it('never degrades to the bare app name', () => {
    expect(formatBreadcrumb('Home')).toContain('HOME')
  })
})

describe('formatDocumentTitle', () => {
  it('leads with the context', () => {
    expect(formatDocumentTitle('Workspaces', 'Coastal Erosion Essay')).toBe(
      `Coastal Erosion Essay — ${APP_NAME}`
    )
  })

  it('falls back to the module', () => {
    expect(formatDocumentTitle('Money')).toBe(`Money — ${APP_NAME}`)
    expect(formatDocumentTitle('Money', '  ')).toBe(`Money — ${APP_NAME}`)
  })

  it('leaves the home page as the bare app name', () => {
    expect(formatDocumentTitle('Home')).toBe(APP_NAME)
    expect(formatDocumentTitle(APP_NAME)).toBe(APP_NAME)
  })

  it('still names a context on the home page', () => {
    expect(formatDocumentTitle('Home', 'Capture')).toBe(`Capture — ${APP_NAME}`)
  })
})

// --- the context plumbing -------------------------------------------------
// The formatting above is pure; what needs proving is that a page publishing
// once reaches BOTH consumers, and that the entry is retracted on unmount.

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(PageTitleProvider, null, children)

describe('page title context', () => {
  it('falls back to the route module when nothing is published', () => {
    pathnameRef.current = '/money'
    const { result } = renderHook(() => useResolvedPageTitle(), { wrapper })
    expect(result.current.module).toBe('Money')
    expect(result.current.context).toBeUndefined()
    expect(result.current.breadcrumb).toBe('BIO-SYSTEM v1.0 / MONEY')
    expect(result.current.documentTitle).toBe(`Money — ${APP_NAME}`)
  })

  it('feeds a published context to both surfaces at once', () => {
    pathnameRef.current = '/workspaces/abc-123'

    const Publisher = ({ name }: { name?: string }) => {
      usePageTitle(name)
      return null
    }

    const readings: string[] = []
    const Reader = () => {
      readings.push(useResolvedPageTitle().breadcrumb)
      return null
    }

    const tree = (name?: string) =>
      createElement(
        PageTitleProvider,
        null,
        createElement(Reader),
        createElement(PageTitleDocumentSync),
        createElement(Publisher, { name })
      )

    // Data still loading: the module alone, never a bare app name.
    const view = render(tree(undefined))
    expect(readings.at(-1)).toBe('BIO-SYSTEM v1.0 / WORKSPACES')
    expect(document.title).toBe(`Workspaces — ${APP_NAME}`)

    act(() => {
      view.rerender(tree('Coastal Erosion Essay'))
    })

    expect(readings.at(-1)).toBe('BIO-SYSTEM v1.0 / WORKSPACES // COASTAL EROSION ESSAY')
    expect(document.title).toBe(`Coastal Erosion Essay — ${APP_NAME}`)
  })

  it('retracts the context when the publishing page unmounts', () => {
    pathnameRef.current = '/workspaces/abc-123'

    const Publisher = () => {
      usePageTitle('Coastal Erosion Essay')
      return null
    }

    const readings: string[] = []
    const Reader = () => {
      readings.push(useResolvedPageTitle().breadcrumb)
      return null
    }

    const tree = (withPublisher: boolean) =>
      createElement(
        PageTitleProvider,
        null,
        createElement(Reader),
        withPublisher ? createElement(Publisher) : null
      )

    const view = render(tree(true))
    expect(readings.at(-1)).toContain('// COASTAL EROSION ESSAY')

    act(() => {
      view.rerender(tree(false))
    })
    expect(readings.at(-1)).toBe('BIO-SYSTEM v1.0 / WORKSPACES')
  })

  it('is an inert no-op outside a provider', () => {
    pathnameRef.current = '/bible'
    const { result } = renderHook(() => {
      usePageTitle('Ignored')
      return useResolvedPageTitle()
    })
    expect(result.current.context).toBeUndefined()
    expect(result.current.module).toBe('Bible')
  })
})
