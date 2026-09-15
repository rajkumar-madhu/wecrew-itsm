# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

React 19 + TypeScript + Vite SPA for **Wecrew ITSM** (repo/package names still say Argus / LinkedEye /
`frontend-react`). One bundle serves three surfaces:

1. the **public marketing site** (`/`, `/itsm`, `/modules`, `/security`, `/pilot`, `/contact`),
2. an **anonymous, labeled demo workspace** under `/demo/*` (no auth token is ever set), and
3. the **authenticated workspace** — tickets, incidents, changes, problems, CMDB/assets, alerts, on-call,
   NOC, k8s/APM/logs, SMS/voice/PagerDuty integrations.

Frontend only — no backend here. The API is `/root/projects/argus-itsm/backend` (Express + Prisma +
Socket.IO, dev port **5001**); that repo also carries a **diverged** copy of this app at `frontend-react/`
— don't assume a change here exists there.

`README.md` is current (routes, env vars, checks). Design/validation/deployment records for each release
live in `docs/argus/` (`IMPLEMENTATION.md`, `AUDIT.md`) and `docs/wecrew/`; feature specs and plans live in
`docs/superpowers/{specs,plans}/` — read the matching plan before working on a branch named after one
(e.g. `razorpay-billing`; no billing code exists in `src/` yet).

## Commands

```bash
npm run dev        # Vite on :5174, proxies /api and /socket.io → http://localhost:5001
npm run typecheck  # tsc -b
npm test           # node:test over an explicit file list (see below)
npm run lint       # eslint . — carries ~1600 pre-existing problems; not a clean gate
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve dist/

# single test file
node --experimental-strip-types --test src/features/tickets/model.test.mjs
# lint only what you touched
npx eslint src/features/tickets

# browser e2e (Playwright) — @playwright/test is NOT in package.json; install it first
npm i -D @playwright/test && npx playwright test                 # all specs in e2e/
npx playwright test e2e/demo.spec.ts                               # one spec
E2E_EMAIL=… E2E_PASSWORD=… npx playwright test e2e/command-centre.spec.ts
E2E_BASE_URL=https://itsm.wecrew.in npx playwright test e2e/public.spec.ts   # against live
```

**E2E**: `playwright.config.ts` auto-starts `npm run dev` on `127.0.0.1:5174` only when `E2E_BASE_URL`
is local, runs one worker, and uses the installed **Chrome** channel (`E2E_CHANNEL` to override).
Authenticated specs `test.skip` without `E2E_EMAIL`/`E2E_PASSWORD` and need a real backend.
`e2e/helpers.ts` asserts computed colours (`expectInkRail`, `expectPaperShell`, `isCoral`) — these specs
are the regression guard for the brand palette, so a palette change must update them deliberately.

**Tests** are plain `node:test` `.mjs` files next to the module, importing `.ts` directly via
`--experimental-strip-types` (Node ≥ 22.6). Consequences: the `test` script lists files explicitly, so
**a new test file must be added to `package.json`**; tested modules must stay pure — no `import.meta.env`,
no `@/` alias, no CSS imports, only erasable TS syntax (no `enum`/parameter properties). That's why the
testable logic lives in `model.ts` / `*Store.ts` files separate from the components.

Verification = `typecheck` + `test` + `build`, and no *new* lint errors in touched files; add the relevant
e2e spec for anything that changes routing, the shell, or colours.
`python3 plugins/wecrew-saas-builder/scripts/wecrew-check.py --verify` (a repo-local Codex plugin, also
listed in `.agents/plugins/marketplace.json`) wraps the inventory + typecheck/test step.

## Code layout: two generations

- **`src/components/`** — the original per-domain pages (incidents, changes, problems, assets, NOC, k8s,
  …) built on `src/hooks/use<Domain>.ts` and the `cx-*` style system. Still routed and API-backed; most
  are reachable in the sidebar's **ADVANCED OPERATIONS** group.
