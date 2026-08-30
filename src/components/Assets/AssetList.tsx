import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Server,
  Database,
  Globe,
  Cpu,
  HardDrive,
  Network,
  Container,
  Monitor,
  Search,
  Plus,
  X,
  EyeOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAssets } from '../../hooks/useAssets';
import { useAuthStore } from '../../stores/authStore';
import { Page, Toolbar } from '../ui/PageChrome';

// ── Types ──

type AssetType =
  | 'SERVER'
  | 'KUBERNETES_CLUSTER'
  | 'DATABASE'
  | 'APPLICATION'
  | 'NETWORK'
  | 'STORAGE'
  | 'CONTAINER'
  | 'VM'
  | 'LOAD_BALANCER';

type AssetStatus = 'LIVE' | 'MAINTENANCE' | 'DECOMMISSIONED' | 'PLANNED';

interface Asset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  ipAddress: string;
  location: string;
  datacenter: string;
  monitoringEnabled: boolean;
  description: string;
}

// ── Vocabulary ──

const TYPE_ORDER: AssetType[] = [
  'SERVER',
  'KUBERNETES_CLUSTER',
  'CONTAINER',
  'VM',
  'DATABASE',
  'APPLICATION',
  'NETWORK',
  'LOAD_BALANCER',
  'STORAGE',
];

const typeIcons: Record<AssetType, LucideIcon> = {
  SERVER: Server,
  KUBERNETES_CLUSTER: Container,
  DATABASE: Database,
  APPLICATION: Globe,
  NETWORK: Network,
  STORAGE: HardDrive,
  CONTAINER: Container,
  VM: Monitor,
  LOAD_BALANCER: Cpu,
};

const typeLabel: Record<AssetType, string> = {
  SERVER: 'Servers',
  KUBERNETES_CLUSTER: 'Clusters',
  DATABASE: 'Databases',
  APPLICATION: 'Applications',
  NETWORK: 'Network',
  STORAGE: 'Storage',
  CONTAINER: 'Containers',
  VM: 'Virtual machines',
  LOAD_BALANCER: 'Load balancers',
};

const statusLabel: Record<AssetStatus, string> = {
  LIVE: 'Live',
  MAINTENANCE: 'Maintenance',
  DECOMMISSIONED: 'Retired',
  PLANNED: 'Planned',
};

const statusTone: Record<AssetStatus, 'ok' | 'warn' | 'neutral' | 'alert'> = {
  LIVE: 'ok',
  MAINTENANCE: 'warn',
  DECOMMISSIONED: 'neutral',
  PLANNED: 'alert',
};

function StatusBadge({ status }: { status: AssetStatus }) {
  return <span className={clsx('cx-pill', `cx-pill--${statusTone[status]}`)}>{statusLabel[status]}</span>;
}

// ── Estate map ──

/**
 * A census of the estate: one cell per configuration item, banded by type.
 * Status is the fill, monitoring is the outline — an unmonitored CI raises no
 * alerts and appears on no dashboard, so its absence from the rest of the
 * product is the one thing this view has to make visible.
 */
