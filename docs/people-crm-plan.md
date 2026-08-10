# People CRM module (`/people`)

> **Status: not yet implemented — this is a design document only.**
>
> Planned on 2026-08-10 from an iPad. The decision was to defer execution until
> back at a PC, where the Google Cloud / Vercel / Supabase setup is less painful.
>
> **The only action taken in that session was committing this document** to
> `claude/custom-crm-supabase-tooor7`. No application code, migrations, or
> configuration were written.
>
> **To pick this up:** open this file with Claude Code on your PC and ask it to
> execute the plan. Everything it needs — schema, file list, build order,
> verification steps, and the manual Google/Vercel/Supabase setup — is below.
> Start with §7 (setup) and §5 (build order).

## Context

Study Copilot currently has five modules (Health, Money, Education, Research,
Habits) but nothing for the people side of university life. Right now every
contact lives in Google Contacts, and the *content* of conversations lives
nowhere — so details worth remembering ("she's applying to the same masters",
"he coaches the 2nd XV") are lost, and there's no way to answer "who do I know
from this place" or "what did I say I'd follow up on".

This adds a **People** module: a contact directory synced read-only from Google
Contacts, an interaction log recording what was discussed, reusable **places**
so contacts are anchored to where you met them, and a **follow-ups** list of
things to raise next time.

**Why Supabase and not Notion, and not Google Contacts notes.** Supabase already
holds every other module, has auth + owner-scoped RLS + a migration chain, and
models people ↔ interactions ↔ places relationally with no extra API. Notion
would add a second auth flow, a second data home and rate limits. Google
Contacts' `biographies` field is a single unstructured text blob per person — no
timestamps, no per-conversation rows, no place links, no querying — and writing
to it needs a sensitive OAuth *write* scope.

So: **Supabase owns the CRM; Google Contacts is a read-only source for the
contact card.** Your existing habit of keeping everyone in Google Contacts stays
intact.

## Decisions (confirmed with the user)

| Decision | Choice |
|---|---|
| Storage | Supabase (source of truth) |
| Google Contacts | Full OAuth read-only sync now (People API, `contacts.readonly`) |
| Accent | **Amber/gold** — new accent, joins mint/blue/orange/pink/purple |
| Places | Dedicated `places` table + Google Maps link-out (no Maps API key) |
| Route / label / icon | `/people` · "People" · lucide `Contact` |

---

## 1. Database — two migrations

### `supabase/migrations/20260810000000_people_crm.sql`

Four tables. All follow the house conventions: `id uuid primary key default
gen_random_uuid()`, `created_at timestamptz not null default now()`, and
`user_id uuid not null references auth.users(id) on delete cascade default
auth.uid()` (inserts never pass `user_id` — the default fills it).

```sql
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  category text not null default 'other'
    check (category in ('cafe','university','pub','restaurant','gym','office','home','event','other')),
  latitude numeric,
  longitude numeric,
  notes text,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  company text,
  job_title text,
  linkedin_url text,
  photo_url text,
  how_we_met text,
  birthday date,
  notes text,
  tags text[] not null default '{}',
  google_resource_name text,        -- 'people/c12345…'
  google_etag text,
  google_synced_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

-- Upsert key for the Google sync; partial so manually-added people are exempt.
create unique index if not exists people_google_resource_idx
  on public.people(user_id, google_resource_name)
  where google_resource_name is not null;

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  title text,
  summary text not null default '',   -- what we actually talked about
  channel text not null default 'in_person'
    check (channel in ('in_person','call','video','message','email','other')),
  place_id uuid references public.places(id) on delete set null,
  follow_up text,                      -- bring this up next time
  follow_up_done boolean not null default false,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);
create index if not exists interactions_occurred_at_idx on public.interactions(occurred_at desc);
create index if not exists interactions_place_id_idx on public.interactions(place_id);

-- Many-to-many: one conversation can involve several people.
create table if not exists public.interaction_people (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.interactions(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (interaction_id, person_id)
);
create index if not exists interaction_people_person_id_idx on public.interaction_people(person_id);
```

