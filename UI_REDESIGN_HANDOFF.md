# Study Copilot UI — living handoff

Updated: 16 November 2026, Europe/London. This file is maintained by the working agent, not a background automation.

## Current task — read this first

Build the approved Tasks, Brain dump and Workspaces redesigns. User selected **preview 04 for Tasks and Workspaces**, and **preview 02A for Brain dump**. Keep them separate screens and data models. The earlier request to mix 01 and 03 was superseded by the explicit final selection of 04. Do not ask for design approval again. Preserve existing features and live data. Prioritise useful information density, fast actions, consistency and mobile/tablet/desktop usability.

Implementation is running in isolated branches based on verified remote main `b92e2db`. Do NOT implement against or reset the original dirty checkout. Claude already shipped the earlier Home/widget/sidebar work to main. Its newer optional phone compact/tap-expand commit `2c0671f` is only on `claude/inspiring-hermann-4a677b`; do not silently merge it.

The user explicitly requested separate task branches, Sol/Terra for focused edits/tests, and a new chat handoff when appropriate. Plan: finish integration and automated validation in this chat; start a fresh Sol/Terra chat for signed-in Comet visual review and fixes with this document and exact server state. Do not hand off active file ownership without recording it.

## Worktrees and ownership

- Integration: `/private/tmp/study-next-screens`, branch `codex/remaining-screens`, starts at `b92e2db`. Root owns AppChrome, mobile navigation, shared scope and integration.
- Tasks: `/private/tmp/study-tasks-ui`, `codex/tasks-ui`, Terra agent `tasks_refinement_resume`. Owns task components in `widgets/daily-goals`, HabitsTodosBoard, Tasks route wrappers and local styles/tests. Preserve shared Home component defaults.
- Brain dump: `/private/tmp/study-capture-ui`, `codex/capture-ui`, Sol agent `capture_resume`. Owns Brain dump page/widget, opt-in shared DraftList/DraftCard presentation and opt-in store text retention. Preserve Home capture semantics.
- Workspaces: `/private/tmp/study-workspaces-ui`, `codex/workspaces-ui`, Terra agent `workspaces_refinement_resume`. Owns workspace index/detail components, routes and local styles/tests.
- Original repo: `/Users/williamhoward/local_projects_1/personal_dashboard_v1`, branch `codex/home-widget-refinement`, HEAD `913cf6f`, has superseded uncommitted changes. **Preserve them; do not reset or cherry-pick them.**
- Dependencies are symlinked from original repo into new worktrees. Preview worktree has local environment symlinks; never print or commit secret values.

## Approved behaviour

### Shared shell

Extend existing light Home shell to `/todos`, `/habits`, `/brain-dump`, `/workspaces` and nested workspace routes. Retain collapsible global icon rail, expanding on hover/focus without shifting content, with settings/account at bottom. Local list/folder navigation is separate from the global rail. Same mobile navigation across these screens; prefer Home, Calendar, Lectures, Tasks + More while respecting user-hidden items. Do not remove access to other screens.

Style: Sunsama-inspired warm ivory `#f6f5f1`, white flat panels, thin `#dddeda` borders, charcoal `#272b28`, muted sage `#62774f`. Compact headers and controls, no neon/glass/giant status banners. Titles wrap without colliding with actions. Mobile primary text around 16px, secondary readable, touch targets around 44px, safe areas, no horizontal page overflow or hover/drag-only essential actions. Root-scoped `workspace-ui` already themes portalled dialogs.

### Tasks — preview 04 top

Local navigation uses existing task lists and linked workspace filters; **no new nested task-folder database feature**. Dense central task list with completion, date, list/workspace context, star and overflow. Optional right detail panel with separate list/workspace fields, notes/subtasks/edit/complete. Mobile picker + full-screen detail, Back restores place. Todos and Habits remain accessible. Preserve MS To Do connect/status/sync, list CRUD, task CRUD/star/complete, subtasks, extended sort/group, completed history and workspace links. Avoid changing Home task behaviour via shared components.

