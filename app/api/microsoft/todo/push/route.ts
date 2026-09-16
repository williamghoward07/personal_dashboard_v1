import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GraphApiError } from '@/lib/microsoft/graph'
import { deleteTask, updateTask } from '@/lib/microsoft/todo'
import { friendlyGraphError, getTodoConnection } from '@/lib/microsoft/todo-connection'
import { changesToGraphPatch, type TodoSyncChanges } from '@/lib/microsoft/todo-mapping'

interface RequestBody {
  todo_id?: string
  action?: 'update' | 'delete'
  changes?: TodoSyncChanges
}

// Push: an edit to a To Do-linked todo in the app (tick, star, rename,
// notes, due date) is sent to the task straight away; deleting one
// deletes the task (otherwise the next pull would bring it back). The
// todo row is looked up through RLS, so only the caller's own todos can
// be pushed. For deletes, call this before deleting the row.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = (await request.json()) as RequestBody
  if (!body.todo_id || (body.action !== 'update' && body.action !== 'delete')) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const { data: todo } = await supabase
    .from('todos')
    .select('id, mstodo_task_id, mstodo_list_id')
    .eq('id', body.todo_id)
    .maybeSingle()
  if (!todo?.mstodo_task_id || !todo.mstodo_list_id) {
    return NextResponse.json({ error: 'not_linked' }, { status: 404 })
  }

  const connection = await getTodoConnection(supabase)
  if (!connection.ok) return NextResponse.json({ error: connection.message, state: connection.state }, { status: 409 })

  try {
    if (body.action === 'delete') {
      try {
        await deleteTask(connection.accessToken, todo.mstodo_list_id, todo.mstodo_task_id)
      } catch (error) {
        // Already gone in To Do — that's the outcome we wanted.
        if (!(error instanceof GraphApiError && error.status === 404)) throw error
      }
    } else {
      const patch = changesToGraphPatch(body.changes ?? {})
      if (Object.keys(patch).length > 0) {
        await updateTask(connection.accessToken, todo.mstodo_list_id, todo.mstodo_task_id, patch)
      }
    }
  } catch (error) {
    const message = friendlyGraphError(error)
    console.error('To Do push failed:', error)
    return NextResponse.json({ error: message }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
