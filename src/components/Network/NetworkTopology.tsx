import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Server,
  Database,
  Globe,
  Network,
  HardDrive,
  Container,
  Monitor,
  Box,
  GitBranch,
  Search,
  Filter,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  ListTree,
  type LucideIcon,
} from 'lucide-react';
import { useAssets } from '../../hooks/useAssets';
import { Page, Toolbar, Segmented } from '../ui/PageChrome';

// -- Types --

type CIType =
  | 'SERVER'
  | 'KUBERNETES_CLUSTER'
  | 'DATABASE'
  | 'APPLICATION'
  | 'NETWORK'
  | 'STORAGE'
  | 'CONTAINER'
  | 'VM'
  | 'LOAD_BALANCER';

type CIStatus = 'LIVE' | 'MAINTENANCE' | 'DECOMMISSIONED' | 'PLANNED';

interface HeroKpi { label: string; value: number; sub: string; tone?: string }

interface ConfigItem {
  id: string;
  name: string;
  type: CIType;
  status: CIStatus;
  ipAddress: string | null;
  hostname: string | null;
  location: string | null;
  dataCenter: string | null;
  monitoringEnabled: boolean;
  description: string | null;
}

// -- Constants --

const CI_TYPES: CIType[] = [
  'SERVER',
  'KUBERNETES_CLUSTER',
  'DATABASE',
  'APPLICATION',
  'NETWORK',
  'STORAGE',
  'CONTAINER',
  'VM',
  'LOAD_BALANCER',
];

const CI_STATUSES: CIStatus[] = ['LIVE', 'MAINTENANCE', 'DECOMMISSIONED', 'PLANNED'];

const typeIcons: Record<CIType, LucideIcon> = {
  SERVER: Server,
  KUBERNETES_CLUSTER: Container,
  DATABASE: Database,
  APPLICATION: Globe,
  NETWORK: Network,
  STORAGE: HardDrive,
  CONTAINER: Box,
  VM: Monitor,
  LOAD_BALANCER: GitBranch,
};

const typeLabels: Record<CIType, string> = {
  SERVER: 'Servers',
  KUBERNETES_CLUSTER: 'Kubernetes Clusters',
  DATABASE: 'Databases',
  APPLICATION: 'Applications',
  NETWORK: 'Network Devices',
  STORAGE: 'Storage',
  CONTAINER: 'Containers',
  VM: 'Virtual Machines',
  LOAD_BALANCER: 'Load Balancers',
};

const TYPE_TONE: Record<CIType, { bg: string; fg: string }> = {
  SERVER: { bg: 'var(--argus-signal-dim)', fg: 'var(--argus-signal)' },
  KUBERNETES_CLUSTER: { bg: 'var(--argus-violet-dim)', fg: 'var(--argus-violet)' },
  DATABASE: { bg: 'var(--argus-amber-dim)', fg: 'var(--argus-amber)' },
  APPLICATION: { bg: 'var(--argus-emerald-dim)', fg: 'var(--argus-emerald)' },
  NETWORK: { bg: 'var(--argus-signal-dim)', fg: 'var(--argus-signal)' },
  STORAGE: { bg: 'var(--argus-amber-dim)', fg: 'var(--argus-amber)' },
  CONTAINER: { bg: 'var(--argus-violet-dim)', fg: 'var(--argus-violet)' },
  VM: { bg: 'var(--argus-signal-dim)', fg: 'var(--argus-signal)' },
  LOAD_BALANCER: { bg: 'var(--argus-crimson-dim)', fg: 'var(--argus-crimson)' },
};

const STATUS_TONE: Record<CIStatus, 'ok' | 'warn' | 'neutral' | 'alert'> = {
  LIVE: 'ok',
  MAINTENANCE: 'warn',
  DECOMMISSIONED: 'neutral',
  PLANNED: 'alert',
};

// -- Subcomponents --