- **`src/features/{workspace,tickets,serviceDesk,operations,response}`** — the newer workspace layer
  (dashboard, tickets, portal/catalog/requests/knowledge, CMDB/releases/management/admin, Response
  Studio). Built on `ax-*` styles and the primitives in `features/workspace/ui.tsx` (`Button`, `Badge`,
  `Modal`, `Panel`, `EmptyState`, `Failure`, `Skeleton`, `DemoNotice`) and `features/operations/shared.tsx`.
  **New work goes here.**

`src/components/Layout/Layout.tsx` is shared by both, but its header is
`features/workspace/WorkspaceHeader` (the old `Layout/Header.tsx` is unused) and the sidebar renders
`workspaceNavigation` from `features/workspace/navigation.ts`.

**Two dashboards — don't merge them.** Authenticated `/dashboard` is the **Command Centre**
(`components/Dashboard/DashboardOverview.tsx`, `cx-hero`/`cx-signals`/quick-actions rail — the reference
implementation of the Sovereign look). `/demo/dashboard` and `/dashboard/operations` render the
`features/workspace/Dashboard` overview instead; `e2e/demo.spec.ts` asserts the demo is **not** Command
Centre.

## Architecture

### Auth transport (`src/lib/authTransport.ts`)

Owns `AUTH_STORAGE_KEY = 'wecrew-auth'`, `API_BASE_URL`, a bare `authTransport` axios instance (used for
login/logout/refresh/signup — no interceptors), single-flight `refreshSession()`, and `invalidateSession()`.

It reads/writes session state through a **bridge** that `stores/authStore.ts` registers at module load
(`registerAuthBridge`); before registration it falls back to parsing localStorage. `src/lib/api.ts` is the
authenticated axios instance: request interceptor attaches `Authorization` + `X-Organization-Id` from
`readSession()`; on 401 it refreshes once per request (`_retry`) and retries.

`invalidateSession(expired)` hard-navigates to `/login?session=expired&from=…` **unless the path matches
its public-route regex** (`/`, `/demo`, `/login`, `/signup`, `/itsm`, `/modules`, `/security`, `/pilot`,
`/contact`, `/docs`, `/status`). **Adding a new public top-level route means adding it to that regex**, or
an anonymous 401 will bounce visitors to login.

`authStore` guards every async transition with a module-level `sessionVersion` counter (logout or a new
login wins over in-flight `checkAuth`/refresh) and clears the query cache + socket on session change. The
`linkedeye-auth` → `wecrew-auth` migration runs once at the top of `authStore.ts`.

Session restore: `isLoading` starts `true`; `onRehydrateStorage` and `App.tsx` (via `persist.hasHydrated()`
/ `onFinishHydration`, 50 ms fallback) both call `checkAuth()`, which is de-duplicated per session version.
`ProtectedRoute` shows "Restoring session…" while `isLoading || (token && !isAuthenticated && !user &&
!authError)`; a network failure keeps the token but shows a retry/sign-out screen instead of authorizing.
Login routes `VIEWER` users to `/portal`, everyone else to `/dashboard` (or a safe `from` path).

Roles: `ADMIN | MANAGER | ENGINEER | OPERATOR | VIEWER` on the wire; UI labels come from `roleLabel()` in
`navigation.ts` (Administrator / Manager / Technician / Technician / Requester). Gate routes with
`<ProtectedRoute allowedRoles>`, nav items with a `roles` array, in-page actions with
`useAuth().canManage()` / `isAdmin` / `hasRole`. ADMINs switch orgs via `OrgSwitcher` → `selectedOrgId`.

### Demo mode (`/demo/*`)

`App.tsx` mounts the same `Layout` at `/demo` **without** `ProtectedRoute`. `useWorkspacePath()` returns
`{ demo, path }` — `demo` is true under `/demo`, `path('/tickets')` prefixes `/demo` when needed
(`useDeskPrefix()` is the service-desk equivalent). In demo mode:

