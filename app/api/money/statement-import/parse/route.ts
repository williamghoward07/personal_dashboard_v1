import { NextResponse } from 'next/server'
import { getDocumentProxy, extractText } from 'unpdf'
import { createClient } from '@/lib/supabase/server'
import { parseStatementText } from '@/lib/statement-import/parser'

// Extraction only — writes nothing. The review step downstream is what
// makes candidates real; this route just turns a PDF into a best-guess
// list of them.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const statementYearRaw = formData.get('statementYear')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 })
  }

  const statementYear =
    typeof statementYearRaw === 'string' && statementYearRaw ? Number(statementYearRaw) : new Date().getFullYear()
  if (Number.isNaN(statementYear)) {
    return NextResponse.json({ error: 'invalid_statement_year' }, { status: 400 })
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer))
    const { text } = await extractText(pdf, { mergePages: true })

    const candidates = parseStatementText(text, statementYear)

    return NextResponse.json({ candidates, originalFilename: file.name })
  } catch (err) {
    console.error('Statement PDF parse failed:', err)
    return NextResponse.json({ error: 'parse_failed' }, { status: 502 })
  }
}
