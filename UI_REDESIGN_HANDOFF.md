# Study Copilot UI redesign — living handoff

Updated: 15 November 2026, Europe/London.

## Read first: task and working instructions

The user-approved Home/sidebar, Lectures and Calendar redesign is implemented. The first signed-in desktop review in **Comet** captured Home, Lectures and Calendar Week and identified corrections now in the checkout. The server is running at `http://localhost:3001`. The remaining work is post-fix visual verification and the interaction checks below when the signed-in Comet window is available for automation again.

The user explicitly selected:
- Review localhost against the approved images, then fix clear mismatches.
- Use **Sol/Terra** for focused edits and tests. Reserve a stronger model for difficult decisions.
- Keep this plan current at the start, after every major task, after verification, and before handing off or reaching a usage/context limit.
- Ask material design questions using clickable options in chat. Do not repeatedly request permission for already-approved implementation.
- Open a fresh continuation chat with a concise handoff when context becomes unwieldy. A new chat cannot be assumed to reset account usage limits.

**This file is updated by the working agent; it is not a background automation.** Mark claims as verified, failed, or not checked. A passing test is not proof of visual fidelity. Review outputs critically against the user's request after each major task, adjust the next steps based on the evidence, and preserve unresolved problems here.

## Original brief and decisions

The old Home looked generic/AI-generated: excessive blank space, oversized query panel and progress ring, repeated headers, neon/glass decoration, and redundant service/account information. The user asked for a full critical UI pass, online visual references and generated wireframes before implementation. They preferred Sunsama's restrained visual style and chose the **second concept, B**, a compact widget Home. They then approved refined Home, Lectures and Calendar previews.

Approved direction:
- Warm ivory page, white flat cards, neutral borders, muted sage and module accents, readable compact typography. Reduce decoration and wasted space while retaining functionality.
- Home is **study first**: academic deadlines and lecture preparation take priority; personal todos below. Preserve all widgets, launcher features, resizing, hiding and saved arrangements.
- Desktop sidebar collapses to icons and expands as a whole on hover. Expansion overlays rather than shifts content. Keyboard focus must also reveal labels.
- Lectures uses a **work list plus detail panel**, with responsive mobile details. Preserve module/type filters, upcoming/past-due/completed, Blackboard sync/source actions, session prep and follow-up.
- **Deadline certainty/confirmation is separate from preparation/follow-up completion.** A generated preview confused these; do not reproduce that error.
- Calendar retains **Month, Week, Day, Routines**, **Grid/Agenda**, zoom, Fit day, auto time-block, reconnect, event/session/deadline details and routine scheduling. All three proposed calendar layouts should remain options.
- Tighten spare space under the launcher. Avoid duplicate headings, fake checkboxes and hardcoded demonstration data.

Originally code edits were blocked while another task edited widgets. The user explicitly confirmed that task finished and approved: “Yes—build Home/sidebar first, then Lectures and Calendar.” That authorization remains valid. They now request visual review and correction, plus a localhost preview.

## Workspace and preservation constraints

- Repository: `/Users/williamhoward/local_projects_1/personal_dashboard_v1`
- Current branch: `codex/study-ui-redesign`; HEAD `ad87d27` at handoff.
- All redesign changes are **uncommitted**, including new files. Do not reset/clean/stash away working changes or assume HEAD represents the implementation.
- Another completed widget task's changes are mixed into the working tree. Preserve HomeWidgetFrame resizing/masonry and app-launcher layout/selection changes and tests.
- This checkout originally lagged behind the site used for screenshots. The clean branch `claude/blackboard-sync-dashboard-44560c` was fast-forwarded into this new branch, then the prior widget edits restored. This retained live Blackboard and calendar functionality.
- Separate old worktree: `.claude/worktrees/blackboard-sync-dashboard-44560c`. Do not edit it or stop its server without a reason. Port 3000 previously served that worktree, not this checkout.
- Backup of prior edits: `/private/tmp/study-ui-preexisting.patch`; preservation stash was retained. These are fallback references, not instructions to reapply anything.
- AGENTS.md requires reading relevant Next 16 guides in `node_modules/next/dist/docs/` before writing code. CSS guide has been read previously; new agents should read relevant guidance.
- DESIGN.md and CLAUDE.md now record the approved light planning workspace override. Original dark-only/equal-bento rules do not override the user's approved design for these routes. Other routes retain the old theme.

## Approved reference images — actually view them

Directory: `/Users/williamhoward/.codex/generated_images/01a1d4c5-0bf1-7251-b60d-da7004a1e539/`

1. Initial preferred concept B: `exec-b771573d-3194-447f-acdb-bb598d30e794.png`
2. Refined approved Home: `exec-5cf723bb-279e-47f0-aeb7-eade0d7aa51f.png`
3. Refined approved Lectures: `exec-6f98115f-010c-490b-8106-60384007996c.png`
4. Approved Calendar comparison: `exec-fb333221-88b5-4166-ad1f-72a87bdb8e71.png`

