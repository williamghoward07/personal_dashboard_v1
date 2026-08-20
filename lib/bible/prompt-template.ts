// Pure string builder for the prompt launcher (Feature 2). No AI call, no
// templating table — Prompt Library exploration confirmed there's no
// variable-substitution mechanism to reuse there (its `prompt` column is
// static free text, copied verbatim), so this is new, self-contained logic.
// Output is copied to the clipboard and pasted manually into a separate
// Claude Project — this module never calls any AI API itself.
export interface BiblePromptInput {
  reference: string
  note: string
}

export function buildBiblePrompt({ reference, note }: BiblePromptInput): string {
  return [
    `I'm reading ${reference} and could use help understanding it.`,
    '',
    `What I'm finding confusing or want to dig into: ${note}`,
    '',
    'Help me understand the passage in context — what it meant to its original audience, and what it might mean for me now. Ask me questions rather than just explaining, where that would help me think it through myself.',
  ].join('\n')
}