Then **repeat the owner-scoped RLS block verbatim for each of the four tables**,
copying the template in `supabase/migrations/20260804010200_integrations_table.sql`:

```sql
alter table public.<t> enable row level security;
create policy "Select own <t>" on public.<t> for select to authenticated using (auth.uid() = user_id);
create policy "Insert own <t>" on public.<t> for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own <t>" on public.<t> for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own <t>" on public.<t> for delete to authenticated using (auth.uid() = user_id);
revoke all on public.<t> from anon;
grant select, insert, update, delete on public.<t> to authenticated;
create index if not exists <t>_user_id_idx on public.<t>(user_id);
```

`interaction_people` needs its own `user_id` + policies — RLS does **not**
inherit through foreign keys, so without it the join table is unreadable.

### `supabase/migrations/20260810000100_google_contacts_tokens.sql`

Extends the existing (currently unused) `integrations` table rather than adding
a new one:

```sql
alter table public.integrations
  add column if not exists encrypted_refresh_token text,
  add column if not exists sync_token text,
  add column if not exists account_email text;

create unique index if not exists integrations_user_provider_idx
  on public.integrations(user_id, provider);
```

`vault_secret_name` stays unused — the token is encrypted in the app instead
(see §2), so a database leak alone doesn't yield a usable token.

---

## 2. Google OAuth — standalone flow, not bolted onto login

**Recommendation: a dedicated flow at `/api/google/*`, writing to `integrations`.**

The alternative — adding `contacts.readonly` to the existing
`signInWithOAuth({provider:'google'})` in `app/login/page.tsx` — is fewer files
but worse: it forces a scary consent screen on *sign-in* for everyone, needs a
full re-login to (re)connect, and Supabase only surfaces `provider_refresh_token`
in the session immediately after the callback, so it has to be scraped at exactly
one moment or it's gone. A separate flow gives a proper Connect/Disconnect
button on the People page, keeps login untouched, and is exactly what the
`integrations` table was scaffolded for.

Four route handlers (the app's first `app/api/` routes; `app/auth/callback/route.ts`
is the shape to copy):

| Route | Method | Does |
|---|---|---|
| `app/api/google/connect/route.ts` | GET | Generates random `state`, sets it in an httpOnly cookie, redirects to Google's consent URL with `scope=contacts.readonly`, `access_type=offline`, `prompt=consent` |
| `app/api/google/callback/route.ts` | GET | Verifies `state` against the cookie, exchanges `code` for tokens, encrypts the refresh token, upserts the `integrations` row (`provider='google_contacts'`), redirects to `/people?connected=1` |
| `app/api/google/contacts/sync/route.ts` | POST | Refreshes the access token, pages the People API, upserts `people`, stores the new `syncToken`, stamps `last_synced_at` / `last_error` |
| `app/api/google/disconnect/route.ts` | POST | Revokes the token at Google, deletes the `integrations` row |

Supporting libs:

- **`lib/crypto.ts`** — `encryptSecret()` / `decryptSecret()` using `node:crypto`
  AES-256-GCM, stored as `iv:authTag:ciphertext` base64. No new dependency.
  The 32-byte key is **derived** from `INTEGRATION_ENCRYPTION_KEY` with
  `createHash('sha256').update(secret).digest()`, so the env var can be any long
  random string rather than exactly-32-raw-bytes-base64. This matters because the
  setup is being done from an iPad with no terminal — a password generated by
  Apple Passwords / 1Password works fine, no `openssl rand` required.
- **`lib/google/oauth.ts`** — consent-URL builder, `exchangeCode()`,
  `refreshAccessToken()`, `revokeToken()`. Plain `fetch` against
  `https://oauth2.googleapis.com/token`; no `googleapis` package (it's huge and
  we need four calls).