function EstateMap({
  assets,
  loading,
  onSelect,
}: {
  assets: Asset[];
  loading?: boolean;
  onSelect: (id: string) => void;
}) {
  const bands = useMemo(() => {
    const grouped = new Map<AssetType, Asset[]>();
    for (const a of assets) {
      const list = grouped.get(a.type);
      if (list) list.push(a);
      else grouped.set(a.type, [a]);
    }
    return TYPE_ORDER.filter((t) => grouped.has(t)).map((type) => {
      const items = (grouped.get(type) || []).slice().sort((a, b) => a.name.localeCompare(b.name));
      return { type, items, blind: items.filter((a) => !a.monitoringEnabled).length };
    });
  }, [assets]);

  const blindTotal = assets.filter((a) => !a.monitoringEnabled).length;

  if (loading && assets.length === 0) {
    return (
      <div className="cx-estate">
        <div className="cx-estate__head">
          <span className="cx-listhead__count">
            <span className="cx-listhead__count-value">Reading the estate</span>
          </span>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="cx-estate__band animate-pulse">
            <span className="h-3 w-24 rounded bg-[color:var(--argus-elevated)]" />
            <span className="cx-estate__cells">
              {Array.from({ length: 12 + (i % 3) * 4 }).map((_, j) => (
                <span key={j} className="cx-estate__cell pointer-events-none opacity-40" />
              ))}
            </span>
            <span className="cx-estate__count">—</span>
          </div>
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="cx-estate">
        <div className="cx-estate__head">
          <span className="cx-listhead__count">
            <span className="cx-listhead__count-value">No configuration items yet</span>
            <span className="cx-listhead__count-meta">the map fills as the CMDB does</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="cx-estate">
      <div className="cx-estate__head">
        <span className="cx-listhead__count">
          <span className="cx-listhead__count-value">
            {assets.length} configuration item{assets.length === 1 ? '' : 's'}
          </span>
          <span className="cx-listhead__count-meta">across {bands.length} type{bands.length === 1 ? '' : 's'}</span>
        </span>
        <span className="cx-window__legend">
          <span className="cx-window__key"><span className="cx-estate__cell cx-estate__cell--live pointer-events-none" /> Live</span>
          <span className="cx-window__key"><span className="cx-estate__cell cx-estate__cell--maintenance pointer-events-none" /> Maintenance</span>
          <span className="cx-window__key"><span className="cx-estate__cell cx-estate__cell--planned pointer-events-none" /> Planned</span>
          <span className="cx-window__key"><span className="cx-estate__cell cx-estate__cell--decommissioned pointer-events-none" /> Retired</span>
          <span className="cx-window__key">
            <span className="cx-estate__cell cx-estate__cell--live cx-estate__cell--blind pointer-events-none" /> Unmonitored
          </span>
        </span>
      </div>

      {bands.map((band) => {
        const Icon = typeIcons[band.type] || Server;
        return (
          <div key={band.type} className="cx-estate__band">
            <span className="cx-estate__type">
              <Icon size={13} strokeWidth={1.75} className="text-graphite shrink-0" />
              <span className="truncate">{typeLabel[band.type]}</span>
            </span>

            <span className="cx-estate__cells">
              {band.items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelect(a.id)}
                  title={`${a.name} · ${statusLabel[a.status]}${a.monitoringEnabled ? '' : ' · not monitored'}`}
                  aria-label={`${a.name}, ${statusLabel[a.status]}${a.monitoringEnabled ? '' : ', not monitored'}`}
                  className={clsx(
                    'cx-estate__cell',
                    `cx-estate__cell--${a.status.toLowerCase()}`,
                    !a.monitoringEnabled && 'cx-estate__cell--blind'
                  )}
                />
              ))}
            </span>

            <span className="cx-estate__count">
              {band.items.length}
              {band.blind > 0 && <span className="text-coral"> · {band.blind} unmonitored</span>}
            </span>
          </div>
        );
      })}

      {blindTotal > 0 && (
        <div className="cx-estate__band">
          <span className="cx-estate__type text-coral">
            <EyeOff size={13} strokeWidth={1.75} className="shrink-0" />
            Blind spots
          </span>
          <p className="text-[12px] text-muted md:col-span-2">
            {blindTotal} item{blindTotal === 1 ? ' has' : 's have'} monitoring switched off. Nothing here
            raises an alert, so an outage on {blindTotal === 1 ? 'it' : 'them'} reaches you by phone call
            rather than by page.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ──

export default function AssetList() {
  const navigate = useNavigate();
  const organization = useAuthStore((s) => s.organization);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | ''>('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | ''>('');
  const [monitoringFilter, setMonitoringFilter] = useState<'' | 'ON' | 'OFF'>('');

  const hasFilters = Boolean(searchQuery || typeFilter || statusFilter || monitoringFilter);

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('');
    setStatusFilter('');
    setMonitoringFilter('');
  };

  const queryFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (typeFilter) f.type = typeFilter;
    if (statusFilter) f.status = statusFilter;
    if (monitoringFilter) f.monitoringEnabled = monitoringFilter === 'ON' ? 'true' : 'false';
    if (searchQuery.trim()) f.search = searchQuery.trim();
    return f;
  }, [typeFilter, statusFilter, monitoringFilter, searchQuery]);

  const { data: assetsResponse, isLoading } = useAssets(queryFilters);

  // The estate map is a census of everything, not of the current filter — a map
  // that shrinks as you search stops being a map.
  const { data: estateResponse, isLoading: estateLoading } = useAssets({ limit: 500 });

  const assets: Asset[] = assetsResponse?.data ?? [];
  const totalCount = assetsResponse?.pagination?.total ?? assets.length;
  const estate: Asset[] = useMemo(() => estateResponse?.data ?? [], [estateResponse]);

  const stats = useMemo(() => {
    const live = estate.filter((a) => a.status === 'LIVE').length;
    const maintenance = estate.filter((a) => a.status === 'MAINTENANCE').length;
    const blind = estate.filter((a) => !a.monitoringEnabled).length;
    const sites = new Set(estate.map((a) => a.datacenter).filter(Boolean)).size;
    return { total: estate.length, live, maintenance, blind, sites };
  }, [estate]);

  const kpis = [
    { label: 'Items', value: stats.total, sub: 'under management' },
    { label: 'Live', value: stats.live, sub: 'serving traffic' },
    { label: 'Maintenance', value: stats.maintenance, sub: 'alerts suppressed', tone: stats.maintenance > 0 ? 'warn' : undefined },
    { label: 'Unmonitored', value: stats.blind, sub: 'raise no alerts', tone: stats.blind > 0 ? 'danger' : undefined },
    { label: 'Datacenters', value: stats.sites, sub: 'distinct sites' },
  ];

  return (
    <Page>
      {/* ── Hero ── */}
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Operate · configuration management</span>
            <h1 className="cx-hero__title">Assets</h1>
            <p className="cx-hero__deck">
              The configuration items this organisation runs, what state each one is in, and which of
              them monitoring cannot see. Incidents and alerts elsewhere in Argus attach to the records
              held here.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {organization?.environment && (
              <span className="cx-hero__btn cx-hero__btn--ghost pointer-events-none font-mono !text-[11px] uppercase tracking-widest">
                {organization.environment}
              </span>
            )}
            <button type="button" onClick={() => navigate('/assets/create')} className="cx-hero__btn">
              <Plus size={14} strokeWidth={1.75} />
              Add an item
            </button>
          </div>
        </div>

        <dl className="cx-hero__kpis cx-hero__kpis--5 mt-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className={clsx('cx-hero__kpi', kpi.tone && `cx-hero__kpi--${kpi.tone}`)}>
              <dt className="cx-hero__kpi-label">{kpi.label}</dt>
              <dd>
                <div className="cx-hero__kpi-value">{kpi.value}</div>
                <div className="cx-hero__kpi-sub">{kpi.sub}</div>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Assets</span>
      </nav>

      {/* ── Signature: the estate map ── */}
      <div className="cx-sectionhead">
        <div>
          <h2 className="cx-sectionhead__title">Estate map</h2>
          <p className="cx-sectionhead__deck">
            One square per item, banded by type. The fill is its state; a coral outline means monitoring
            is switched off. Select a square to open the item.
          </p>
        </div>
      </div>

      <EstateMap assets={estate} loading={estateLoading} onSelect={(id) => navigate(`/assets/${id}`)} />

      {/* ── Inventory ── */}
      <div className="cx-sectionhead">
        <div>
          <h2 className="cx-sectionhead__title">Inventory</h2>
          <p className="cx-sectionhead__deck">Every record, with its address and where it lives.</p>
        </div>
      </div>

      <Toolbar>
        <div className="cx-listhead__count">
          <span className="cx-listhead__count-value">
            {isLoading ? '—' : `${totalCount} item${totalCount === 1 ? '' : 's'}`}
          </span>
          <span className="cx-listhead__count-meta">
            {hasFilters ? 'filtered' : 'unfiltered'}
          </span>
        </div>

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, address or site..."
            className="input-field pl-8 py-1.5 text-[13px]"
          />
        </div>

        <div className="w-px h-5 bg-[color:var(--argus-border)] hidden sm:block" />

        <select
          aria-label="Filter by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AssetType | '')}
          className={clsx('filter-select', typeFilter && 'filter-select--active')}
        >
          <option value="">All types</option>
          {TYPE_ORDER.map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}
        </select>

        <select
          aria-label="Filter by state"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AssetStatus | '')}
          className={clsx('filter-select', statusFilter && 'filter-select--active')}
        >
          <option value="">All states</option>
          {(Object.keys(statusLabel) as AssetStatus[]).map((s) => (
            <option key={s} value={s}>{statusLabel[s]}</option>
          ))}
        </select>

        <select
          aria-label="Filter by monitoring"
          value={monitoringFilter}
          onChange={(e) => setMonitoringFilter(e.target.value as '' | 'ON' | 'OFF')}
          className={clsx('filter-select', monitoringFilter && 'filter-select--active')}
        >
          <option value="">Monitored or not</option>
          <option value="ON">Monitoring on</option>
          <option value="OFF">Monitoring off</option>
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 text-[11px] text-dim hover:text-coral transition-colors ml-auto"
          >
            <X size={11} />
            Clear filters
          </button>
        )}
      </Toolbar>

      <div className="cx-table-wrap">
        <div className="overflow-x-auto">
          <table className="cx-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>State</th>
                <th>Address</th>
                <th>Site</th>
                <th>Monitoring</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j}><div className="h-3.5 rounded bg-[color:var(--argus-elevated)] w-3/4" /></td>
                    ))}
                  </tr>
                ))
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <p className="text-sm text-ink font-medium">No items match these filters</p>
                    <p className="text-xs text-muted mt-1">
                      {hasFilters ? 'Clear the filters to see the whole estate.' : 'Add an item to start the CMDB.'}
                    </p>
                  </td>
                </tr>
              ) : (
                assets.map((asset) => {
                  const Icon = typeIcons[asset.type] || Server;
                  return (
                    <tr key={asset.id} onClick={() => navigate(`/assets/${asset.id}`)} className="cursor-pointer">
                      <td>
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon size={15} strokeWidth={1.75} className="text-graphite shrink-0" />
                          <span className="min-w-0">
                            <span className="block truncate text-ink font-medium">{asset.name}</span>
                            {asset.description && (
                              <span className="block truncate text-[11px] text-dim">{asset.description}</span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-[12px] text-muted">
                        {typeLabel[asset.type] || asset.type}
                      </td>
                      <td><StatusBadge status={asset.status} /></td>
                      <td className="font-mono text-[12px] text-muted whitespace-nowrap">{asset.ipAddress || '—'}</td>
                      <td className="whitespace-nowrap text-[12px] text-muted">
                        {asset.location || '—'}
                        {asset.datacenter && <span className="block text-[11px] text-dim">{asset.datacenter}</span>}
                      </td>
                      <td className="whitespace-nowrap">
                        {asset.monitoringEnabled ? (
                          <span className="text-[12px] text-muted">On</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-coral">
                            <EyeOff size={13} strokeWidth={1.75} />
                            Off
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
}
