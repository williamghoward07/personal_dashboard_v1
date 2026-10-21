'use client'

import type { ReactNode } from 'react'
import InfoPopover from '../../InfoPopover'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="font-display text-xs font-semibold text-on-surface">{title}</h3>
      <div className="flex flex-col gap-1 text-xs leading-relaxed text-on-surface-variant">{children}</div>
    </section>
  )
}

// The (i) explainer on the Workspaces pages — keep this in step with the
// features themselves when they change.
export default function WorkspacesHelp({ align = 'start' }: { align?: 'start' | 'end' }) {
  return (
    <InfoPopover label="How Workspaces work" align={align}>
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-on-surface">
          A workspace is a desk for one piece of work — an essay, a project, a side business. It keeps the things you
          need to pick the work back up in one place: the sources you&apos;re using, the next actions, and a dated log
          of your thinking.
        </p>

        <Section title="Folders & colours">
          <p>
            Group workspaces into folders (folders can sit inside folders — e.g. Uni › Year 2). Open a folder to see
            what&apos;s inside; the breadcrumb takes you back up. Drag a workspace or folder by its grip onto another
            folder (or a breadcrumb step) to move it, or use its Move to… menu.
          </p>
          <p>
            Give a folder or a workspace its own colour. A workspace without one uses its folder&apos;s colour (or the
            nearest parent folder that has one), falling back to teal. Deleting a folder moves what&apos;s inside it up
            one level — nothing is deleted with it.
          </p>
        </Section>

        <Section title="Sources">
          <p>
            Add a link with Add source, or drop a URL straight onto the list. Edit a source (pencil) to rename it and
            set its type, citation, DOI and size label; drag cards to reorder them. Attach todos to a source with
            + Task.
          </p>
          <p>
            Tick a source to finish it, like a todo. It greys out for a few seconds, then moves into the Completed list
            under the sources (collapsed — click the arrow to see it). Untick it there to bring it back.
          </p>
          <p>
            <span className="text-on-surface">Launch set</span> opens every unfinished source in its own tab. Browsers usually
            block all but the first tab — if that happens you&apos;ll get an Open next button, and you can allow pop-ups
            for this site (the blocked pop-up icon in the address bar) so the whole set opens in one click next time.
          </p>
        </Section>

        <Section title="Uni modules: weekly readings & study time">
          <p>
            For a module, turn on <span className="text-on-surface">Weekly readings</span> and{' '}
            <span className="text-on-surface">Study time</span> in Layout (they start hidden, so other workspaces stay
            as they are). Put all your modules in one folder — e.g. Year 1 modules — and the folder shows each
            module&apos;s readings bar and hours this week side by side.
          </p>
          <p>
            Readings: paste a link or PDF URL and pick its week. They&apos;re grouped Week 1, Week 2… with a progress
            bar on top and a count per week; tick one off when you&apos;ve read it (it stays in its week). Any source
            can be moved into a week — or back to Sources — with its Week… control.
          </p>
          <p>
            Study time: Log time on the Study time card. Tap a 15-minute block (15m, 30m, 45m, 1h…) or type the exact
            time (50, 1:35, 1h35) — handy for copying sessions over from Opal. Pick an earlier day if you&apos;re catching
            up. This week&apos;s entries can be edited or deleted there, and an optional weekly target fills the ring.
          </p>
        </Section>

        <Section title="Next actions">
          <p>
            These are ordinary todos filed under this workspace. They also appear on the Todos page and — when dated —
            in Daily Goals, tagged with the workspace name, and they sync to Microsoft To Do like every todo. Edit one
            with its pencil (date, reminder time, workspace…), attach an existing todo, link actions to sources, or
            remove one from the workspace without deleting it.
          </p>
        </Section>

        <Section title="Thinking log">
          <p>
            A dated, append-only timeline for picking the work back up after days away — entries can&apos;t be edited or
            deleted. Pick a kind (Realization, Discarded, Argument…), add an optional footnote, and tag entries with
            your own #hashtags: type them in the text or add them as chips. Click a tag to filter the log.
          </p>
        </Section>

        <Section title="Layout">
          <p>
            Use Layout to hide sections a workspace doesn&apos;t need (e.g. just Sources and Log for a side project) —
            the rest of the page, stats included, adapts. Hidden sections keep their data. The chevron on a section
            collapses it to a slim bar so it stops taking space.
          </p>
        </Section>

        <Section title="Stats, sessions & archive">
          <p>
            The rings summarise progress: study time this week (when Study time is on), actions done, sources with a
            type, actions linked to a source, and log entries from the last 7 days. Each visit counts as a session. Archive a workspace when it&apos;s finished;
            Export Markdown bundle (at the bottom) saves the whole workspace — hidden sections included — as one
            file.
          </p>
        </Section>

        <Section title="Workspaces vs Education">
          <p>
            Education is the official record — modules, assessed deadlines, grades and time logged. A workspace is
            where the work gets done. For an essay, keep the deadline in Education and do the work in a workspace
            (put the module in its subtitle).
          </p>
        </Section>
      </div>
    </InfoPopover>
  )
}
