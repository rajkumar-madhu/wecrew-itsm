import { useMemo, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BookOpen, ChevronRight, Clock, FileText, Inbox, LayoutGrid, Loader2, Search, ShieldCheck, Star, X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  apiErrorMessage, usePortalCatalog, usePortalIncidents, usePortalKnowledge, usePortalRequests,
  type PortalCatalogItem,
} from '../../hooks/usePortal';
import {
  formatHours, incidentStatus, isIncidentRateable, isRequestRateable, requestStatus, timeAgo, useDebounced, type Tone,
} from './portalUtils';
import StatusPill from './StatusPill';
import { Card, EmptyState, ErrorBlock, LoadingBlock } from './ui';
import { primaryBtn, secondaryBtn } from './styles';

interface TicketRow {
  kind: 'request' | 'incident';
  id: string;
  number: string;
  title: string;
  status: { label: string; tone: Tone };
  updatedAt: string;
  rateable: boolean;
}

export default function PortalHome() {
  const user = useAuthStore((s) => s.user);
  const catalogRef = useRef<HTMLElement>(null);

  return (
    <div className="space-y-10">
      <HeroSearch firstName={user?.firstName} onRequest={() => {
        catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        catalogRef.current?.focus({ preventScroll: true });
      }} />
      <MyTickets />
      <Catalog sectionRef={catalogRef} />
    </div>
  );
}

// ── Hero + knowledge search ────────────────────────────────────────────

