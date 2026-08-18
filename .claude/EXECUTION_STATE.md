# Execution State — Consolidated Roadmap

## Current task
None — all in-scope plan items are done or correctly deferred. Two
manual-verification items remain for the user (see Blockers); everything
that could be verified without them (tests, types, lint, build) is green.

## Completed tasks (all committed)
1. Statement import — verified + committed (c151bd1)
2. Todo Phase A (schema + data layer) — committed (72264e5). Migration
   hand-run by user in Supabase SQL Editor; all three guard-trigger cases
   verified live against production by the user.
3. Todo Phase B (UI) — committed (795186e). All 9 plan sub-items built:
   Modal size prop, TodoFormModal list picker, TodoDetailModal (subtasks
   checklist + quick-add), TodosBoard click-to-open rows, shared TodoRow
   (3 consumers: list/extended/completed), completed-hiding with
   recentlyCompletedIds + List/Extended/Completed view switcher,
   CompletedTodosList (grouped by date, scrolls to today),
   TodosExtendedView (due-date buckets), lists filter-chip row +
   TodoListFormModal (create/rename, color swatches) + delete-unlists
   confirm dialog.
4. Todo Phase C (chrome/nav pass) — committed (cbaaa1d)
5. Phase 7 Education — correctly left untouched (deferred per plan)

## Files changed this session (all committed, see commit messages for detail)
- c151bd1: lib/statement-import/parser.ts(+test), StatementImportBoard.tsx,
  app/api/money/statement-import/commit/route.ts
- cbaaa1d: lib/nav-items.ts, lib/use-scroll-direction.ts,
  MobileBottomNav.tsx, lib/theme.ts, Sidebar.tsx, AppChrome.tsx, TopAppBar.tsx
- 72264e5: lib/types.ts, use-todos.ts, checklist.test.ts,
  lib/todos/use-todo-lists.ts, extended-view.ts(+test), subtasks.ts(+test),
  supabase/migrations/20260818050000_todos_lists_and_subtasks.sql
- 795186e: Modal.tsx (size prop), TodoFormModal.tsx (list picker),
  TodosBoard.tsx (full rewrite), lib/daily-goals/use-todos.ts (updateTodo
  patch-type fix), lib/todos/use-todo-lists.ts (renameList->updateList),
  new: TodoDetailModal.tsx, TodoRow.tsx, CompletedTodosList.tsx,
  TodosExtendedView.tsx, TodoListFormModal.tsx

## Tests performed (final, post-Phase-B)
- `npx vitest run`: 145/145 pass, 14 files
- `npx tsc --noEmit`: clean
- `npm run lint`: same pre-existing error set as the repo-wide baseline
  taken before this session (react-hooks/set-state-in-effect across every
  *FormModal.tsx, including the new TodoListFormModal.tsx which follows
  the same established repo pattern) — no new *categories* of error
- `npm run build`: production build succeeds, /todos route present
- Browser: confirmed no console errors reachable pre-login; could not
  click through authenticated pages (no Google sign-in access this session)

## Blockers (both require the user; both are manual/visual only — nothing
## code-level is outstanding)
- Statement import: re-upload the user's real multi-year bank statement
  PDF once at /money/import to confirm dates land in the right years and
  that skippedDuplicates reports correctly on a second upload of the same
  file. Not done — no real statement file available to this session.
- Nav/chrome (Phase C) + Todos UI (Phase B): click through /todos and a
  couple of other module pages, both at a narrow (mobile) viewport and
  normal desktop width, to confirm: bottom nav + collapsing header look
  right; the todo detail modal, subtask quick-add, list filter chips,
  and List/Extended/Completed view switcher all behave as expected.
  Not done — this session has no Google sign-in access to the app.

## Plan order — final status
1. Statement import — DONE
2. Todo Phase A — DONE
3. Todo Phase B UI — DONE
4. Todo Phase C chrome/nav — DONE
5. Phase 7 Education — deferred, correctly untouched

All four feature commits are local only (not pushed), per standing
instruction not to push without explicit request.
