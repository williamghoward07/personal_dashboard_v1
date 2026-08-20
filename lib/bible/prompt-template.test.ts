import { describe, expect, it } from 'vitest'
import { buildBiblePrompt } from './prompt-template'

describe('buildBiblePrompt', () => {
  it('includes the passage reference and the note verbatim', () => {
    const prompt = buildBiblePrompt({ reference: 'Romans 8:1-17', note: "what does 'no condemnation' mean" })

    expect(prompt).toContain('Romans 8:1-17')
    expect(prompt).toContain("what does 'no condemnation' mean")
  })

  it('never mentions scripture text or claims to quote the passage', () => {
    const prompt = buildBiblePrompt({ reference: 'John 3:16', note: 'the phrase about the world' })

    expect(prompt.toLowerCase()).not.toContain('the text reads')
    expect(prompt.toLowerCase()).not.toContain('quote:')
  })
})
