import { describe, expect, it } from 'vitest'
import { hasDateSignal } from './prefilter'

describe('hasDateSignal', () => {
  it.each([
    'Formative Discussion Post I, due 13 November',
    'Formative Discussion Posts Due 11 December',
    'Summative Essay due 16th February 2027 by 2pm (CMP002/ESFN41)',
    'Formative Essay due 24th November 2026 by 2pm',
    'Monday, 9 November: Borders and Migration (Prof Lauren Martin)',
    'BLOCK 1.2, DRB, Week 2 (12 October)',
    'Lecture 1 - Mon 5th Oct 2026, 10am, ER201',
    'Border Crises Lecture 1 Slides-Updated 9 Nov. 2026',
    'Please read the paper before the session on 12/11/2026',
    'Bring your notes next Friday',
    'Upload it by Monday',
    'The deadline has moved',
    'Submit through Turnitin',
    'Remember to hand in your field notebook',
    'Hand-in is at the Geography office',
    'Uploads close by 2pm',
    'Reading for the tutorials next week',
    'Details of Week 6 tutorials now posted on LU',
    'The practical in week 3 needs a laptop',
    '!! Nature Tutorials + Formative Assessment !!',
    'There will be a short quiz',
    'GEOG1222 Test',
    'Revision for the exam',
  ])('positive: %s', (text) => {
    expect(hasDateSignal(text)).toBe(true)
  })

  it.each([
    'Week 12: Introduction Lecture',
    'Weeks 13-15: Geographic Research (Dr Smith)',
    'Lecture 3 slides',
    'Link to Reading List in Talis Aspire',
    'Encore - Recordings Folder',
    'Start Here - Module Information and Contacts',
    'BLOCK 1.2, DRB',
    'Block 2: Water and Water Resources',
    'Testing hypotheses with GIS',
    'Lecture 12 handout',
    'We may cover this later',
    '',
  ])('negative: %s', (text) => {
    expect(hasDateSignal(text)).toBe(false)
  })

  it('handles null', () => {
    expect(hasDateSignal(null)).toBe(false)
    expect(hasDateSignal(undefined)).toBe(false)
  })
})