These are concept illustrations, not screenshots proving implementation. Inspect the **current Home screen** in Comet for real content, layout and interactions, then compare with these references. Do not infer visual success from this document alone. Use actual data; preserve semantic corrections noted above.

## Implemented changes

| Area | Current implementation | Status |
| --- | --- | --- |
| Theme | Runtime Tailwind tokens; `app/workspace-ui.css` overrides via `:root:has(.workspace-ui)`, including portalled dialogs. Warm neutral surfaces and flat shared cards. Query mode control flattened. | Build/type checked; visual review pending |
| Shell | `WorkspaceShell.module.css`, AppChrome, Sidebar, TopAppBar. 64px rail expands to 220px on hover/focus without moving content; 44px workspace header; account/settings/integrations/fullscreen/signout retained. | Seven shell tests passed; hover visual review pending |
| Home | Compact heading/date/query. Study priorities uses real Blackboard deadlines plus upcoming prep. Personal todos replaces large progress ring, overall rollup honestly labelled. Live London date refresh. | Automated checks passed; visual comparison pending |
| Layout | New study-first defaults and explicit **Customise → Study layout** preset. Saved orders, sizes, hidden flags and heights preserved. | Tests passed; preview may show old saved arrangement until preset selected |
| Lectures | Compact header/filter controls, grouped selectable work list, desktop detail panel, mobile focus moves to details. Existing WorkRow/ConnectedSessionPrep actions reused. Removed misleading checkbox and duplicate detail title. | Tests passed; real browser review pending |
| Calendar | Compact consolidated toolbar; Month selected-day rail (mobile dialog); Day tasks/deadlines rail; calmer month/time-grid styles. All existing views and tools retained. Disconnected Google displays banner while local data remains visible. | 261 targeted tests passed; real browser review pending |

Key files: `app/page.tsx`, `app/components/home/*`, `app/components/widgets/home/DueSoonGlance.tsx`, `DailyGoals.tsx`, `app/components/lectures/{LecturesBoard,WorkList,WorkRow}.tsx`, `app/components/calendar/*`, `app/components/{AppChrome,Sidebar,TopAppBar,WorkspaceShell.module.css}`, `app/{globals,workspace-ui}.css`, `lib/home/layout.ts`.

## Verified results and limitations

- Post-correction whole-checkout test run: **105 files / 1,184 tests passed**, including the new Study layout preview and save regression test.
  Command: `npx vitest run --exclude '**/.claude/**' --reporter=dot`
  Log: `/private/tmp/study-ui-review-tests.log`.
- Post-correction `npm run build`: passed, exit 0, including TypeScript. Log: `/private/tmp/study-ui-review-build.log`.
- TypeScript: passed, including final Calendar source. `npx tsc --noEmit --incremental false`.
- Changed-file ESLint checks passed. Full Calendar directory lint still has three existing `set-state-in-effect` errors in unchanged RoutineInstanceModal, RoutineSidebar and TimeBlockWizardModal. Do not claim global lint is clean.
- `git diff --check`: passed.
- Duplicate generated `.next/types/* 2.ts` caused an earlier type failure. Those generated duplicates were moved to `/private/tmp/study-ui-generated-type-backup`; application code did not require changes for this.
- Vitest otherwise discovers nested `.claude` worktrees, so keep the exclusion above when checking this checkout.
- The dev server is listening on **http://localhost:3001** on loopback. A fresh unauthenticated request followed the login redirect and returned 200; the signed-in session previously returned 200 for Home and its data requests.
- Comet initially returned stale or blank content and `noWindowsAvailable`. A fresh Comet window and a fresh tab restored enough access to capture signed-in Home, Lectures and Calendar Week. The computer-use tool then reported the user had changed the active Comet window during verification. Browser input stopped to avoid interfering. The successful captures predate the corrections below.

## Next steps, in order

1. Read this file, inspect current git status, and confirm whether localhost port 3001 is still listening.
2. If needed, start this checkout with `npm run dev -- --port 3001 --hostname localhost` with local-network permission. Leave the preview running and provide the link.
3. Use **Comet** (`ai.perplexity.comet`) via the supported computer-use tools. It is the user's signed-in browser. Do not switch to an unauthenticated IAB or automate fresh authentication just to avoid a capture problem.
4. Recheck the compact Home header and the long personal todo in the saved arrangement. Open **Customise → Study layout** to compare the proposed arrangement and launcher packing, then Cancel to return to the saved layout. Apply writes the preference and is unnecessary for visual QA.
5. Verify sidebar collapsed, hover-expanded and keyboard-focused states. Check the content does not shift; account/settings/capture remain usable; check a narrow layout.
6. Inspect Lectures with real data: selection changes details, mobile detail access, filters, prep/follow-up, inferred dates and confirmation/source actions. Avoid modifying real deadlines or completing work merely for QA.
7. Inspect Calendar Month/Week/Day/Routines and Grid/Agenda. Check selected-day details, event readability, overflow, zoom/Fit day and time-block access without writing events as a test.
8. Record mismatches with concrete evidence. Delegate only independent, bounded edits to Sol/Terra, with disjoint file ownership and short prompts. Keep tiny dependent fixes in the coordinating agent. Ask clickable questions only for ambiguous design decisions.
9. After a meaningful fix, inspect it again and run the relevant tests. Repeat full suite/build only if new changes warrant it. Update this file with outcome and remaining issues.
10. Leave localhost running, give the user the preview link and a concise accurate report. No commit, deploy or publication has been requested.

