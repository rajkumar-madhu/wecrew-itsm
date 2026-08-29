# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Standalone React SPA for **Argus ITSM** (formerly branded LinkedEye, UI title "WeCrew ITSM") — incidents,
changes, problems, CMDB/assets, alerts, on-call, NOC, k8s/APM/log views, plus SMS/voice/PagerDuty
integrations. The same bundle also serves the **public marketing site** for wecrew.in (see "Public
marketing site" below). Frontend only; there is **no backend and no test runner here**. This is a git
repo (default branch `main`); feature specs and implementation plans live under `docs/superpowers/`
(`specs/`, `plans/`) — read the matching plan before working on a feature branch named after one
(e.g. `razorpay-billing`).

The API it talks to lives at `/root/projects/argus-itsm/backend` (Express + Prisma + Socket.IO, dev port
**5001**); that repo also carries a **diverged** copy of this app at `frontend-react/` and its own
`CLAUDE.md` with backend/K8s context. The two frontends have drifted — don't assume a change here exists
there. `README.md` in this repo is the untouched Vite template; ignore it.

## Commands

```bash
npm run dev      # Vite dev server on :5174, proxies /api and /socket.io → http://localhost:5001
npm run build    # tsc -b (typecheck, project refs) && vite build → dist/
npm run lint     # eslint . (flat config; dist/ ignored)
npm run preview  # serve dist/
```

There is no test runner, no CI config, and no formatter — `npm run build` (which typechecks) plus
`npm run lint` is the whole verification story. Path alias `@/*` → `src/*` is configured in both
`vite.config.ts` and `tsconfig.app.json`, but the codebase uses relative imports throughout.

## Architecture

### Data flow: axios → TanStack Query hooks → components

`src/lib/api.ts` is the single axios instance (`baseURL` = `VITE_API_BASE_URL` or `/api/v1`). Its request
interceptor reads the **`wecrew-auth` localStorage blob directly** — not the Zustand store — and attaches
`Authorization: Bearer` plus `X-Organization-Id`. The response interceptor does single-flight 401 refresh
against `/api/v1/auth/refresh` with a queue of waiters, writes new tokens back into localStorage, and on
refresh failure clears storage and does a hard `window.location.href = '/login'`.

`src/hooks/use<Domain>.ts` (21 files, one per domain) is the intended data layer. Each follows the same
shape: a local `keys` object of query-key factories, `useQuery` wrappers with explicit `staleTime`, and
`useMutation` wrappers that `invalidateQueries` on success. **Write new pages against a hook.**

But do not assume an existing page does. Three access patterns are live at once, and the split is not
the exception the aspiration suggests:

| Pattern | Reach | Notes |
| --- | --- | --- |
| Domain hook | 34 of 65 components | The target. `useIncidents`, `useAlerts`, … |
| `import api` directly in the component | **25 of 65 components** | `useQuery`/`useMutation` declared inline against the shared axios instance |
| Raw `fetch()` | 8 files | `StatusPage`, `SignupPage`, `APMDashboard`, `TeamList`, `IncidentReportGenerator`, `LogExplorer`, `MetricsDashboard`, `ProblemDetail` |

**13 components do both** — a hook for one resource and an inline `api.get` for another in the same
file (`IncidentDetail`, `ChangeDetail`, `ProblemCreate`, `DashboardOverview`, `MetricsDashboard`, …), so
grepping a component for `hooks/use` tells you nothing about whether *the call you care about* is
routed through a hook. Read the specific call site.

Consequence for realtime: an inline `useQuery` invents its own key (`['users', queryParams]`,
`['agent-pipeline']`, …), and `useRealtime` invalidates only a fixed list of prefixes. A component is
wired into realtime only if its key happens to share a prefix on that list — otherwise socket events
pass it by, silently and with no error. Moving a page onto its domain hook is what fixes this.

`LogExplorer` and `K8sClusterDashboard` go further and hand-build `X-Organization-Id` headers rather
than letting the request interceptor attach them. (`DeveloperDocs` also contains that header string, but
only inside curl samples it renders as documentation — it is not a client.)

Two further axios/fetch clients exist on purpose and must stay outside the auth machinery:
`src/lib/publicApi.ts` (interceptor-free, for the marketing lead form) and the bare `fetch` in
`src/components/Status/StatusPage.tsx`, which polls `/api/v1/status/:orgSlug` unauthenticated every
60 s. A 401 through the shared `api` instance would bounce an anonymous visitor to `/login`.

Server envelope is `{ data: ... }`, but hooks are inconsistent about unwrapping: some return the whole
axios `data` (component reads `.data`), others return `data.data`. Check the specific hook before using it.

Global query defaults and the mutation-error toast live in `src/lib/queryClient.ts`: a `MutationCache`
`onError` toasts `error.response.data.error` **only when the mutation has no own `onError`** — adding an
`onError` to a mutation silently opts it out of the default toast.

### Auth and multi-tenancy

`src/stores/authStore.ts` (Zustand + `persist`, key `wecrew-auth`) holds user/token/refreshToken/
organization/selectedOrgId. Note `login`, `logout` and `checkAuth` use **raw `fetch` to absolute
`/api/v1/...` paths**, deliberately bypassing the axios instance and its interceptors; everything else
goes through `api`.

Session restore is a three-way handshake — get it right when touching startup:
`onRehydrateStorage` → `checkAuth()` validates the token against `/auth/me`; `App.tsx` also drives
`checkAuth` off `persist.hasHydrated()`/`onFinishHydration` with a 50 ms fallback; `ProtectedRoute` renders
a "Restoring session…" spinner while `isLoading || (token && !isAuthenticated && !user)`. `isLoading`
starts `true` on purpose so no redirect fires before rehydrate.

Multi-tenancy: ADMINs see all orgs and narrow via `OrgSwitcher` → `selectedOrgId` → `X-Organization-Id`.
Roles are `ADMIN | MANAGER | ENGINEER | OPERATOR | VIEWER`; gate routes with
`<ProtectedRoute allowedRoles={[...]}>` and gate in-page actions with `useAuth().canManage(resource)` /
`isAdmin` / `hasRole` from `src/hooks/useAuth.ts`.

### Realtime

`src/lib/socket.ts` holds a module-level singleton Socket.IO client (`autoConnect: false`, token pulled
from the same localStorage blob, same-origin `/socket.io` unless `VITE_SOCKET_URL` is set). Connection
errors are deliberately swallowed — **WS is optional, the app must work without it**.

`src/hooks/useRealtime.ts` is mounted **once, in `Layout`**, and is the only bridge from socket events to
cache: each server event maps to `queryClient.invalidateQueries` on a query-key prefix. When you add a
domain hook, add its event mapping there, and keep the key prefixes in sync — the invalidations are
hardcoded string arrays (`['incidents', 'list']`), so renaming a hook's `keys` silently breaks realtime.

The complete contract as it stands — 12 events, 11 invalidation prefixes:

- Events: `incident:created|updated`, `change:created|updated`, `problem:created|updated`,
  `alert:fired|resolved|acknowledged`, `asset:updated`, `voice:call-completed`, `notification:new`.
- Prefixes invalidated: `['incidents','list']`, `['incidents','detail',id]`, `['changes','list']`,
  `['changes','detail',id]`, `['problems','list']`, `['problems','detail',id]`, `['alerts']`,
  `['assets']`, `['dashboard']`, `['notifications']`, `['voice']`.

Anything outside that list — teams, users, SLA, on-call, k8s, logs, APM, automation — has **no realtime
path at all** today. Don't assume a page refreshes itself because the app "has websockets".

### Routing and adding a page

Every route in `src/App.tsx` is `lazy()`. The six marketing routes share one `PublicChunk` wrapper
(a `<Suspense>` with a neutral `60vh` fallback); every other route declares its own `<Suspense>`, and
`/signup`, `/docs` and `/status/:orgSlug` each hardcode a different fallback background colour to match
the page they are about to render — matching it matters, or the route flashes the wrong colour. Protected routes nest under a
single `<ErrorBoundary><ProtectedRoute><Layout /></ProtectedRoute></ErrorBoundary>` element route. Public
routes: the marketing pages (`/`, `/itsm`, `/modules`, `/security`, `/pilot`, `/contact`) under
`PublicLayout`, plus `/login`, `/signup`, `/docs`, `/status/:orgSlug`.

`/` is auth-aware via `PublicHome`: anonymous visitors get the marketing `HomePage`, a valid session is
redirected to `/dashboard`. It deliberately branches on the persisted `token`, **not** `isLoading`
(which starts `true`), so anonymous visits render immediately — read its comment before changing it.

Adding a page = (1) `lazy` import + `<Route>` in `App.tsx`, (2) an entry in the `navGroups` array in
`src/components/Layout/Sidebar.tsx` (groups: Self-Service / IT Operations / Service delivery /
Intelligence / Administration; per-item `roles` filters visibility), (3) build the page from
`src/components/ui/PageChrome.tsx`.

### Public marketing site (`src/components/Public/`)

Renders without a backend. Page components (`HomePage`, `ItsmPage`, `ModulesPage`, `SecurityPage`,
`PilotPage`, `ContactPage`) are layout-only; **all copy, company details, Cal.com handles and pilot
constants live in `site.ts`** — edit content there, not in the pages. Shared layout primitives are in
`chrome.tsx` and wrap the same `cx-*` brand classes as the app — don't invent a second styling vocabulary.
`PilotPage` embeds Cal.com via `CalEmbed`.

The lead form (`LeadForm` → `src/hooks/usePublicLead.ts`) is the only part that talks to a server. It
uses `src/lib/publicApi.ts` — a separate bare axios instance — **on purpose**: a 401/403 from the shared
`api` instance would trigger the auth-refresh path and bounce a visitor to `/login`. Its target endpoint
(`POST /api/v1/public/leads`) is **not yet implemented in the backend**; the hook's no-op `onError` is
load-bearing (it opts out of the global mutation toast — see `queryClient.ts` note above).

`src/components/Landing/LandingPage.tsx` is **orphaned** — nothing routes to it; the Public/ pages
superseded it. Don't extend it.

## Styling — read before writing any className

The app wears the **Sovereign brand** (cloned from `https://sovereign.ops.wecrew.in`): warm paper
workspace, ink navigator rail, coral accent, blue primary. Brand primitives are declared at the top of
`:root` in `src/index.css` and everything else derives from them:

| Token | Light | Role |
| --- | --- | --- |
| `--brand-paper` | `#f4f1ea` | page background (`--argus-void`) |
| `--brand-ink` | `#0e1116` | text + nav rail + hero panel |
| `--brand-coral` | `#ff5b2e` | accent — primary buttons, active nav, eyebrows |
| `--brand-blue` | `#2b4cff` | `--argus-signal`, links/charts |
| `--brand-green` | `#0f7a55` | success/healthy |

Fonts: **Fraunces** (`font-display`, all headings and stat numerals), **IBM Plex Sans** (`font-body`),
**JetBrains Mono** (`font-mono`, uppercase micro-labels).

**`tailwind.config.js` redefines standard Tailwind palettes as flat semantic colors.** `slate`, `cyan`,
`emerald`, `amber`, `violet`, `coral` and friends are remapped to single CSS variables with only
`DEFAULT`/`dim`/`bright` variants — **`bg-slate-800`, `text-emerald-500` etc. do not exist**. Use
`bg-void`, `bg-obsidian`, `text-ink`, `text-muted`, `text-dim`, `border-steel`, `text-signal`,
`text-coral`, `bg-crimson-dim`, and so on.

Tokens live in `src/index.css` as `--argus-*` variables under `:root, html.light` and `html.dark`.
Theming is class-on-`<html>` (`darkMode: 'class'`), driven by `src/stores/themeStore.ts` (persist key
`wecrew-theme`) **and duplicated as an inline script in `index.html`** that applies the class, `data-theme`,
`color-scheme` and the `theme-color` meta before first paint. Change the token/theme logic in one place and
you must change the other, or you reintroduce FOUC.

Two style generations coexist:

- **Current (`cx-*`)** — `@layer components` in `index.css`, consumed through the typed wrappers in
  `src/components/ui/PageChrome.tsx` (`Page`, `PageHeader`, `KpiRow`/`KpiCard`, `Panel`, `Toolbar`,
  `PrimaryButton`, `GhostButton`, `Segmented`). 42 components carry `cx-*` classes — nearly every
  list/dashboard page is migrated; use these for anything new. The brand additions (`cx-hero`, `cx-eyebrow`,
  `cx-section-title`, `cx-signals`, `cx-pill`, `cx-posture`) mirror the Sovereign Command Centre;
  `DashboardOverview` is the reference implementation.
- **Legacy** — old dark-only utilities (`stone-*`, `text-white/60`, `bg-white/[0.04]`) survive in
  20 files, mostly the detail/create pages (`IncidentDetail`, `AssetCreate/Detail`,
  `ChangeCreate/Detail`, `ProblemCreate/Detail`), `SignupPage`, `LoginPage`, `ErrorBoundary`,
  `NotFound`, `OrgSwitcher`, and residual patches inside otherwise-migrated dashboards
  (`DashboardOverview`, `MetricsDashboard`, `ReportsDashboard`, `AIInsightsDashboard`). `index.css` is
  2143 lines and everything from ~line 1921 is a compatibility shim (`html.light .app-shell .…`) that
  remaps those to readable light-mode values. Don't add new `stone-*` or white-opacity utilities;
  every one added grows that shim.
- **Outside both** — `StatusPage` (the public `/status/:orgSlug` page) ignores the token system entirely
  and hardcodes its own hex palette (`#10B981`, `#F59E0B`, …) in `STATUS_CONFIG`/`OVERALL_CONFIG`. It is
  self-contained by design; don't "fix" it into brand tokens without deciding it should follow the theme.

**Cascade trap:** that shim forces `h1`-`h4` and `.text-white` to ink so legacy pages stay readable on the
light workspace. Genuinely dark surfaces (the nav `aside`, `.cx-hero`) must opt back out from the block at
the very end of `index.css`. The `.text-white` rule carries four `:not()` clauses, so an override needs to
match its class count (7) **and** win on element count — a plain `.my-class { color: #fff }` silently loses.

## Branding

Product name in all new or edited files is **"WeCrew ITSM"**. Never write "LinkedEye" or "Santhira" into
a header, log line, string, comment or class name — even though existing files still contain them
(`lib/api.ts`, `stores/authStore.ts`, `K8sClusterDashboard`, `LogExplorer`, `IncidentReportGenerator`,
`VoiceDashboard`, `nginx.conf`, `.env.example`). Copy the *shape* of a neighbouring file's header, not
its product name. The nginx upstream is still literally named `linkedeye-api` — that is a service name,
leave it alone.

## Deployment

Multi-stage `Dockerfile` (node:20-alpine build → nginx:alpine) serving `dist/` with `nginx.conf`.

The nginx config's `/assets` block is load-bearing and documented in-file: the SPA has CMDB routes at
`/assets`, `/assets/create`, `/assets/:id` **and** Vite emits bundles under `/assets/<hash>.js`. A regex
location matches real bundle extensions first, then a plain prefix `location /assets` serves
`index.html`. **Never change that prefix to `^~ /assets`** — it would skip the regex and return HTML for
JS bundles. nginx proxies `/api/` and `/socket.io/` to upstream `linkedeye-api:5000` (the old service name;
dev proxies to `:5001` instead).

## Known landmines

- **Fixed — do not reintroduce.** `getAuthStorageKey()` in `lib/api.ts` and `lib/socket.ts` used to call
  itself with no base case (~9000 frames per call, swallowed by its own `try/catch`, once per request in
  the axios interceptor). Both are now a plain `const AUTH_STORAGE_KEY = 'wecrew-auth'`, and the
  in-file comments explain why. The legacy `linkedeye-auth` → `wecrew-auth` migration happens once, in
  `authStore`'s `onRehydrateStorage` — that is the only place it belongs.
- **Fixed — do not reintroduce.** `.env` was committed, set `VITE_API_URL` (a name nothing reads), and
  pointed `VITE_SOCKET_URL` at `http://localhost:5001`, bypassing the Vite proxy for WS. It is now
  gitignored (`.env`, `.env.*`, `!.env.example`), sets `VITE_API_BASE_URL=/api/v1` and an **empty**
  `VITE_SOCKET_URL` so both go through the proxy. Leaving `VITE_SOCKET_URL` empty is deliberate.
  `import.meta.env` is read only in `lib/api.ts`, `lib/publicApi.ts` and `lib/socket.ts`.
- **Voice widget (removed 2026-08-08, do not naively re-add).** `index.html` used to hard-code
  `<script src="https://voice.santhira.com/integrations/finspot/embed.js">` with the tenant id and a
  `vsk_…` API key as inline `data-*` attributes. That origin returns **503** (backend removed from
  `173.249.2.23`), and the host before it (`voice.wecrew.in`) no longer resolves — so it was failing on
  every page load. The same embed + **the same key** also sat in `argus-itsm/frontend-react/index.html`
  and two `argus-servicedesk-dev` trees; all have been stripped/redacted.
  A replacement host is wired and ready: **`voice.wecrew.in`** — DNS → this cluster, LE cert issued,
  host-Traefik route in `/docker/traefik/dynamic/voice-wecrew.yml`, ingress in `/root/k8s/voice/`.
  It returns 503 until a `voice-agent` Service exists in namespace `voice`. When re-adding the widget:
  point it at `voice.wecrew.in`, **rotate the old key** (it was public in page source across three
  sites), and inject credentials at runtime rather than as inline `data-*` attributes.
- Several hooks and components are typed with `any` (filters, mutation inputs, socket payloads) even though
  `src/types/index.ts` holds full Prisma-matching interfaces and enums. Prefer those types in new code.