### Brain dump — preview 02A

Desktop capture left / review right. Mobile Capture → Review steps; going back retains original text. Extract creates drafts only. Keep extract cancellation/errors, draft editing, per-item confirm/dismiss, eligible bulk confirm, and additional person/interaction review dialogs. Ready vs needs-review stays explicit. **Remove the generated image's redundant top search/customise header and use the shared mobile nav, not its invented different tabs.**

### Workspaces — preview 04 bottom

Keep existing nested folders, compact list default, Cards alternate, optional right selected-workspace preview with Open workspace. Full workspace remains a separate detail route. Mobile folder picker/rows and full-screen detail/back. Preserve folder CRUD/nesting/URL, keyboard and drag/drop/move options, archive/restore, weekly reading/time progress. Detail retains sibling navigation, breadcrumbs, title/subtitle/tags/status, appearance/layout persistence, archive/export, timer/stats, sources/launch set/links, readings, scoped tasks, thinking log and module Lectures linkage. Do not invent new deadline metrics or remove custom layout features.

## References — actually view them

Directory: `/Users/williamhoward/.codex/generated_images/01a1d4c5-0bf1-7251-b60d-da7004a1e539/`.

Current approved:
- **04 Tasks + Workspaces:** `exec-496f9eb9-a1dc-4fc8-8cdf-c4cbabaef43f.png`.
- **02A Brain dump:** `exec-a765b19c-7e52-4817-9e7b-51c9659a77f0.png` (corrections above).

Earlier options for context, not separate implementation targets:
- 01 Tasks: `exec-716e6dbd-c306-4423-a58c-8f9065d4064e.png`.
- 03 Workspaces: `exec-55ab3698-cbef-440a-8b57-aa1b8425b5f8.png`.

Original approved Home language:
- Concept B: `exec-b771573d-3194-447f-acdb-bb598d30e794.png`.
- Home: `exec-5cf723bb-279e-47f0-aeb7-eade0d7aa51f.png`.
- Lectures: `exec-6f98115f-010c-490b-8106-60384007996c.png`.
- Calendar: `exec-fb333221-88b5-4166-ad1f-72a87bdb8e71.png`.

Images are generated concepts with illustrative content, not proof of implementation. Inspect CURRENT rendered Home for UI information as well as these references. The 04 global rail is drawn expanded; implementation must retain the approved collapsed/hover-expanded behaviour. Completed Tasks and Habits controls omitted in the illustration must remain available.

## Evidence and current checkpoint

- Confirmed GitHub main via `git ls-remote`: `b92e2db2a87963c31f6d6be3ed92dead4b4a7b6d`.
- Earlier work shipped: launcher up to 4 columns × 12 rows, folder animations, adaptive Calendar/Money, distant assessments, settings/account sidebar, mobile More navigation, touch resize.
- Read-only source audit completed by Sol: remaining screens use legacy shell; selected workflows have controls spread across oversized headers/cards.
- Signed-in Comet successfully showed current deployed Tasks in old dark layout with service header, separate tab/header/filter/view rows. Subsequent navigation stopped updating the rendered view; **Brain dump and Workspaces were source-audited, not visually verified**. Home was subsequently rendered successfully on localhost after restart; its ivory/white/sage styling matches the source baseline.
- Shared shell/navigation committed `cf77e35`. Tasks integrated through `f20f782` (source commits 5845565,42dad0a,1a5fc62,a0affd9); Workspaces integrated through `dfac776` (source 4a847bd,1d1e133,e211a52). Root review corrected desktop details to INLINE nonmodal panels; native modal only below narrow breakpoint, focus/Back/resize tested. Combined shell/navigation/Tasks/Workspaces checks: 31 tests pass, with agent changed-lint/typechecks passed. Sol capture completion pending; no other active editing ownership.
- Local preview restarted in integration: `npm run dev -- --webpack --port 3001 --hostname localhost`, exec session `61354`, verified Ready. Signed-in Comet rendered actual current Home successfully. Tasks and Workspaces are integrated. Comet visually verified actual Tasks header/list and optional right detail pane using real data. Root corrected a raw Microsoft sync diagnostic taking over the header to a short message + expandable details (lint passed). Local Microsoft integration reports unauthorized_client; credentials/config were not changed. Full mobile and workspace post-change visual QA still pending. Recheck server before reporting it after any session interruption.
- No deployment, push to main or external publication requested for this phase.

