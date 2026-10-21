# Microsoft To Do / OneNote

- There is one connection, `integrations` provider `microsoft_onenote`, and it serves OneNote, To Do and Outlook Calendar (Alexa). Adding a scope requires the user to reconnect once.
- OneNote is read-only, fetched on demand and never indexed.
- To Do sync:
  - Pull happens on `/todos` load (`/api/microsoft/todo/pull`; at most every 5 min from home).
  - **Every todo is created in To Do**, wherever it's added: call `pushTodoCreate` (client) after every `todos` insert, or `linkTodo` (`todo-sync.ts`) on the server. The pull first creates any open unlinked todos (backfill + retry, ≤25 per pull).
  - Push happens on every change (`/api/microsoft/todo/push`): tick, star (= "Important"), title, notes, due date + reminder time, list, delete. The server reads link state from the DB; an update to a not-yet-linked todo creates it instead.
  - Delete removes the To Do task first. If that fails, keep the app todo. An unlinked todo deletes without a connection.
  - A task deleted in To Do deletes the app todo (any todo, now that all sync).
  - To Do lists map to app lists by name, both ways. The default "Tasks" list means no list. Missing lists are created on either side. Changing a todo's list recreates the task in the new list.
  - `due_time` ↔ the task's reminder (on its due date). No date = no reminder.
  - Subtasks are To Do steps (checklist items, `todos.mstodo_checklist_item_id`). A To Do task can't itself be a subtask (DB trigger).
  - Linking is race-safe: ids are written with a "still unlinked" condition and a losing duplicate is deleted from To Do.
  - Without a Microsoft connection, creates/edits are silent no-ops; the next pull after connecting catches up.
  - Completed tasks older than 30 days aren't imported. `education_tasks` don't sync.
- Apple Reminders/CalDAV was removed because iCloud only serves placeholder lists. Don't reintroduce it.
