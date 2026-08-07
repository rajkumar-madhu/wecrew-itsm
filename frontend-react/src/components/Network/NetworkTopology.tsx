import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  ListTree,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAssets } from '../../hooks/useAssets';

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

const typeIcons: Record<CIType, React.ComponentType<{ className?: string }>> = {
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

const typeColors: Record<CIType, string> = {
  SERVER: 'bg-indigo-50 text-signal border-indigo-200',
  KUBERNETES_CLUSTER: 'bg-violet-50 text-violet border-violet-200',
  DATABASE: 'bg-amber-50 text-amber border-amber-200',
  APPLICATION: 'bg-emerald-50 text-emerald border-emerald-200',
  NETWORK: 'bg-sky-50 text-sky-600 border-sky-200',
  STORAGE: 'bg-orange-50 text-orange-600 border-orange-200',
  CONTAINER: 'bg-purple-50 text-purple-600 border-purple-200',
  VM: 'bg-indigo-50 text-signal border-indigo-200',
  LOAD_BALANCER: 'bg-rose-50 text-rose-600 border-rose-200',
};

const typeIconBg: Record<CIType, string> = {
  SERVER: 'bg-indigo-100',
  KUBERNETES_CLUSTER: 'bg-violet-100',
  DATABASE: 'bg-amber-100',
  APPLICATION: 'bg-emerald-100',
  NETWORK: 'bg-sky-100',
  STORAGE: 'bg-orange-100',
  CONTAINER: 'bg-purple-100',
  VM: 'bg-indigo-100',
  LOAD_BALANCER: 'bg-rose-100',
};

const statusColors: Record<CIStatus, string> = {
  LIVE: 'bg-emerald-50 text-emerald border-emerald-200',
  MAINTENANCE: 'bg-amber-50 text-amber border-amber-200',
  DECOMMISSIONED: 'bg-stone-100 text-stone-400 border-stone-200',
  PLANNED: 'bg-indigo-50 text-signal border-indigo-200',
};

const statusDotColors: Record<CIStatus, string> = {
  LIVE: 'bg-emerald',
  MAINTENANCE: 'bg-amber',
  DECOMMISSIONED: 'bg-stone-400',
  PLANNED: 'bg-signal',
};

// -- Subcomponents --

function StatusBadge({ status }: { status: CIStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-medium rounded-md border',
        statusColors[status]
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', statusDotColors[status])} />
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: CIType }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md border',
        typeColors[type]
      )}
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
        <span className="relative inline-flex rounded-full h-2 w-2 bg-stone-400" />
      </span>
      <span className="text-[10px] text-stone-400 font-mono">Unmonitored</span>
    </span>
  );
}

