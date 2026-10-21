import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { friendlyGraphError, getTodoConnection } from '@/lib/microsoft/todo-connection'
import type { TodoSyncChanges } from '@/lib/microsoft/todo-mapping'
import { linkTodo, pushTodoRemoval, pushTodoUpdate } from '@/lib/microsoft/todo-sync'

interface RequestBody {
  todo_id?: string
  action?: 'create' | 'update' | 'delete'
  changes?: TodoSyncChanges
}

const ACTIONS = new Set(['create', 'update', 'delete'])

// Push: app → Microsoft To Do, straight after the app-side write.
//   create — a todo was just added anywhere in the app: create its task
//            (or its step, for a subtask). See lib/microsoft/todo-sync.ts.
//   update — tick, star, rename, notes, due date/reminder time, list. A
//            todo that isn't linked yet (its create failed, or the client
//            hasn't seen the new ids) is created instead, from the saved
//            row — so the edit still lands.
//   delete — call before deleting the row, or the next pull brings it
//            back. An unlinked todo needs nothing, even when disconnected.
// The link state is always read from the database, never trusted from the
// client. Rows are read through RLS, so only the caller's own todos can be
// pushed. Create/update answer with the row's current To Do ids so the
// client can update its copy.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = (await request.json()) as RequestBody
  if (!body.todo_id || !body.action || !ACTIONS.has(body.action)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const todoId = body.todo_id

  const { data: row } = await supabase
    .from('todos')
    .select('id, parent_id, mstodo_task_id, mstodo_checklist_item_id')
    .eq('id', todoId)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const linked = row.parent_id ? Boolean(row.mstodo_checklist_item_id) : Boolean(row.mstodo_task_id)

  if (body.action === 'delete' && !linked) return NextResponse.json({ ok: true, result: 'not_linked' })

  const connection = await getTodoConnection(supabase)
  if (!connection.ok) return NextResponse.json({ error: connection.message, state: connection.state }, { status: 409 })

  try {
    if (body.action === 'delete') {
      const result = await pushTodoRemoval(supabase, connection.accessToken, todoId)
      return NextResponse.json({ ok: true, result })
    }

    const result =
      body.action === 'create' || !linked
        ? await linkTodo(supabase, connection.accessToken, todoId)
        : await pushTodoUpdate(supabase, connection.accessToken, todoId, body.changes ?? {})

    const { data: ids } = await supabase
      .from('todos')
      .select('mstodo_task_id, mstodo_list_id, mstodo_checklist_item_id')
      .eq('id', todoId)
      .maybeSingle()
    return NextResponse.json({ ok: true, result, ids })
  } catch (error) {
    const message = friendlyGraphError(error)
    console.error('To Do push failed:', error)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
