// The timer RPCs `raise exception '<key>'` (see the time_sessions
// migration). This maps a key to the HTTP status the routes return.

const STATUS: Record<string, number> = {
  unauthenticated: 401,
  invalid_trim: 400,
  invalid_range: 400,
  no_open_session: 404,
  workspace_not_found: 404,
  not_running: 409,
  not_paused: 409,
}

/** `{ error, status }` for an RPC error message; unknown errors are 500s. */
export function timerError(message: string | undefined): { error: string; status: number } {
  const key = message?.trim() ?? ''
  return Object.hasOwn(STATUS, key) ?{ error: key, status: STATUS[key] } : { error: 'timer_failed', status: 500 }
}
