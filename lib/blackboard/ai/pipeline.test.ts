import { describe, expect, it } from 'vitest'
import type { ExtractContext, ExtractSource } from './extract'
import { EXTRACT_ANSWER_TOKENS, EXTRACT_MAX_OUTPUT_TOKENS, EXTRACT_THINKING_CEILING, runExtractBatch, type AiCall, type AiRequest } from './pipeline'

const ctx: ExtractContext = {
  today: '2026-11-12',
  window: { from: '2026-08-01', to: '2027-09-30' },
  moduleCode: 'GEOG1061',
  courseName: null,
  assignments: [],
}

const text = "Please read chapter 2 before Tuesday's tutorial."

function source(kind: ExtractSource['kind'], id: string): ExtractSource {
  return { kind, id, course_id: 'c1', title: 'Reading', text, posted: '2026-11-10T09:00:00Z' }
}

describe('runExtractBatch', () => {
  it('asks for room for the largest thinking budget plus the answer', async () => {
    const requests: AiRequest[] = []
    const ai: AiCall = async (r) => {
      requests.push(r)
      return { model: 'm', data: { items: [] } }
    }
    await runExtractBatch([source('announcement', 'a')], ctx, [], ai)
    expect(EXTRACT_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(EXTRACT_THINKING_CEILING + EXTRACT_ANSWER_TOKENS)
    expect(requests[0]).toMatchObject({ tier: 'smart', thinking: true, maxOutputTokens: EXTRACT_MAX_OUTPUT_TOKENS })
  })

  it('resolves relative dates only against an announcement posted day', async () => {
    const ai: AiCall = async () => ({
      model: 'm',
      data: {
        items: [1, 2].map((source) => ({
          source,
          title: 'Read chapter 2 for tutorial',
          category: 'tutorial',
          due_on: '2026-11-17',
          quote: "read chapter 2 before Tuesday's tutorial",
        })),
      },
    })
    // Same text and posted value; only the announcement is an anchor.
    const r = await runExtractBatch([source('announcement', 'a'), source('content', 'c')], ctx, [], ai)
    expect(r.perSource.map((p) => p.length)).toEqual([1, 0])
    expect(r).toMatchObject({ noAnchor: 1, dateMismatch: 0, ungrounded: 0 })
  })

  it("grounds session days against the sessions the prompt listed", async () => {
    const quote = 'The tutorials take place next week; do the prep work ahead.'
    const ai: AiCall = async () => ({
      model: 'm',
      data: {
        items: ['2026-11-19', '2026-11-16'].map((due_on) => ({ source: 1, title: 'Prepare for tutorial', category: 'tutorial', due_on, quote })),
      },
    })
    const batch: ExtractSource[] = [{ ...source('announcement', 'a'), text: quote }]
    // Posted Tue 10 Nov; the tutorial next week is Thu 19 Nov.
    const sessions = [{ date: '2026-11-19', type: 'tutorial' as const }]
    const r = await runExtractBatch(batch, { ...ctx, sessions }, [], ai)
    expect(r.perSource[0].map((k) => k.due_on)).toEqual(['2026-11-19'])
    expect(r.dateMismatch).toBe(1)
    // The same reply with no sessions: both kept, as before.
    const old = await runExtractBatch(batch, ctx, [], ai)
    expect(old.perSource[0].map((k) => k.due_on)).toEqual(['2026-11-19', '2026-11-16'])
  })

  it('fails on a cut-off or malformed reply instead of reporting nothing found', async () => {
    const cut: AiCall = async () => {
      throw new SyntaxError('Unexpected end of JSON input')
    }
    await expect(runExtractBatch([source('announcement', 'a')], ctx, [], cut)).rejects.toThrow(SyntaxError)
    const shapeless: AiCall = async () => ({ model: 'm', data: { list: [] } })
    await expect(runExtractBatch([source('announcement', 'a')], ctx, [], shapeless)).rejects.toMatchObject({ name: 'AiOutputError' })
  })
})