function HeroSearch({ firstName, onRequest }: { firstName?: string; onRequest: () => void }) {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q.trim(), 300);
  const searching = debounced.length >= 2;
  const kb = usePortalKnowledge(debounced, searching);
  const results = searching ? kb.data ?? [] : [];

  return (
    <section aria-labelledby="portal-hero-title" className="relative overflow-hidden rounded-3xl border border-[#E0E7FF] bg-gradient-to-br from-[#EEF2FF] via-[#FFFFFF] to-[#F0F9FF] px-5 py-8 sm:px-10 sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#C7D2FE]/40 blur-3xl" />
      <div className="relative mx-auto max-w-2xl text-center">
        {firstName && <p className="mb-1 text-sm font-medium text-[#4338CA]">Hi {firstName}</p>}
        <h1 id="portal-hero-title" className="font-display text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
          How can we help?
        </h1>
        <p className="mt-2 text-[15px] text-[#475569]">Search for answers, report a problem, or ask for something you need.</p>

        <div className="relative mt-6 text-left">
          <label htmlFor="portal-search" className="sr-only">Search help articles</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#64748B]" aria-hidden="true" />
          <input
            id="portal-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. reset my password, VPN not connecting"
            autoComplete="off"
            className="block w-full rounded-2xl border border-[#CBD5E1] bg-[#FFFFFF] py-4 pl-12 pr-12 text-base text-[#0F172A] placeholder:text-[#64748B] shadow-[0_4px_16px_-6px_rgba(79,70,229,0.25)] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {searching && (
          <div className="mt-3 text-left" aria-live="polite">
            <Card as="div" className="overflow-hidden">
              {kb.isLoading ? (
                <div className="flex items-center gap-2 px-4 py-4 text-sm text-[#475569]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#4F46E5]" aria-hidden="true" /> Searching articles…
                </div>
              ) : kb.isError ? (
                <p role="alert" className="px-4 py-4 text-sm text-[#B91C1C]">{apiErrorMessage(kb.error, 'Search is unavailable right now.')}</p>
              ) : results.length === 0 ? (
                <div className="px-4 py-5 text-sm text-[#475569]">
                  <p className="font-medium text-[#0F172A]">No articles match “{debounced}”.</p>
                  <p className="mt-1">Try different words, or <Link to="/portal/report" className="font-medium text-[#4338CA] underline">report the problem</Link> and we'll help.</p>
                </div>
              ) : (
                <ul className="divide-y divide-[#E2E8F0]">
                  <li className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#475569]">
                    {results.length} article{results.length === 1 ? '' : 's'} found
                  </li>
                  {results.slice(0, 8).map((a) => (
                    <li key={a.id}>
                      <Link to={`/portal/knowledge/${a.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC] focus:bg-[#F8FAFC] focus:outline-none">
                        <BookOpen className="mt-0.5 h-4 w-4 flex-none text-[#4F46E5]" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-[#0F172A]">{a.title}</span>
                          <span className="block text-xs text-[#475569]">
                            {[a.category, a.helpfulYes > 0 ? `${a.helpfulYes} found this helpful` : null].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <ChevronRight className="mt-0.5 h-4 w-4 flex-none text-[#64748B]" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/portal/report" className={`${primaryBtn} py-3 text-base`}>
            <AlertTriangle className="h-5 w-5" aria-hidden="true" /> Report a problem
          </Link>
          <button type="button" onClick={onRequest} className={`${secondaryBtn} py-3 text-base`}>
            <LayoutGrid className="h-5 w-5" aria-hidden="true" /> Request something
          </button>
        </div>
      </div>
    </section>
  );
}

// ── My tickets ─────────────────────────────────────────────────────────

function MyTickets() {
  const requests = usePortalRequests();
  const incidents = usePortalIncidents();

  const rows = useMemo<TicketRow[]>(() => {
    const r: TicketRow[] = (requests.data ?? []).map((x) => ({
      kind: 'request', id: x.id, number: x.number,
      title: x.title || x.catalogItem?.name || 'Request',
      status: requestStatus(x.state), updatedAt: x.updatedAt,
      rateable: isRequestRateable(x.state, x.csatScore),
    }));
    const i: TicketRow[] = (incidents.data ?? []).map((x) => ({
      kind: 'incident', id: x.id, number: x.number, title: x.shortDescription,
      status: incidentStatus(x.state), updatedAt: x.updatedAt,
      rateable: isIncidentRateable(x.state, x.csatScore),
    }));
    return [...r, ...i].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [requests.data, incidents.data]);

  const loading = requests.isLoading || incidents.isLoading;
  const error = requests.error || incidents.error;

  return (
    <section aria-labelledby="my-tickets-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="my-tickets-title" className="font-display text-xl font-semibold text-[#0F172A]">My tickets</h2>
        {rows.length > 0 && <span className="text-sm text-[#475569]">{rows.length} total</span>}
      </div>
      <Card className="overflow-hidden">
        {loading ? (
          <LoadingBlock label="Loading your tickets…" />
        ) : error && rows.length === 0 ? (
          <div className="p-4">
            <ErrorBlock
              message={apiErrorMessage(error, 'We couldn’t load your tickets.')}
              onRetry={() => { requests.refetch(); incidents.refetch(); }}
            />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Inbox className="h-6 w-6" />} title="No tickets yet">
            When you report a problem or request something, you can follow its progress here.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-[#E2E8F0]">
            {rows.map((t) => (
              <li key={`${t.kind}-${t.id}`}>
                <Link
                  to={`/portal/${t.kind === 'request' ? 'requests' : 'incidents'}/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#F8FAFC] focus:bg-[#F8FAFC] focus:outline-none sm:px-5"
                >
                  <span
                    aria-hidden="true"
                    className={`hidden h-9 w-9 flex-none items-center justify-center rounded-full sm:flex ${t.kind === 'request' ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'bg-[#FFF7ED] text-[#C2410C]'}`}
                  >
                    {t.kind === 'request' ? <FileText className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[#0F172A]">{t.title}</span>
                    <span className="mt-0.5 block text-xs text-[#475569]">
                      <span className="font-mono">{t.number}</span>
                      <span className="sr-only">, {t.kind === 'request' ? 'request' : 'problem report'}</span>
                      {' · '}Updated {timeAgo(t.updatedAt)}
                    </span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                    {t.rateable && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-xs font-medium text-[#92400E]">
                        <Star className="h-3 w-3 fill-[#F59E0B] text-[#D97706]" aria-hidden="true" /> Rate it
                      </span>
                    )}
                    <StatusPill label={t.status.label} tone={t.status.tone} />
                  </span>
                  <ChevronRight className="hidden h-4 w-4 flex-none text-[#64748B] sm:block" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

// ── Catalog ────────────────────────────────────────────────────────────

function Catalog({ sectionRef }: { sectionRef: RefObject<HTMLElement | null> }) {
  const { data, isLoading, error, refetch } = usePortalCatalog();

  const groups = useMemo(() => {
    const map = new Map<string, PortalCatalogItem[]>();
    for (const item of data ?? []) {
      const cat = item.category?.trim() || 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)))
      .map(([cat, items]) => [cat, items.sort((x, y) => x.name.localeCompare(y.name))] as const);
  }, [data]);

  return (
    <section ref={sectionRef} aria-labelledby="catalog-title" className="scroll-mt-20 focus:outline-none" tabIndex={-1}>
      <h2 id="catalog-title" className="font-display text-xl font-semibold text-[#0F172A]">Request something</h2>
      <p className="mb-4 mt-1 text-sm text-[#475569]">Pick what you need and we'll route it to the right team.</p>

      {isLoading ? (
        <Card><LoadingBlock label="Loading catalog…" /></Card>
      ) : error ? (
        <ErrorBlock message={apiErrorMessage(error, 'We couldn’t load the catalog.')} onRetry={() => refetch()} />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={<LayoutGrid className="h-6 w-6" />} title="Nothing to request yet">
            Your IT team hasn't published any catalog items. You can still <Link to="/portal/report" className="font-medium text-[#4338CA] underline">report a problem</Link>.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map(([cat, items]) => (
            <div key={cat}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#475569]">{cat}</h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/portal/new/${item.id}`}
                      className="group flex h-full flex-col rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 transition hover:-translate-y-0.5 hover:border-[#A5B4FC] hover:shadow-[0_8px_24px_-12px_rgba(79,70,229,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-display text-base font-semibold text-[#0F172A] group-hover:text-[#4338CA]">{item.name}</span>
                        <ChevronRight className="mt-0.5 h-4 w-4 flex-none text-[#64748B] transition group-hover:translate-x-0.5 group-hover:text-[#4F46E5]" aria-hidden="true" />
                      </span>
                      {item.description && <span className="mt-1 line-clamp-3 text-sm text-[#475569]">{item.description}</span>}
                      {(item.requiresApproval || item.fulfillmentHours) && (
                        <span className="mt-auto flex flex-wrap gap-2 pt-3 text-xs">
                          {item.requiresApproval && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2 py-0.5 font-medium text-[#92400E]">
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Needs approval
                            </span>
                          )}
                          {item.fulfillmentHours ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2 py-0.5 font-medium text-[#334155]">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Usually within {formatHours(item.fulfillmentHours)}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