function TreeNode({ ci, onClick }: { ci: ConfigItem; onClick: () => void }) {
  const Icon = typeIcons[ci.type] || Server;
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 cursor-pointer transition-colors rounded-lg group"
    >
      <div className="w-6 h-6 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full border-2 border-stone-300" />
      </div>
      <div className={clsx('p-1.5 rounded-lg', typeIconBg[ci.type])}>
        <Icon className={clsx('w-3.5 h-3.5', typeColors[ci.type].split(' ')[1])} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-900 group-hover:text-signal transition-colors truncate">
          {ci.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {ci.hostname && (
            <span className="text-[10px] text-stone-400 font-mono truncate">{ci.hostname}</span>
          )}
          {ci.ipAddress && (
            <span className="text-[10px] text-stone-400 font-mono">{ci.ipAddress}</span>
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

  return (
    <div className="glass-card border-stone-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-stone-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-stone-400" />
        )}
        <div className={clsx('p-2 rounded-xl', typeIconBg[type])}>
          <Icon className={clsx('w-5 h-5', typeColors[type].split(' ')[1])} />
        </div>
        <div className="flex-1 text-left">
          <span className="text-sm font-display font-bold text-stone-900">
            {typeLabels[type]}
          </span>
        </div>
        <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-stone-100 border border-stone-200 text-xs font-mono font-medium text-stone-600">
          {items.length}
        </span>
      </button>
      {expanded && items.length > 0 && (
        <div className="border-t border-stone-100 px-2 py-1">
          {items.map((ci) => (
            <TreeNode key={ci.id} ci={ci} onClick={() => onClickItem(ci.id)} />
          ))}
        </div>
      )}
      {expanded && items.length === 0 && (
        <div className="border-t border-stone-100 px-5 py-4 text-center">
          <p className="text-xs text-stone-400">No configuration items in this category</p>
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
  return (
    <div
      onClick={onClick}
      className="glass-card-hover p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={clsx('p-2.5 rounded-xl', typeIconBg[ci.type])}>
            <Icon className={clsx('w-5 h-5', typeColors[ci.type].split(' ')[1])} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-display font-bold text-stone-900 group-hover:text-signal transition-colors truncate">
              {ci.name}
            </h3>
            {ci.hostname && (
              <p className="text-[11px] text-stone-400 font-mono mt-0.5 truncate">
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

      <div className="space-y-1.5 text-xs text-stone-500">
        <div className="flex items-center justify-between">
          <span className="text-stone-300">IP</span>
          <span className="font-mono">{ci.ipAddress ?? '--'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-300">Location</span>
          <span className="font-mono">{ci.location ?? '--'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-300">Data Center</span>
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className={clsx('p-2 rounded-xl', typeIconBg[type])}>
          <Icon className={clsx('w-5 h-5', typeColors[type].split(' ')[1])} />
        </div>
        <h2 className="text-base font-display font-bold text-stone-900">{typeLabels[type]}</h2>
        <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-stone-100 border border-stone-200 text-xs font-mono font-medium text-stone-600">
          {items.length}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((ci) => (
            <GridCard key={ci.id} ci={ci} onClick={() => onClickItem(ci.id)} />
          ))}
        </div>
      ) : (
        <div className="glass-card p-6 text-center">
          <p className="text-xs text-stone-400">No configuration items</p>
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
  const { data: assetsResponse, isLoading, isError, error } = useAssets(queryFilters);

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

  const handleNavigate = (id: string) => {
    navigate(`/assets/${id}`);
  };

  return (
    <div className="animate-fade-in space-y-0">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0F172A] mb-5">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <Network size={16} className="text-sky-400" />
                </div>
                <h1 className="font-display text-2xl font-bold text-white tracking-tight">Network Topology</h1>
              </div>
              <p className="text-[#94A3B8] text-sm ml-[42px]">
                CMDB Configuration Items &middot; <span className="font-mono text-[#CBD5E1]">{totalCount}</span> total CIs
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
                  <Wifi className="w-3 h-3" />
                  {statusCounts.LIVE} Live
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-400">
                  <WifiOff className="w-3 h-3" />
                  {statusCounts.MAINTENANCE} Maint.
                </span>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                <button onClick={() => setViewMode('tree')} className={clsx('p-2 rounded-md transition-all duration-200', viewMode === 'tree' ? 'bg-sky-500/20 text-sky-400' : 'text-[#94A3B8] hover:text-white')} title="Tree view">
                  <ListTree className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('grid')} className={clsx('p-2 rounded-md transition-all duration-200', viewMode === 'grid' ? 'bg-sky-500/20 text-sky-400' : 'text-[#94A3B8] hover:text-white')} title="Grid view">
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-sky-500/60 to-transparent -mt-5 mb-4" />

      {/* Filter Bar */}
      <div className="glass-card p-4 border-stone-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-stone-500">
            <Filter className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Filters</span>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as CIType | 'ALL')}
            className="input-field text-sm py-1.5 px-3 min-w-[170px]"
          >
            <option value="ALL">All Types</option>
            {CI_TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CIStatus | 'ALL')}
            className="input-field text-sm py-1.5 px-3 min-w-[170px]"
          >
            <option value="ALL">All Statuses</option>
            {CI_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name, IP, hostname..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field text-sm py-1.5 pl-9 pr-3 w-full"
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-8 h-8 text-signal mx-auto mb-3 animate-spin" />
          <p className="text-stone-500 font-medium">Loading network topology...</p>
          <p className="text-stone-300 text-sm mt-1">Fetching configuration items from CMDB</p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && isError && (
        <div className="glass-card p-12 text-center">
          <AlertTriangle className="w-8 h-8 text-amber mx-auto mb-3" />
          <p className="text-stone-500 font-medium">Failed to load network topology</p>
          <p className="text-stone-300 text-sm mt-1">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary mt-4 text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && assets.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Network className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">No configuration items found</p>
          <p className="text-stone-300 text-sm mt-1">
            {searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Adjust filters or search criteria to see results'
              : 'Add assets to the CMDB to populate the network topology'}
          </p>
        </div>
      )}

      {/* Tree View */}
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

      {/* Grid View */}
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
    </div>
  );
}
