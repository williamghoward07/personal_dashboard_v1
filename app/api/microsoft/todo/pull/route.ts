import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listTasks, listTodoLists } from '@/lib/microsoft/todo'
import { friendlyGraphError, getTodoConnection, isAuthFailure } from '@/lib/microsoft/todo-connection'
import {
  appListIdFor,
  mapTaskToRow,
  shouldImportTask,
  syncableLists,
  type GraphTodoTask,
  type MsTodoRow,
} from '@/lib/microsoft/todo-mapping'

// New app lists created for To Do lists get a neutral colour; recolour
// them on the Todos page like any other list.
const NEW_LIST_COLOR = 'var(--color-outline)'
const UPSERT_CHUNK = 200

// Pull: Microsoft To Do is the source of truth for every todo linked by
// mstodo_task_id (title, notes, due date + reminder time, completion,
// importance -> starred, list). App-created todos are never touched.
// Edits made in the app are pushed straight away (../push), so a pull
// only ever brings the app up to date with the phone.
//
// Each To Do list maps to the app list with the same name (created if
// missing); the default "Tasks" list maps to no list. A task deleted in
// To Do has its linked todo deleted here too.
//
// Always answers 200 with a `state` for "not connected / reconnect" so the
// page can show a friendly prompt instead of an error.
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const connection = await getTodoConnection(supabase)
  if (!connection.ok) return NextResponse.json({ state: connection.state, error: connection.message })

  const now = new Date().toISOString()
  const recordError = (message: string) =>
    supabase.from('integrations').update({ last_error: message }).eq('id', connection.integrationId)

  let lists: Awaited<ReturnType<typeof listTodoLists>>
  let tasksByList: GraphTodoTask[][]
  try {
    lists = syncableLists(await listTodoLists(connection.accessToken))
    tasksByList = await Promise.all(lists.map((list) => listTasks(connection.accessToken, list.id)))
  } catch (error) {
    const message = friendlyGraphError(error)
    await recordError(message)
    if (isAuthFailure(error)) return NextResponse.json({ state: 'needs_reconnect', error: message })
    return NextResponse.json({ state: 'error', error: message }, { status: 502 })
  }

  // Make sure every non-default To Do list has an app list to land in.
  const { data: existingLists, error: listsError } = await supabase.from('todo_lists').select('id, name, sort_order')
  if (listsError) return NextResponse.json({ state: 'error', error: listsError.message }, { status: 502 })
  const appLists = [...(existingLists ?? [])]
  const missing = lists.filter((l) => l.wellknownListName !== 'defaultList' && appListIdFor(l, appLists) === null)
  if (missing.length > 0) {
    const maxSort = appLists.reduce((max, l) => Math.max(max, l.sort_order), -1)
    const { data: created, error: createError } = await supabase
      .from('todo_lists')
      .insert(missing.map((l, i) => ({ name: l.displayName.trim(), color: NEW_LIST_COLOR, sort_order: maxSort + 1 + i })))
      .select('id, name, sort_order')
    if (createError) return NextResponse.json({ state: 'error', error: createError.message }, { status: 502 })
    appLists.push(...(created ?? []))
  }

  const { data: linked, error: linkedError } = await supabase
    .from('todos')
    .select('id, mstodo_task_id')
    .not('mstodo_task_id', 'is', null)
  if (linkedError) return NextResponse.json({ state: 'error', error: linkedError.message }, { status: 502 })
  const linkedTaskIds = new Set((linked ?? []).map((t) => t.mstodo_task_id as string))

  const seen = new Set<string>()
  const rows: MsTodoRow[] = []
  lists.forEach((list, i) => {
    const appListId = appListIdFor(list, appLists)
    for (const task of tasksByList[i]) {
      seen.add(task.id)
      if (shouldImportTask(task, linkedTaskIds.has(task.id), now)) {
        rows.push(mapTaskToRow(task, list.id, appListId, now))
      }
    }
  })

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error: upsertError } = await supabase.rpc('upsert_mstodo_todos', { rows: rows.slice(i, i + UPSERT_CHUNK) })
    if (upsertError) {
      await recordError(upsertError.message)
      return NextResponse.json({ state: 'error', error: upsertError.message }, { status: 502 })
    }
  }

  // Every list was fetched successfully above, so anything linked but
  // unseen really was deleted (or moved to the flagged-email list).
  const staleIds = (linked ?? []).filter((t) => !seen.has(t.mstodo_task_id as string)).map((t) => t.id)
  if (staleIds.length > 0) {
    const { error: pruneError } = await supabase.from('todos').delete().in('id', staleIds)
    if (pruneError) console.error('To Do prune failed:', pruneError)
  }

  await supabase
    .from('integrations')
    .update({ last_synced_at: now, last_error: null })
    .eq('id', connection.integrationId)

  return NextResponse.json({ state: 'ok', pulled: rows.length, removed: staleIds.length, syncedAt: now })
}