**`proxy.ts` needs no change.** You're already signed in when you hit
`/api/google/*`, so the auth redirect never fires. These routes read the user via
`createClient()` from `@/lib/supabase/server` and write under RLS as that user —
`lib/supabase/admin.ts` (service role) stays unused.

Google Cloud setup is a manual, browser-only job — see §7 for the step-by-step.
A new `.env.example` documents all six vars (three existing Supabase + the three
new ones).

### Sync logic (`lib/google/people.ts`)

`GET https://people.googleapis.com/v1/people/me/connections` with
`personFields=names,emailAddresses,phoneNumbers,organizations,photos,urls,biographies,birthdays,metadata`,
`pageSize=200`, following `nextPageToken`, and `requestSyncToken=true` on the
first run. Later runs send the stored `syncToken` for an incremental delta; a
`410 Gone` means the token expired — clear it and do a full resync.

Field mapping:

| Google | `people` column |
|---|---|
| `resourceName` | `google_resource_name` (upsert key) |
| `metadata.sources[0].etag` | `google_etag` |
| `names[0].displayName` | `full_name` |
| `emailAddresses[0].value` | `email` |
| `phoneNumbers[0].value` | `phone` |
| `organizations[0].name` / `.title` | `company` / `job_title` |
| `photos[0].url` | `photo_url` |
| `urls[]` where value contains `linkedin.com` | `linkedin_url` |
| `birthdays[0].date` | `birthday` |
| `biographies[0].value` | appended into `notes` **only on first insert** |

**Conflict rule (deliberately simple): Google owns the contact card, the app owns
the CRM fields.** A sync overwrites `full_name`, `email`, `phone`, `company`,
`job_title`, `photo_url`, `linkedin_url`, `birthday`. It never touches `notes`,
`tags`, `how_we_met`, or interactions. People created manually in the app have a
null `google_resource_name` and are never touched by sync at all.

---

## 3. UI — `/people`

`app/people/page.tsx` is a thin server component in the house style:

```tsx
<PageContainer title="People" subtitle="Contacts, conversations, and the places you met." accent="amber">
  <PeopleBoard />
</PageContainer>
```

`PeopleBoard` (`'use client'`) is the single data owner — one `refresh()` that
`Promise.all`s people, places, interactions and `interaction_people`, then returns
a bare fragment so its children land as direct grid items (the `MoneyBoard`
pattern). It carries the `runMutation` + error-banner helper from `HabitBoard`,
since a missing migration is the most likely first failure.

Cards, in grid order:

| Card | Span | Contents |
|---|---|---|
| `PeopleDirectoryCard` | `sm:col-span-2 xl:col-span-2` | Search box + tag filter, avatar rows, click → person detail, `+` → add person |
| `FollowUpsCard` | `sm:col-span-2 xl:col-span-2` | Open follow-ups grouped by person, checkbox to mark done |
| `InteractionsCard` | `sm:col-span-2 xl:col-span-2` | Reverse-chronological log: who, where, one-line summary; `+` → log interaction |
| `PlacesCard` | `sm:col-span-2 xl:col-span-1` | Places with people-met count, `MapPin` link-out, `+` → add place |
| `GoogleContactsCard` | `sm:col-span-2 xl:col-span-1` | Connected account, last synced, Sync now / Connect / Disconnect |

Detail modals, in the Notion-style "tailored view" spirit from `CLAUDE.md` —
each is a bespoke view of *that* record, not a generic form:

- **`PersonDetailModal`** — photo + name + role/company header; contact card
  (email, phone, LinkedIn as a real link, birthday); your notes and tags; **their
  interaction timeline**; **places you've met them** (derived from their
  interactions, no extra table); open follow-ups; Edit / Delete.
- **`PlaceDetailModal`** — name, category chip, address with a Google Maps
  link-out; **everyone you've met here**; interactions at this place.