## Next steps and acceptance

1. Collect focused commits; inspect diffs for feature loss, mobile layout, keyboard focus and errors; cherry-pick sequentially into `codex/remaining-screens`. Never reset unrelated changes.
2. Run focused tests per feature, integrated full suite/typecheck/changed-file lint and production build. Fix new failures, document unrelated blockers accurately.
3. Start integration checkout on `http://localhost:3001` (loopback). Use available installed dependencies; webpack fallback is acceptable if Turbopack cannot follow symlinks. Keep server running and record process/log.
4. Inspect in **Comet only**, user's signed-in browser. Home provides actual current visual reference. Verify Tasks list/detail/filter/mutations without altering real data unnecessarily, Brain dump capture/review/cancel without saving test data, Workspaces folders/list/cards/preview/detail. Verify desktop, narrow/mobile, long titles, empty/error/loading states, keyboard/back/focus. Report blocked interactions honestly.
5. If near context limit or at integrated checkpoint, create the requested fresh chat with Sol/Terra and this plan; hand off exact branch/worktree/commits, server, tests and remaining QA. User explicitly authorised new chat when appropriate. New chat does not reset usage limits.
6. Update this file after major tasks, check output against approved choices, and provide localhost + plan location. Do not call static wireframes or passing tests visual verification.

## Later scope (not in this implementation batch)

Home/sidebar, Lectures and Calendar were previously redesigned. Next candidate screens after these three: Money (ledger/account/import), Education, Research, People, Bible, App Library, AI usage. Ask about priority and provide options before committing new layouts. Health and Health import intentionally return 404 because Bevel replaced them; do not revive without explicit request. Existing Habits behaviour must survive this Tasks pass, but a separate full Habits redesign has not been selected.

## Working constraints

Read relevant installed Next 16.2.12 guides in `node_modules/next/dist/docs/` before edits (AGENTS.md). Use Sol/Terra for bounded tasks, stronger model for difficult decisions only. Ask material ambiguities as clickable chat options. Preserve user data, existing features and saved layouts. Keep progress messages concise and the plan current. Prefer new branches per task; do not duplicate Claude's completed work.

Research basis: Notion mobile navigation/views (`https://www.notion.com/help/workspaces-on-mobile`), Asana mobile quick actions (`https://help.asana.com/s/article/getting-started-with-asana-s-mobile-app`), Salesforce accessible mobile typography/targets (`https://developer.salesforce.com/docs/platform/mobile-offline/guide/ux-a11y.html`), Apple reduced motion. These inform consistency and action access; they do not mandate copying another app.

## Paste into a new chat

Continue the approved Study Copilot Tasks/Brain dump/Workspaces implementation and review. First read `/Users/williamhoward/local_projects_1/personal_dashboard_v1/UI_REDESIGN_HANDOFF.md` and the integration copy `/private/tmp/study-next-screens/UI_REDESIGN_HANDOFF.md`, using the latest checkpoint. Work in `/private/tmp/study-next-screens` on `codex/remaining-screens`, not the original dirty repo. User approved preview04 for Tasks/Workspaces and02A for Brain dump as separate screens, all prior features retained. Inspect current Home in signed-in Comet for UI information and view approved images. Check active agents before touching their files. Use Sol/Terra for focused work; keep this plan updated after milestones and before handing off. Complete implementation, appropriate tests and honest desktop/mobile visual QA, leave localhost running, and report unresolved limitations without inventing verification. Do not push/deploy or merge the unrelated phone branch.
