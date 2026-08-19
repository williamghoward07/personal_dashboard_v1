import { NextResponse } from 'next/server'
import sanitizeHtml from 'sanitize-html'
import { createClient } from '@/lib/supabase/server'
import { MICROSOFT_ONENOTE_PROVIDER } from '@/lib/microsoft/oauth'
import { getAccessToken, getPageContentHtml } from '@/lib/microsoft/graph'
import type { Integration } from '@/lib/types'

const IMAGE_PROXY_PATH = '/api/microsoft/onenote/image'

/**
 * Graph returns OneNote page content as raw HTML with embedded images
 * pointing at graph.microsoft.com resource endpoints that require a Bearer
 * token — a plain browser <img> request can't attach that header, so those
 * srcs are rewritten to the image proxy route, which fetches them
 * server-side instead.
 */
function sanitizeOneNotePage(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'u']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'style', 'width', 'height'],
      '*': ['style'],
    },
    // OneNote pages are laid out as absolutely-positioned divs — allowing
    // style is what keeps the page's actual layout instead of one long
    // unstyled column of text.
    transformTags: {
      img: (tagName, attribs) => {
        if (attribs.src?.startsWith('https://graph.microsoft.com/')) {
          return {
            tagName,
            attribs: { ...attribs, src: `${IMAGE_PROXY_PATH}?resourceUrl=${encodeURIComponent(attribs.src)}` },
          }
        }
        return { tagName, attribs }
      },
    },
  })
}

/** Fetches and sanitizes a single page's content. Called only when a page is opened. */
export async function GET(request: Request) {
  const pageId = new URL(request.url).searchParams.get('pageId')
  if (!pageId) {
    return NextResponse.json({ error: 'pageId is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('provider', MICROSOFT_ONENOTE_PROVIDER)
    .maybeSingle<Integration>()

  if (!integration) {
    return NextResponse.json({ error: 'Microsoft OneNote is not connected' }, { status: 400 })
  }

  try {
    const accessToken = await getAccessToken(integration)
    const html = await getPageContentHtml(accessToken, pageId)
    return NextResponse.json({ html: sanitizeOneNotePage(html) })
  } catch (error) {
    const message =
      error instanceof Error && /invalid_grant/i.test(error.message)
        ? 'Microsoft sign-in expired — click Reconnect to re-authorise.'
        : error instanceof Error
          ? error.message
          : 'Unknown error loading page'
    await supabase.from('integrations').update({ last_error: message }).eq('id', integration.id)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