Form modals (`PersonFormModal`, `InteractionFormModal`, `PlaceFormModal`) follow
the existing contract exactly: `{isOpen, heading, initialValues?, onSave, onClose}`,
module-scope `inputClass`/`labelClass` with `focus:border-people-amber`, label
wraps input, `if (!isOpen) return null`, empty string → `null` on submit, ghost
Cancel + filled Save footer. `InteractionFormModal` gets a multi-select for
people and a place dropdown with an inline "new place" escape hatch.

Amber is a light accent, so the filled Save button uses the same on-color the
other light accent does (`HabitFormModal.tsx:233`):
`rounded-lg bg-people-amber px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110`
— not the `text-white` used by the dark orange/pink accents.

`lib/places.ts` holds one helper, `mapUrl(place)` — returns
`https://www.google.com/maps/search/?api=1&query=…` from lat/long when present,
else the URL-encoded address. Free, no API key. (An *embedded* map would need
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; deferred.)

### Theme wiring (three files, all small)

- **`app/globals.css`** — add `--color-people-amber: #ffc233;` under
  `/* Module accents */`. Gold, clearly separate from `--color-academic-orange`
  (`#ff6b00`) in the sidebar.
- **`lib/theme.ts`** — add `'amber'` to the `Accent` union and an entry to each
  of `ACCENT_TEXT` (`text-people-amber`), `ACCENT_GLOW`
  (`hover:border-people-amber/50 hover:shadow-[0_0_15px_rgba(255,194,51,0.2)]`),
  `ACCENT_CHIP`, `ACCENT_BAR`; add `people: 'amber'` to `MODULE_ACCENT` (its key
  union is a literal type, so this is a compile error until added).
- **`app/components/Sidebar.tsx`** — one `navItems` row:
  `{ href: '/people', label: 'People', icon: Contact, module: 'people' }`.
  (`Contact` — the contacts-card glyph — is confirmed present in lucide-react
  1.28.0, alongside `ContactRound` if you prefer the rounded variant.)

Tailwind v4 has no config file and can't see dynamically-built class strings —
so, as everywhere else in this codebase, write `text-people-amber` /
`bg-people-amber` literally rather than interpolating the accent name.

### Elsewhere

- **`lib/types.ts`** — add `Person`, `Place`, `Interaction`, `InteractionPerson`,
  `InteractionChannel`, `PlaceCategory`, `Integration` interfaces, matching the
  existing hand-written snake_case style.
- **`app/page.tsx`** — add a sixth glance card, `PeopleGlance`
  (`app/components/widgets/home/PeopleGlance.tsx`), showing the next open
  follow-ups via `HomeSectionCard href="/people" accent="amber"`.

---

## 4. Files

**Create** — migrations (2); `app/people/page.tsx`; `app/components/widgets/people/`
× 11 (`PeopleBoard`, `PeopleDirectoryCard`, `PersonFormModal`, `PersonDetailModal`,
`InteractionsCard`, `InteractionFormModal`, `FollowUpsCard`, `PlacesCard`,
`PlaceFormModal`, `PlaceDetailModal`, `GoogleContactsCard`);
`app/components/widgets/home/PeopleGlance.tsx`; `app/api/google/` × 4 route
handlers; `lib/crypto.ts`, `lib/google/oauth.ts`, `lib/google/people.ts`,
`lib/places.ts`; `.env.example`.

**Modify** — `app/globals.css` (amber token), `lib/theme.ts` (accent + module),
`app/components/Sidebar.tsx` (nav row), `lib/types.ts` (7 types),
`app/page.tsx` (glance card).

## 5. Build order

1. Migrations + `lib/types.ts`.
2. Theme token, `lib/theme.ts`, Sidebar nav row, empty `/people` page — confirm
   the module renders and the sidebar lights up amber.
