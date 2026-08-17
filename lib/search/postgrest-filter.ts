// Safely embeds arbitrary text as a PostgREST filter value. PostgREST's
// own filter-string syntax treats comma (condition separator), period
// (column.operator.value separator), and parentheses (grouping) as
// structural characters — a raw keyword containing one of these would
// otherwise corrupt the parsed filter rather than just fail to match.
// Wrapping the value in double quotes (escaping any embedded ones) is
// PostgREST's own documented escape hatch for this — not SQL injection
// in the traditional sense (PostgREST parameterizes the underlying
// query), but unescaped structural characters can still produce a
// malformed or unintended filter.
export function escapePostgrestFilterValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`
}

// Builds a `.or()`-ready filter string matching any keyword against any
// of the given columns via ILIKE — e.g. columns=['a','b'],
// keywords=['x','y'] produces a.ilike."%x%",a.ilike."%y%",b.ilike."%x%",b.ilike."%y%".
export function ilikeAnyColumn(columns: string[], keywords: string[]): string {
  return columns
    .flatMap((column) => keywords.map((keyword) => `${column}.ilike.${escapePostgrestFilterValue(`%${keyword}%`)}`))
    .join(',')
}
