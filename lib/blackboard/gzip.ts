// Gzip helpers for the extension ↔ dashboard upload. Web Streams only
// (CompressionStream / DecompressionStream), no Node imports, so the same
// code runs in a route handler and in the extension's service worker.

import { GZIP_CONTENT_TYPE } from './wire'

/** Thrown when a body grows past its byte limit (zip-bomb guard). */
export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`body is larger than ${maxBytes} bytes`)
    this.name = 'BodyTooLargeError'
  }
}

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

/** The DOM typings' BufferSource writable side doesn't unify with Uint8Array streams; the runtime is fine. */
function gzipStream(direction: 'compress' | 'decompress'): ReadableWritablePair<Uint8Array, Uint8Array> {
  const stream = direction === 'compress' ? new CompressionStream('gzip') : new DecompressionStream('gzip')
  return stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let total = 0
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/** JSON.stringify → UTF-8 → gzip. */
export async function gzipJson(value: unknown): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return collect(streamOf(bytes).pipeThrough(gzipStream('compress')))
}

/**
 * Read a stream as UTF-8 text, throwing BodyTooLargeError (and cancelling
 * the stream) as soon as more than `maxBytes` have arrived.
 */
async function readText(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new BodyTooLargeError(maxBytes)
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

/**
 * Gunzip to UTF-8 text. Stops and throws BodyTooLargeError once the
 * decompressed size passes `maxBytes`; invalid gzip rejects with the
 * stream's own error.
 */
export function gunzipToText(body: ReadableStream<Uint8Array> | Uint8Array, maxBytes: number): Promise<string> {
  // Not `instanceof Uint8Array`: bytes from another realm (a worker, jsdom) fail that check.
  const source = ArrayBuffer.isView(body) ? streamOf(body) : body
  return readText(source.pipeThrough(gzipStream('decompress')), maxBytes)
}

/**
 * A request body as JSON: gzipped when `Content-Type` is GZIP_CONTENT_TYPE,
 * else plain JSON. `maxBytes` caps the (decompressed) size. Any failure
 * (bad gzip, bad JSON, too large, no body) is `{ ok: false }`.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const body = request.body
  if (!body) return { ok: false, error: 'empty body' }
  let text: string
  try {
    text = type === GZIP_CONTENT_TYPE ? await gunzipToText(body, maxBytes) : await readText(body, maxBytes)
  } catch (err) {
    return { ok: false, error: err instanceof BodyTooLargeError ? err.message : 'unreadable body' }
  }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, error: 'invalid JSON' }
  }
}