3. Places (table → card → form → detail modal) — no dependencies, proves the pattern.
4. People (directory card, form, detail modal) — manual entry only.
5. Interactions + `interaction_people` multi-select, then `FollowUpsCard`.
6. `lib/crypto.ts` + `lib/google/oauth.ts` + connect/callback/disconnect routes
   + `GoogleContactsCard`.
7. `lib/google/people.ts` + sync route.
8. `PeopleGlance` on the home page.

## 6. Verification

### What I can verify in this session

This session runs in an ephemeral cloud container, **not** on your machine. Two
hard limits, both confirmed by testing rather than assumed:

- **`*.supabase.co` is blocked by this environment's network policy** (the proxy
  returns 403 to CONNECT), and there are no Supabase credentials here — no
  `.env` file, no env vars, no `supabase` CLI. So I **cannot touch your database
  from here** under any circumstances. You run the migrations.
- **`node_modules` is empty** and there are no `NEXT_PUBLIC_SUPABASE_*` vars, so
  `npm run build` would fail at prerender (`lib/supabase.ts` builds its client at
  module scope). Realistic checks here are `npm install` then
  `npx tsc --noEmit` and `npm run lint` — which do catch the whole class of error
  that matters most, since `Accent` and `MODULE_ACCENT` are literal unions.

Google's endpoints (`oauth2.googleapis.com`, `people.googleapis.com`) *are*
reachable from here, but they're useless without your OAuth client, so the sync
is verified by you after deploy.

### What you verify after deploying

1. **Migrations** — paste both files into the Supabase SQL editor (that's how the
   existing ones were applied; the CLI chain is broken because
   `20260803223028_remote_schema.sql` is a zero-byte file, so `db reset` would
   fail on the pre-existing `years`/`modules`/`tasks`/`topics` tables). Confirm
   all four tables appear with RLS enabled.
2. **Manual CRUD** — sign in, open `/people`. Add a place, add a
   person, log an interaction linking both, set a follow-up. Verify it appears in
   `FollowUpsCard`, tick it done, confirm it clears. Open the person → their
   timeline and "places you've met" are populated. Open the place → they're listed
   under "met here". Delete each and confirm the confirm-dialog path works.
3. **RLS** — in the Supabase SQL editor confirm `select * from interaction_people`
   as `anon` returns nothing.
4. **Google** — click Connect, complete consent, confirm redirect to
   `/people?connected=1` and that the `integrations` row has a non-null
   `encrypted_refresh_token` that is *not* readable plaintext. Click Sync now;
   confirm contacts appear with photos and any LinkedIn URLs. Edit a synced
   person's `notes`/`tags`, sync again, confirm those survive while the contact
   card refreshes. Disconnect and confirm the row is gone and the token is revoked
   at <https://myaccount.google.com/permissions>.
5. **Visual** — at 1440px check the bento grid has no orphan row, the amber hover
   glow matches the other modules, and amber is distinguishable from Education's
   orange in the sidebar.

---

## 7. Setup you must do (all browser-only, works on iPad)

### 7a. Google Cloud — create the OAuth client

Google renamed this area to **"Google Auth Platform"** in 2025, so you may see
either the old *APIs & Services → OAuth consent screen* wording or the newer
*Branding / Audience / Clients / Data Access* tabs. Both paths are given.

1. Go to <https://console.cloud.google.com> and sign in as
   `williamghoward07@gmail.com`.
2. **Create a project** — project dropdown in the top bar → *New Project* → name
   it `Study Copilot` → *Create*. Make sure it's the selected project afterwards.
3. **Enable the People API** — search "People API" in the top search bar (or
   *APIs & Services → Library*) → open it → **Enable**.
4. **Configure the consent screen** — *APIs & Services → OAuth consent screen*
   (new UI: *Google Auth Platform → Branding*). Choose **External**. Fill in app
   name (`Study Copilot`), user support email, developer contact email → Save.
5. **Add the scope** — *Data Access* tab (old UI: the *Scopes* step) → *Add or
   Remove Scopes* → filter for `contacts.readonly` → tick
   `.../auth/contacts.readonly` → *Update* → *Save*.