- `Layout` skips the realtime bridge and shows `DemoNotice`; the sidebar hides `OrgSwitcher`, ignores
  `roles`, and drops the ADVANCED OPERATIONS group.
- Feature hooks switch data source, e.g. `useTickets` sets `enabled: !demo` on its query and reads the
  persisted Zustand sample store instead. Demo stores use distinct keys (`argus-demo-tickets-v1`,
  `argus-demo-service-desk`); other demo pages keep state only for the mounted session.

Rules: internal links in shared pages must go through `path()` so demo visitors stay under `/demo`; and
**API failures in the live workspace must render `Failure`, never silently fall back to sample data**.
Legacy `components/` pages are not demo-aware — `/demo/{assets,problems,changes,…}` routes to
`DemoOperationsPage` instead.

### Data access

`src/hooks/use<Domain>.ts` (one per domain) is the intended data layer: a local `keys` factory, `useQuery`
with explicit `staleTime`, `useMutation` that invalidates on success. Write new pages against a hook
(feature hooks like `features/tickets/useTickets.ts` follow the same pattern). But don't assume an existing
legacy page does — many `components/` files import `api` directly and declare inline queries, some use raw
`fetch`, and several do both in one file. Read the specific call site. `LogExplorer` and
`K8sClusterDashboard` also hand-build `X-Organization-Id` headers.

Envelope is `{ data: ... }`, but legacy hooks are inconsistent about unwrapping — check before use.
Feature hooks normalize: `useTickets` maps `Incident` → `Ticket` (`normalizeIncident`) and caches under
`['incidents','list','workspace']` — a distinct key so the normalized shape never collides with the
envelope-shaped legacy cache, while still sharing the `['incidents','list']` invalidation prefix.

`src/lib/queryClient.ts`: a `MutationCache` `onError` toasts `error.response.data.error` **only when the
mutation has no own `onError`** — adding one silently opts out of the default toast.

Clients that must stay outside the auth machinery: `lib/publicApi.ts` (interceptor-free, for the
marketing lead form) and the bare `fetch` in `components/Status/StatusPage.tsx`.

### Realtime

`src/lib/socket.ts` is a module-level Socket.IO singleton (`autoConnect: false`, token from localStorage,
same-origin `/socket.io` unless `VITE_SOCKET_URL`). Errors are swallowed on purpose — **the app must work
without WS**. `src/hooks/useRealtime.ts`, mounted once in `Layout` (live mode only), maps server events
(`incident:*`, `change:*`, `problem:*`, `alert:*`, `asset:updated`, `voice:call-completed`,
`notification:new`) to `invalidateQueries` on hardcoded prefixes (`['incidents','list']`,
`['incidents','detail',id]`, `['changes',…]`, `['problems',…]`, `['alerts']`, `['assets']`,
`['dashboard']`, `['notifications']`, `['voice']`). Anything whose key doesn't share one of those prefixes
has no realtime path; renaming a hook's `keys` silently breaks it.

### Routing and adding a page

Every route in `src/App.tsx` is `lazy()`; newer routes wrap in `PublicChunk` (a per-route `<Suspense>` so
a chunk fetch never unmounts the surrounding layout), older ones declare their own `<Suspense>`.
`/signup`, `/docs`, `/status/:orgSlug` hardcode fallback background colours matching their page.
`PublicHome` now renders the marketing `HomePage` for everyone — signed-in users are **not** redirected.

Adding a workspace page = (1) `lazy` import + `<Route>` under the protected element route (and under
`/demo` if it has a demo mode), (2) an item in `workspaceNavigation` (`features/workspace/navigation.ts`,
optional `roles`), (3) build it from `features/workspace/ui.tsx` + `ax-*` classes, (4) add it to the
public-route regex in `authTransport.ts` only if it's anonymous.

### Public marketing site (`src/components/Public/`)