## Acceptance checklist — update after each review

- [x] User design approval and permission to edit obtained.
- [x] Home/sidebar, Lectures and Calendar implemented.
- [x] Automated tests, type checks and production build passed at last implementation checkpoint.
- [x] Localhost restarted and confirmed available for this continuation.
- [x] Current desktop Home compared visually with approved Home concept; layout corrections made and post-fix visual check pending.
- [ ] Sidebar hover/focus expansion and narrow layout visually verified.
- [ ] Lectures real-data list/detail behavior and separate status semantics verified in Comet.
- [ ] All Calendar views and tools reviewed in Comet.
- [ ] User receives a working preview and honest remaining limitations.

## Latest checkpoint and next-action log

**15 November 2026 — corrections and browser limit:** Home now has a single desktop header with the query and Customise controls, and todo metadata sits below titles at every widget width. Study layout opens a local preview and writes only on Apply; Cancel retains the user's saved arrangement. Lectures now uses white list/detail panels and a warm date-confirmation chip. Calendar positions Google and routine event labels at the top of their blocks. The rail uses a lighter sage selection. Browser QA stopped after Comet reported user interaction; narrow layouts, sidebar expansion, Lectures selection and filters, and additional Calendar views still need a signed-in browser check. No preferences or study data were changed for QA.

**15 November 2026 — validation:** Post-correction suite, build, changed-file ESLint and `git diff --check` passed. The new Home regression verifies Cancel makes no settings write and Apply makes one write. Port 3001 is still listening. The next check is visual in signed-in Comet, beginning with the updated Home and the Study layout preview.

**15 November 2026 — signed-in desktop comparison:** Captured Home in a fresh Comet window and Lectures/Week in the existing one. Home's saved arrangement places Study priorities lower down, and a real long todo wraps nearly one word per line alongside its metadata and buttons. The query panel and Customise occupy separate full-width rows; consolidate them into the Home header. Lectures renders the real work list and selected prep detail side by side. Calendar Week centres labels vertically in long Google/routine blocks, whereas the concept aligns them with the start time. Fix these concrete issues and recheck. The Study layout button saves immediately, so avoid applying it to the user's saved settings during review.

**15 November 2026 — continuation started:** Read the handoff and checked the intact working tree on `codex/study-ui-redesign` at `ad87d27`. Viewed all four approved images and read the installed Next.js CSS guide. Restarted Next.js on loopback port 3001 with the required local-network permission. Comet showed the signed-in Week grid with populated events and a valid screenshot. Native input/capture became intermittent again while switching to Home. Continue in the same Comet session and establish which views and interactions can be verified.

**15 November 2026 — handoff prepared:** Implementation and automated validation complete. Visual fidelity remains unverified because Comet capture failed. User selected review-and-fix as next action and Sol/Terra delegation. Port 3001 needs restarting. No additional code changes should precede inspecting the current rendered state unless required to start the app.

For each major milestone append or replace a compact entry:
`Date | task | evidence | passed/failed/not checked | mismatch or risk | next action`.
Keep this current-state summary short; remove stale next steps rather than accumulating contradictory plans.

## Copy into a new session

Continue the Study Copilot UI redesign in `/Users/williamhoward/local_projects_1/personal_dashboard_v1`. First read `UI_REDESIGN_HANDOFF.md` completely and inspect the working tree; do not reset uncommitted changes. The user approved the Sunsama-inspired concept B and the Home/sidebar, Lectures and Calendar implementation. Next restart localhost:3001 if needed, inspect the CURRENT Home in signed-in Comet, view the approved reference images listed in the handoff, compare all three screens, and fix clear mismatches. Use Sol/Terra for focused independent edits/tests and reserve stronger reasoning for difficult decisions. Keep features and saved widget layouts. Ask material design questions as clickable chat options. Update the handoff at the start, after each major task and verification, and before usage/context handoff; record visual success honestly. Leave localhost running and provide the preview link. Do not claim visual verification if Comet capture remains unavailable.

## Repeat these instructions before handing off

Re-read the original brief and the latest user decisions above. Check whether the actual output meets them, not merely whether code compiles. Update status, evidence, failures, server state and the exact next action. Pass this file and the approved image paths to the next chat. Tell the next agent to inspect the current Home screen for UI information. Keep simple tasks on Sol/Terra, avoid duplicated research and giant tool output, and never describe an agent-maintained plan as automatically updating while no agent is running.
