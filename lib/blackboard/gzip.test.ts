import { describe, expect, it } from 'vitest'
import { BodyTooLargeError, gunzipToText, gzipJson, readJsonBody } from './gzip'
import { GZIP_CONTENT_TYPE } from './wire'

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

describe('gzipJson / gunzipToText', () => {
  it('round-trips JSON (bytes and streams), including non-ASCII text', async () => {
    const value = { snapshot: { title: 'Rivers – Floods ☺', items: Array.from({ length: 500 }, (_, i) => ({ i })) } }
    const gz = await gzipJson(value)
    expect(gz[0]).toBe(0x1f)
    expect(gz[1]).toBe(0x8b)
    expect(JSON.parse(await gunzipToText(gz, 1024 * 1024))).toEqual(value)
    expect(JSON.parse(await gunzipToText(streamOf(gz), 1024 * 1024))).toEqual(value)
  })

  it('stops once the decompressed size passes the limit', async () => {
    const gz = await gzipJson({ text: 'a'.repeat(200_000) })
    expect(gz.byteLength).toBeLessThan(2_000)
    await expect(gunzipToText(gz, 10_000)).rejects.toBeInstanceOf(BodyTooLargeError)
  })

  it('rejects data that is not gzip', async () => {
    await expect(gunzipToText(new TextEncoder().encode('{"plain":true}'), 1000)).rejects.toThrow()
  })
})

describe('readJsonBody', () => {
  const req = (body: BodyInit, type: string) => new Request('https://example.test/', { method: 'POST', body, headers: { 'content-type': type } })

  it('reads plain and gzipped JSON', async () => {
    expect(await readJsonBody(req('{"a":1}', 'application/json'), 1000)).toEqual({ ok: true, value: { a: 1 } })
    const gz = await gzipJson({ a: 2 })
    expect(await readJsonBody(req(gz as BodyInit, `${GZIP_CONTENT_TYPE}; charset=binary`), 1000)).toEqual({ ok: true, value: { a: 2 } })
  })

  it('fails on bad gzip, bad JSON and oversized bodies', async () => {
    expect((await readJsonBody(req('not gzip', GZIP_CONTENT_TYPE), 1000)).ok).toBe(false)
    expect((await readJsonBody(req('{bad', 'application/json'), 1000)).ok).toBe(false)
    expect((await readJsonBody(req(JSON.stringify({ a: 'x'.repeat(5000) }), 'application/json'), 1000)).ok).toBe(false)
    const bomb = await gzipJson({ a: 'x'.repeat(100_000) })
    expect(await readJsonBody(req(bomb as BodyInit, GZIP_CONTENT_TYPE), 1000)).toEqual({ ok: false, error: 'body is larger than 1000 bytes' })
  })
})