Renders without a backend. Pages are layout-only; **copy, company details, Cal.com handles and pilot
constants live in `site.ts`**. Shared primitives in `chrome.tsx`; page CSS in `argusPublic.css` /
`wecrewLanding.css`. The lead form (`LeadForm` → `hooks/usePublicLead.ts` → `publicApi`) targets
`POST /api/v1/public/leads`, **not implemented in the backend**; the hook's no-op `onError` is
load-bearing (opts out of the global toast). `components/Landing/LandingPage.tsx` is orphaned — don't
extend it.

## Styling — read before writing any className

**Current look (since the 2026-09-15 Command Centre release): the Sovereign brand** — warm paper
workspace, **ink** nav rail and hero, **coral** accent, blue primary. The primitives live at the top of
`:root` in `src/index.css` and everything derives from them:

| Token | Light | Role |
| --- | --- | --- |
| `--brand-paper` | `#f4f1ea` | page background (`--argus-void`) |
| `--brand-ink` | `#0e1116` | text, nav rail (`--argus-nav-bg`), hero panel |
| `--brand-coral` | `#ff5b2e` | accent — primary buttons (`ax-button--primary`), active nav, eyebrows |
| `--brand-blue` | `#2b4cff` | `--argus-signal`, links/charts |
| `--brand-green` | `#0f7a55` | success/healthy |

**`index.css` is the single source of tokens.** `src/features/workspace/workspace.css` (imported globally
in `main.tsx` after `index.css`) holds only `ax-*` rules and must **not** remap `:root` — an earlier
navy/teal "Argus" override there kept the rail light and every dashboard teal, and was removed. Design
records in `docs/argus/IMPLEMENTATION.md` and `docs/wecrew/WHITE-THEME.md` describe that superseded
palette; don't restore it from those docs.

Type: IBM Plex Sans for body **and** headings (`font-display` maps to Plex in `tailwind.config.js`, and
`workspace.css` forces it), JetBrains Mono for uppercase micro-labels. Fraunces is still loaded and used
only by a few hand-written rules (NOC, login, public CSS). The feature CSS files are minified single-line
rules.

Three class vocabularies coexist:

- **`ax-*`** — current, for `src/features/` and the shell (`ax-sidebar`, `ax-page`, `ax-button`,
  `ax-empty`, …). Defined in `workspace.css` and the per-feature CSS files.
- **`cx-*`** — `@layer components` in `index.css`, via `components/ui/PageChrome.tsx` (`Page`,
  `PageHeader`, `KpiRow`/`KpiCard`, `Panel`, `Toolbar`, `PrimaryButton`, …). Used by the migrated legacy
  pages.
- **Legacy dark-only utilities** (`stone-*`, `text-white/60`, `bg-white/[0.04]`) in ~17 detail/create
  pages. The tail of `index.css` is a compatibility shim (`html.light .app-shell .…`) remapping them for
  light mode. Don't add new ones.

**`tailwind.config.js` redefines standard palettes as flat semantic colours** (single CSS variable with
`DEFAULT`/`dim`/`bright`) — **`bg-slate-800`, `text-emerald-500` etc. do not exist**. Use `bg-void`,
`bg-obsidian`, `text-ink`, `text-muted`, `text-dim`, `border-steel`, `text-signal`, `bg-crimson-dim`, ….

**Cascade trap:** the shim forces `h1`–`h4` and `.text-white` to ink. Genuinely dark surfaces
(`aside.ax-sidebar`, `.cx-hero`, `.cx-noc`, `.cx-inspector`) opt back out at the end of `index.css`; the `.text-white` rule
carries four `:not()` clauses, so an override must match its specificity — a plain
`.my-class { color: #fff }` silently loses.

Theming is class-on-`<html>` (`darkMode: 'class'`) via `stores/themeStore.ts` (key `wecrew-theme`) **and
duplicated as an inline script in `index.html`** (class, `data-theme`, `color-scheme`, `theme-color`
meta) to avoid FOUC. Change one, change the other.

## Branding