6. **Add yourself as a test user** — *Audience* tab (old UI: the *Test users*
   step) → *Add users* → `williamghoward07@gmail.com` → Save. **Leave publishing
   status on "Testing"** — see §8.
7. **Create the client** — *Clients* (old UI: *Credentials*) → *Create
   Credentials → OAuth client ID* → Application type **Web application** → name
   it → under **Authorised redirect URIs** add:
   - `https://<your-production-domain>/api/google/callback`
   - `https://<vercel-branch-alias>/api/google/callback` *(only if testing on the
     preview deploy before merging — see 7d)*
   - `http://localhost:3000/api/google/callback` *(for when you're back on your PC)*

   → **Create** → copy the **Client ID** and **Client Secret**.

Redirect URIs must match *exactly* — scheme, host, path, no trailing slash.

### 7b. Vercel — add three environment variables

Vercel's dashboard works fine in iPad Safari. *Project → Settings → Environment
Variables*, add for **Production** (and Preview too if testing there):

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from 7a.7 |
| `GOOGLE_CLIENT_SECRET` | from 7a.7 |
| `INTEGRATION_ENCRYPTION_KEY` | any long random string — generate one with Apple Passwords or 1Password. Per §2 it's hashed to 32 bytes, so the format is free-form and no terminal is needed. |

**Env vars bind to a deployment at build time, so a change only takes effect on
the next deploy.** You don't need to deploy repeatedly though — add all three
*first*, then merging this branch triggers one deploy that picks them all up.
Only if you change a value later do you need *Deployments → ⋯ → Redeploy*.

You never need a `.env.local` unless you're running the app locally. Back at your
PC: `git pull`, then either hand-write `.env.local` or run
`npx vercel env pull .env.local` to download everything you just set.

### 7c. Migrations — Supabase SQL editor

I can't reach your database from here (§6), so this one is yours:

1. Open <https://supabase.com/dashboard/project/ngkazwhmkzsuvtkleynr/sql/new>.
2. Open each new migration on GitHub from the `claude/custom-crm-supabase-tooor7`
   branch, copy the SQL, paste, **Run** — `20260810000000_people_crm.sql` first,
   then `20260810000100_google_contacts_tokens.sql`.
3. Check *Table Editor* for `people`, `places`, `interactions` and
   `interaction_people`, all with RLS enabled.

### 7d. Deploy

Pushing the branch gives a Vercel **Preview** deployment on a URL that is *not*
your production domain. Two options:

- **Simplest:** merge to `main`, let it deploy to production, and register only
  the production redirect URI in Google.
- **Test first:** also register the stable branch-alias preview URL
  (`<project>-git-claude-custom-crm-tooor7-<scope>.vercel.app`). Avoid the
  per-deployment hash URLs — those change on every push.

The OAuth routes derive `redirect_uri` from the incoming request origin, so the
same code works on both without a `GOOGLE_REDIRECT_URI` var.

## 8. Risks / sharp edges

- **Testing-mode refresh tokens expire after 7 days.** Expect to re-Connect
  weekly until you publish the OAuth app. The sync route must surface a failed
  refresh as a clear "reconnect needed" state in `GoogleContactsCard` via
  `integrations.last_error`, not a silent failure.
- **`contacts.readonly` is a sensitive scope.** Publishing the app to Production
  triggers Google verification. Testing mode sidesteps it for single-user use.
- **`INTEGRATION_ENCRYPTION_KEY` is not recoverable.** Rotating it orphans the
  stored token — the fix is Disconnect + Connect, which the UI supports.
- **The migration chain is already non-self-contained** (empty
  `20260803223028_remote_schema.sql`). This work doesn't fix that; applying via
  the SQL editor sidesteps it.
- **Google photo URLs expire.** `photo_url` is a Google-hosted URL that rotates;
  broken avatars should fall back to initials rather than a broken image.