function StatusBadge({ status }: { status: CIStatus }) {
  return (
    <span className={clsx('cx-pill', `cx-pill--${STATUS_TONE[status]}`)}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: CIType }) {
  const tone = TYPE_TONE[type];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {type.replace(/_/g, ' ')}
    </span>
  );
}

function HealthIndicator({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
        </span>
        <span className="text-[10px] text-emerald font-mono">Monitored</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-graphite" />
      </span>
      <span className="text-[10px] text-dim font-mono">Unmonitored</span>
    </span>
  );
}

function TreeNode({ ci, onClick }: { ci: ConfigItem; onClick: () => void }) {
  const Icon = typeIcons[ci.type] || Server;
  const tone = TYPE_TONE[ci.type];
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate cursor-pointer transition-colors rounded-lg group"
    >
      <div className="w-6 h-6 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full border-2 border-steel" />
      </div>
      <div className="p-1.5 rounded-lg" style={{ background: tone.bg }}>
        <Icon className="w-3.5 h-3.5" style={{ color: tone.fg }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink group-hover:text-signal transition-colors truncate">
          {ci.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {ci.hostname && (
            <span className="text-[10px] text-dim font-mono truncate">{ci.hostname}</span>
          )}
          {ci.ipAddress && (
            <span className="text-[10px] text-dim font-mono">{ci.ipAddress}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <HealthIndicator enabled={ci.monitoringEnabled} />
        <StatusBadge status={ci.status} />
      </div>
    </div>
  );
}

function TreeGroup({
  type,
  items,
  onClickItem,
}: {
  type: CIType;
  items: ConfigItem[];
  onClickItem: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const Icon = typeIcons[type] || Server;
  const tone = TYPE_TONE[type];

  return (
    <div className="bg-obsidian border border-steel overflow-hidden rounded">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-dim" />
        ) : (
          <ChevronRight className="w-4 h-4 text-dim" />
        )}
        <div className="p-2 rounded-lg" style={{ background: tone.bg }}>
          <Icon className="w-5 h-5" style={{ color: tone.fg }} />
        </div>
        <div className="flex-1 text-left">
          <span className="text-sm font-display font-bold text-ink">
            {typeLabels[type]}
          </span>
        </div>
        <span className="cx-pill cx-pill--neutral">{items.length}</span>
      </button>
      {expanded && items.length > 0 && (
        <div className="px-2 py-1" style={{ borderTop: '1px solid var(--argus-border)' }}>
          {items.map((ci) => (
            <TreeNode key={ci.id} ci={ci} onClick={() => onClickItem(ci.id)} />
          ))}
        </div>
      )}
      {expanded && items.length === 0 && (
        <div className="px-5 py-4 text-center" style={{ borderTop: '1px solid var(--argus-border)' }}>
          <p className="text-xs text-dim">No configuration items in this category</p>
        </div>
      )}
    </div>
  );
}

function GridCard({
  ci,
  onClick,
}: {
  ci: ConfigItem;
  onClick: () => void;
}) {
  const Icon = typeIcons[ci.type] || Server;
  const tone = TYPE_TONE[ci.type];
  return (
    <div
      onClick={onClick}
      className="p-5 cursor-pointer transition-colors group bg-obsidian border border-steel rounded"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg" style={{ background: tone.bg }}>
            <Icon className="w-5 h-5" style={{ color: tone.fg }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-display font-bold text-ink group-hover:text-signal transition-colors truncate">
              {ci.name}
            </h3>
            {ci.hostname && (
              <p className="text-[11px] text-dim font-mono mt-0.5 truncate">
                {ci.hostname}
              </p>
            )}
          </div>
        </div>
        <HealthIndicator enabled={ci.monitoringEnabled} />
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <TypeBadge type={ci.type} />
        <StatusBadge status={ci.status} />
      </div>

      <div className="space-y-1.5 text-xs text-muted">
        <div className="flex items-center justify-between">
          <span className="text-dim">IP</span>
          <span className="font-mono">{ci.ipAddress ?? '--'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dim">Location</span>
          <span className="font-mono">{ci.location ?? '--'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dim">Data Center</span>
          <span className="font-mono">{ci.dataCenter ?? '--'}</span>
        </div>
      </div>
    </div>
  );
}

function GridGroup({
  type,
  items,
  onClickItem,
}: {
  type: CIType;
  items: ConfigItem[];
  onClickItem: (id: string) => void;
}) {
  const Icon = typeIcons[type] || Server;
  const tone = TYPE_TONE[type];

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg" style={{ background: tone.bg }}>
          <Icon className="w-5 h-5" style={{ color: tone.fg }} />
        </div>
        <h2 className="text-base font-display font-bold text-ink">{typeLabels[type]}</h2>
        <span className="cx-pill cx-pill--neutral">{items.length}</span>
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((ci) => (
            <GridCard key={ci.id} ci={ci} onClick={() => onClickItem(ci.id)} />
          ))}
        </div>
      ) : (
        <div className="bg-obsidian border border-steel p-6 text-center rounded">
          <p className="text-xs text-dim">No configuration items</p>
        </div>
      )}
    </div>
  );
}

// -- Main Component --

export default function NetworkTopology() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<CIType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<CIStatus | 'ALL'>('ALL');

  // Build query filters for the API — fetch up to 100 to show all CIs in topology
  const queryFilters = useMemo(() => {
    const f: Record<string, string> = { limit: '100' };
    if (typeFilter !== 'ALL') f.type = typeFilter;
    if (statusFilter !== 'ALL') f.status = statusFilter;
    if (searchQuery.trim()) f.search = searchQuery.trim();
    return f;
  }, [typeFilter, statusFilter, searchQuery]);

  // Fetch assets via TanStack Query
  const { data: assetsResponse, isLoading, isError, error, refetch, isFetching } = useAssets(queryFilters);

  // Extract assets from API response shape: { success, data, pagination }
  const assets: ConfigItem[] = assetsResponse?.data ?? [];
  const totalCount: number = assetsResponse?.pagination?.total ?? assets.length;

  // Group CIs by type
  const groupedAssets = useMemo(() => {
    const groups: Record<CIType, ConfigItem[]> = {
      SERVER: [],
      KUBERNETES_CLUSTER: [],
      DATABASE: [],
      APPLICATION: [],
      NETWORK: [],
      STORAGE: [],
      CONTAINER: [],
      VM: [],
      LOAD_BALANCER: [],
    };

    assets.forEach((ci) => {
      if (groups[ci.type]) {
        groups[ci.type].push(ci);
      }
    });

    return groups;
  }, [assets]);

  // Filter type groups to only show the selected type, or all
  const visibleTypes = useMemo(() => {
    if (typeFilter !== 'ALL') {
      return CI_TYPES.filter((t) => t === typeFilter);
    }
    return CI_TYPES;
  }, [typeFilter]);

  // Status summary counts
  const statusCounts = useMemo(() => {
    const counts: Record<CIStatus, number> = {
      LIVE: 0,
      MAINTENANCE: 0,
      DECOMMISSIONED: 0,
      PLANNED: 0,
    };
    assets.forEach((ci) => {
      if (counts[ci.status] !== undefined) {
        counts[ci.status]++;
      }
    });
    return counts;
  }, [assets]);

  // Hoisted out of JSX: an inline array literal created during render aliases
  // statusCounts, which makes React Compiler treat it as possibly-mutated and
  // skip optimizing this whole component.
  const heroKpis = useMemo<HeroKpi[]>(
    () => [
      { label: 'Items', value: totalCount, sub: 'in this view' },
      { label: 'Live', value: statusCounts.LIVE, sub: 'serving traffic' },
      { label: 'Maintenance', value: statusCounts.MAINTENANCE, sub: 'alerts suppressed', tone: statusCounts.MAINTENANCE > 0 ? 'warn' : undefined },
      { label: 'Planned', value: statusCounts.PLANNED, sub: 'not yet live' },
      { label: 'Decommissioned', value: statusCounts.DECOMMISSIONED, sub: 'retired' },
    ],
    [totalCount, statusCounts]
  );

  const handleNavigate = (id: string) => {
    navigate(`/assets/${id}`);
  };

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Operate · topology</span>
            <h1 className="cx-hero__title">Network</h1>
            <p className="cx-hero__deck">
              Configuration items from the CMDB, grouped by type. Open a node to reach the asset record.
            </p>
          </div>
          <Segmented
            options={[
              { value: 'tree', label: 'Tree', icon: ListTree },
              { value: 'grid', label: 'Grid', icon: LayoutGrid },
            ]}
            value={viewMode}
            onChange={(v) => setViewMode(v as 'tree' | 'grid')}
          />
        </div>
        <dl className="cx-hero__kpis cx-hero__kpis--5 mt-6">
          {heroKpis.map((kpi) => (
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
        <span className="cx-crumb__current">Network</span>
      </nav>

      <Toolbar>
        <div className="flex items-center gap-1.5 text-muted">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-widest">Filters</span>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as CIType | 'ALL')}
          className={clsx('filter-select', typeFilter !== 'ALL' && 'filter-select--active')}
        >
          <option value="ALL">All types</option>
          {CI_TYPES.map((t) => (
            <option key={t} value={t}>{typeLabels[t]}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CIStatus | 'ALL')}
          className={clsx('filter-select', statusFilter !== 'ALL' && 'filter-select--active')}
        >
          <option value="ALL">All statuses</option>
          {CI_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dim" />
          <input
            type="text"
            placeholder="Search by name, IP, hostname..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-8 py-1.5 text-[13px]"
          />
        </div>
      </Toolbar>

      {isLoading && (
        <div className="bg-obsidian border border-steel p-12 text-center rounded">
          <Loader2 className="w-8 h-8 text-signal mx-auto mb-3 animate-spin" />
          <p className="text-muted font-medium">Loading network topology…</p>
          <p className="text-dim text-sm mt-1">Fetching configuration items from CMDB</p>
        </div>
      )}

      {!isLoading && isError && (
        <div className="bg-obsidian border border-steel p-12 text-center rounded">
          <AlertTriangle className="w-8 h-8 text-amber mx-auto mb-3" />
          <p className="text-muted font-medium">Failed to load network topology</p>
          <p className="text-dim text-sm mt-1">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          {/* Without this the only way out of a transient failure is a browser
              reload: the query will not refetch on its own while this component
              stays mounted. Refetching beats reloading the whole app. */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="cx-btn cx-btn--ghost mt-4"
          >
            {isFetching ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Retrying…</>
            ) : (
              <><RefreshCw className="w-3.5 h-3.5" /> Retry</>
            )}
          </button>
        </div>
      )}

      {!isLoading && !isError && assets.length === 0 && (
        <div className="bg-obsidian border border-steel p-12 text-center rounded">
          <Network className="w-12 h-12 text-graphite mx-auto mb-3" />
          <p className="text-muted font-medium">No configuration items found</p>
          <p className="text-dim text-sm mt-1">
            {searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Adjust filters or search criteria to see results'
              : 'Add assets to the CMDB to populate the network topology'}
          </p>
        </div>
      )}

      {!isLoading && !isError && viewMode === 'tree' && assets.length > 0 && (
        <div className="space-y-3">
          {visibleTypes.map((type) => (
            <TreeGroup
              key={type}
              type={type}
              items={groupedAssets[type]}
              onClickItem={handleNavigate}
            />
          ))}
        </div>
      )}

      {!isLoading && !isError && viewMode === 'grid' && assets.length > 0 && (
        <div className="space-y-8">
          {visibleTypes.map((type) => {
            const items = groupedAssets[type];
            if (typeFilter === 'ALL' && items.length === 0) return null;
            return (
              <GridGroup
                key={type}
                type={type}
                items={items}
                onClickItem={handleNavigate}
              />
            );
          })}
        </div>
      )}
    </Page>
  );
}
