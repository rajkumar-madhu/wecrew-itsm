# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Standalone React SPA for **Argus ITSM** (formerly branded LinkedEye, UI title "WeCrew ITSM") — incidents,
changes, problems, CMDB/assets, alerts, on-call, NOC, k8s/APM/log views, plus SMS/voice/PagerDuty
integrations. The same bundle also serves the **public marketing site** for wecrew.in (see "Public
marketing site" below). Frontend only; there is **no backend and no test runner here**. This is a git
repo (default branch `main`); feature specs and implementation plans live under `docs/superpowers/`
(`specs/`, `plans/`) — read the matching plan before working on a feature branch named after one
(e.g. `razorpay-billing`). Some specs (service catalog, SecurityScorecard integration) have no plan yet.
Other files in `docs/` are customer-facing sales/delivery collateral, not engineering docs.

The API it talks to lives at `/root/projects/argus-itsm/backend` (Express + Prisma + Socket.IO, dev port
**5001**); that repo also carries a **diverged** copy of this app at `frontend-react/` and its own
`CLAUDE.md` with backend/K8s context. The two frontends have drifted — don't assume a change here exists
there. `README.md` in this repo is the untouched Vite template; ignore it.

## Commands

Scripts are in `package.json` (`dev` serves on :5174 and proxies `/api` + `/socket.io` to the backend on
:5001). There is no test runner, no CI config, and no formatter — `npm run build` (which typechecks) plus
`npm run lint` is the whole verification story. Path alias `@/*` → `src/*` is configured in both
`vite.config.ts` and `tsconfig.app.json`, but the codebase uses relative imports throughout.

## Architecture

### Data flow: axios → TanStack Query hooks → components

`src/lib/api.ts` is the single axios instance (`baseURL` = `VITE_API_BASE_URL` or `/api/v1`). Its request
interceptor reads the **`wecrew-auth` localStorage blob directly** — not the Zustand store — and attaches
`Authorization: Bearer` plus `X-Organization-Id`. The response interceptor does single-flight 401 refresh
against `/api/v1/auth/refresh` with a queue of waiters, writes new tokens back into localStorage, and on
refresh failure clears storage and does a hard `window.location.href = '/login'`.

`src/hooks/use<Domain>.ts` (one file per domain, ~20 of them) is the only place `api` is imported from.
Each follows the same shape: a local `keys` object of query-key factories, `useQuery` wrappers with
explicit `staleTime`, and `useMutation` wrappers that `invalidateQueries` on success. **Components should
consume hooks, not call `api` directly** — a few (`LogExplorer`, `K8sClusterDashboard`) break this and
hand-build `X-Organization-Id` headers.

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

Multi-tenancy: only **platform admins** (`role === 'ADMIN'` **and** `user.isPlatformAdmin`) see all orgs and
narrow via `OrgSwitcher` → `selectedOrgId` → `X-Organization-Id`. A plain ADMIN — e.g. a self-registered trial
owner — is locked to their own org by the API, which ignores the header for them; gate tenant-management UI on
`useAuth().isPlatformAdmin`, never on `isAdmin`.
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

### Routing and adding a page

Every route in `src/App.tsx` is `lazy()` + wrapped in its own `<Suspense>`. Protected routes nest under a
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
(`POST /api/v1/public/leads`, rate-limited) exists in the backend; the hook's no-op `onError` is still
load-bearing (it opts out of the global mutation toast — see `queryClient.ts` note above).

`src/components/Landing/LandingPage.tsx` is **orphaned** — nothing routes to it; the Public/ pages
superseded it. Don't extend it.

## Styling — read before writing any className

The app wears the **Sovereign brand** (cloned from `https://sovereign.ops.wecrew.in`): warm paper
workspace, ink navigator rail, coral accent, blue primary. Brand primitives are declared at the top of
`:root` in `src/index.css` (`--brand-paper/ink/coral/blue/green`) and everything else derives from them.

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
  `PrimaryButton`, `GhostButton`, `Segmented`). Nearly all list/dashboard pages (~34 components) are
  migrated — use these for anything new. The brand additions (`cx-hero`, `cx-eyebrow`,
  `cx-section-title`, `cx-signals`, `cx-pill`, `cx-posture`) mirror the Sovereign Command Centre;
  `DashboardOverview` is the reference implementation.
- **Legacy** — old dark-only utilities (`stone-*`, `text-white/60`, `bg-white/[0.04]`) survive in
  ~17 files, mostly the detail/create pages (`IncidentDetail`, `AssetCreate/Detail`,
  `ChangeCreate/Detail`, `ProblemCreate/Detail`), `SignupPage`, `ErrorBoundary`, `NotFound`, and
  residual patches inside otherwise-migrated dashboards. The bottom ~170 lines of `index.css` are a
  compatibility shim (`html.light .app-shell .…`) that remaps those to readable light-mode values.
  Don't add new `stone-*` or white-opacity utilities; every one added grows that shim.

**Cascade trap:** that shim forces `h1`-`h4` and `.text-white` to ink so legacy pages stay readable on the
light workspace. Genuinely dark surfaces (the nav `aside`, `.cx-hero`) must opt back out from the block at
the very end of `index.css`. The `.text-white` rule carries four `:not()` clauses, so an override needs to
match its class count (7) **and** win on element count — a plain `.my-class { color: #fff }` silently loses.

## Deployment

Multi-stage `Dockerfile` (node:20-alpine build → nginx:alpine) serving `dist/` with `nginx.conf`.

The nginx config's `/assets` block is load-bearing and documented in-file: the SPA has CMDB routes at
`/assets`, `/assets/create`, `/assets/:id` **and** Vite emits bundles under `/assets/<hash>.js`. A regex
location matches real bundle extensions first, then a plain prefix `location /assets` serves
`index.html`. **Never change that prefix to `^~ /assets`** — it would skip the regex and return HTML for
JS bundles. nginx proxies `/api/` and `/socket.io/` to upstream `linkedeye-api:5000` (the old service name;
dev proxies to `:5001` instead).

Production is host `wecrew-prod` (**k3s**, not `kind-wecrew`), mid-migration from namespace `itsm-wecrew`
to `wecrew-itsm` (`k8s/wecrew-itsm/`). **Before any build, rollout or manifest change, use the `ship-prod`
skill** (`.claude/skills/ship-prod/SKILL.md`) — it holds the live-namespace check, the kaniko procedure,
and the mandatory diff of the live bundle against `dist/` (prod was once built from a diverged copy).

The GPRC module (`/gprc`, `/risk`, `/compliance`, `/internal-audit`, `/performance`, `/controls`, `/esg`,
`/resilience`, `/digital-twin`; `src/components/Gprc/`) was ported from that diverged copy onto `PageChrome`. It
renders **static demo data** from `src/data/gprc.ts` — there is no GPRC backend.

## Known landmines

- The auth storage key is a plain `AUTH_STORAGE_KEY = 'wecrew-auth'` constant in `lib/api.ts` and
  `lib/socket.ts` (it replaced a self-recursive `getAuthStorageKey()`). Don't reintroduce key migration
  there — the legacy `linkedeye-auth` → `wecrew-auth` migration lives only in `authStore`'s
  `onRehydrateStorage`. If the key ever changes, change all three files.
- Env vars: only `VITE_API_BASE_URL` (`lib/api.ts`, `lib/publicApi.ts`) and `VITE_SOCKET_URL`
  (`lib/socket.ts`) are read. `.env` is gitignored + dockerignored, so production builds use the
  same-origin defaults. Keep `VITE_SOCKET_URL` empty in dev — pointing it at `localhost:5001` bypasses the
  Vite proxy.
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