User-visible product name is **"Wecrew ITSM"**. Don't write "LinkedEye", "Argus" or "Santhira" into new
UI strings (the demo ticket store even rewrites "argus" → "Wecrew" in persisted notes). Internal
identifiers keep the old names on purpose — `--argus-*` tokens, `argus-demo-*` storage keys, the nginx
upstream `linkedeye-api`, the k8s namespace `linkedeye-core` — leave those alone.

## Environment

`import.meta.env` is read in `lib/authTransport.ts` + `lib/publicApi.ts` (`VITE_API_BASE_URL`, default
`/api/v1`), `lib/socket.ts` (`VITE_SOCKET_URL`) and `components/Auth/LoginPage.tsx` (`VITE_SSO_URL`,
offered only if HTTPS or same-origin). `.env` is gitignored and leaves `VITE_SOCKET_URL` **empty** on
purpose so WS goes through the Vite proxy. `VITE_*` values are public — never put secrets there.

## Deployment

Multi-stage `Dockerfile` (node:20-alpine build → nginx:alpine) serving `dist/` with `nginx.conf`. Live at
`https://itsm.wecrew.in` on the `kind-wecrew` cluster, deployment `linkedeye-core/linkedeye-frontend`,
container `frontend`, image `harbor.wecrew.in/linkedeye/argus-itsm-frontend:<YYYYMMDD-HHMMSS>-<label>`.

Each release is recorded as a doc in `docs/wecrew/` (latest image, digest, previous image, verification,
rollback command); `docs/wecrew/DEPLOYMENT.md` links the newest one at its top (currently
`COMMAND-CENTRE-DEPLOYMENT.md`). The established flow is: tests + Docker build from the working tree →
`docker push` to Harbor → also `kind load docker-image --name wecrew` (Harbor has been unstable) →
`kubectl --context kind-wecrew -n linkedeye-core set image deployment/linkedeye-frontend frontend=<image>`
→ `rollout status` → smoke `/`, `/login`, `/demo/dashboard`, `/assets`, `/health`. Rollback is the same
`set image` with the previous tag. Only the frontend image changes; add a new release doc when you ship.

The nginx `/assets` block is load-bearing: the SPA has CMDB routes at `/assets`, `/assets/create`,
`/assets/:id` **and** Vite emits `/assets/<hash>.js`. A regex location matches real bundle extensions
first, then plain prefix `location /assets` serves `index.html`. **Never change that prefix to
`^~ /assets`** — it skips the regex and returns HTML for JS bundles. nginx proxies `/api/` and
`/socket.io/` to `linkedeye-api:5000` (dev uses `:5001`).

## Known landmines

- **Voice widget (removed 2026-08-08, do not naively re-add).** `index.html` used to hard-code
  `<script src="https://voice.santhira.com/integrations/finspot/embed.js">` with a tenant id and a `vsk_…`
  API key as inline `data-*` attributes. That origin returns 503, and the host before it
  (`voice.finspot.in`) no longer resolves. The same key also sat in `argus-itsm/frontend-react/index.html`
  and two `argus-servicedesk-dev` trees; all have been stripped. A replacement host is wired:
  **`voice.wecrew.in`** (DNS → this cluster, LE cert, host-Traefik route in
  `/docker/traefik/dynamic/voice-wecrew.yml`, ingress in `/root/k8s/voice/`), returning 503 until a
  `voice-agent` Service exists in namespace `voice`. When re-adding: point at `voice.wecrew.in`, **rotate
  the old key**, and inject credentials at runtime, not as inline `data-*` attributes.
- `getAuthStorageKey()` used to recurse with no base case in `api.ts`/`socket.ts`; both now use a plain
  constant. Don't reintroduce a key-resolver function — import `AUTH_STORAGE_KEY` from `authTransport.ts`.
- Several legacy hooks/components are typed with `any`; `src/types/index.ts` holds Prisma-matching
  interfaces and enums — prefer those in new code.
