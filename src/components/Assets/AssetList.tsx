import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Grid3X3,
  List,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';
import { useAssets } from '../../hooks/useAssets';
import { useAuthStore } from '../../stores/authStore';

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

// ── Helpers ──

const typeIcons: Record<AssetType, React.ComponentType<{ className?: string }>> = {
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

const typeColors: Record<AssetType, string> = {
  SERVER: 'bg-[color:var(--argus-signal-dim)] text-signal border-[color:var(--argus-signal)]/25',
  KUBERNETES_CLUSTER: 'bg-violet-50 text-violet border-violet-200',
  DATABASE: 'bg-amber-50 text-amber border-amber-200',
  APPLICATION: 'bg-emerald-50 text-emerald border-emerald-200',
  NETWORK: 'bg-[color:var(--argus-signal-dim)] text-signal border-[color:var(--argus-signal)]/25',
  STORAGE: 'bg-amber-50 text-amber border-amber-200',
  CONTAINER: 'bg-violet-50 text-violet border-violet-200',
  VM: 'bg-[color:var(--argus-signal-dim)] text-signal border-[color:var(--argus-signal)]/25',
  LOAD_BALANCER: 'bg-red-50 text-crimson border-red-200',
};

const statusColors: Record<AssetStatus, string> = {
  LIVE: 'bg-emerald-50 text-emerald border-emerald-200',
  MAINTENANCE: 'bg-amber-50 text-amber border-amber-200',
  DECOMMISSIONED: 'bg-stone-100 text-stone-500 border-stone-200',
  PLANNED: 'bg-violet-50 text-violet border-violet-200',
};

const statusDotColors: Record<AssetStatus, string> = {
  LIVE: 'bg-emerald',
  MAINTENANCE: 'bg-amber',
  DECOMMISSIONED: 'bg-gray-500',
  PLANNED: 'bg-violet',
};

// ── Subcomponents ──

function TypeBadge({ type }: { type: AssetType }) {
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

function StatusBadge({ status }: { status: AssetStatus }) {
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

function MonitoringDot({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
        </span>
        <span className="text-[10px] text-emerald font-mono">Active</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-600" />
      </span>
      <span className="text-[10px] text-stone-400 font-mono">Disabled</span>
    </span>
  );
}

// ── Main Component ──

export default function AssetList() {
  const navigate = useNavigate();
  const organization = useAuthStore((s) => s.organization);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'ALL'>('ALL');
  const [monitoringFilter, setMonitoringFilter] = useState<'ALL' | 'ON' | 'OFF'>('ALL');

  // Build filters for backend query
  const queryFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (typeFilter !== 'ALL') f.type = typeFilter;
    if (statusFilter !== 'ALL') f.status = statusFilter;
    if (monitoringFilter !== 'ALL') f.monitoringEnabled = monitoringFilter === 'ON' ? 'true' : 'false';
    if (searchQuery.trim()) f.search = searchQuery.trim();
    return f;
  }, [typeFilter, statusFilter, monitoringFilter, searchQuery]);

  // API hook
  const { data: assetsResponse, isLoading } = useAssets(queryFilters);

  // Extract assets array from backend response shape: { success, data, pagination }
  const assets: Asset[] = assetsResponse?.data ?? [];

  // Total count from pagination if available, otherwise use current array length
  const totalCount = assetsResponse?.pagination?.total ?? assets.length;

  const handleNavigate = (id: string) => {
    navigate(`/assets/${id}`);
  };

  return (
    <div className="animate-fade-in space-y-0">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-obsidian text-ink border border-[color:var(--argus-border)]">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-[color:var(--argus-elevated)] flex items-center justify-center">
                  <Server size={16} className="text-emerald-400" />
                </div>
                <h1 className="font-display text-2xl font-bold text-ink tracking-tight">Assets / CMDB</h1>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase bg-violet-500/20 text-violet-400 border border-violet-500/30">
                  {organization?.environment || 'DEV'}
                </span>
                <span className="text-[10px] font-mono text-signal bg-[color:var(--argus-signal-dim)]/10 px-2 py-0.5 rounded border border-indigo-500/20">{assets.length} shown</span>
              </div>
              <div className="flex items-center gap-2 text-sm ml-[42px]">
                <span className="text-slate-400">Configuration Management Database &middot; <span className="font-mono text-slate-300">{totalCount}</span> items</span>
                <span className="text-slate-600">|</span>
                <a href={window.location.origin} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-signal hover:text-signal transition-colors">
                  {window.location.host}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/assets/create')} className="flex items-center gap-2 px-4 py-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                <Server size={15} /> New Asset
              </button>
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[color:var(--argus-elevated)] border border-[color:var(--argus-border)]">
                <button onClick={() => setViewMode('grid')} className={clsx('p-2 rounded-md transition-all duration-200', viewMode === 'grid' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-ink')} title="Grid view">
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('list')} className={clsx('p-2 rounded-md transition-all duration-200', viewMode === 'list' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-ink')} title="List view">
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

      {/* ── FILTER BAR ── */}
      <div className="-mt-3 relative z-10 bg-white/90 backdrop-blur-xl rounded-xl border border-stone-200 shadow-sm p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-stone-400">
            <Filter size={13} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">Filters</span>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AssetType | 'ALL')}
            className={`filter-select ${typeFilter !== 'ALL' ? 'filter-select--active' : ''}`}
          >
            <option value="ALL">All Types</option>
            <option value="SERVER">Server</option>
            <option value="KUBERNETES_CLUSTER">Kubernetes Cluster</option>
            <option value="DATABASE">Database</option>
            <option value="APPLICATION">Application</option>
            <option value="NETWORK">Network</option>
            <option value="STORAGE">Storage</option>
            <option value="CONTAINER">Container</option>
            <option value="VM">VM</option>
            <option value="LOAD_BALANCER">Load Balancer</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AssetStatus | 'ALL')}
            className={`filter-select ${statusFilter !== 'ALL' ? 'filter-select--active' : ''}`}
          >
            <option value="ALL">All Statuses</option>
            <option value="LIVE">Live</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="DECOMMISSIONED">Decommissioned</option>
            <option value="PLANNED">Planned</option>
          </select>

          <select
            value={monitoringFilter}
            onChange={(e) => setMonitoringFilter(e.target.value as 'ALL' | 'ON' | 'OFF')}
            className={`filter-select ${monitoringFilter !== 'ALL' ? 'filter-select--active' : ''}`}
          >
            <option value="ALL">All Monitoring</option>
            <option value="ON">Monitoring On</option>
            <option value="OFF">Monitoring Off</option>
          </select>

          <div className="w-px h-7 bg-stone-200/60 hidden sm:block" />

          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name, IP, datacenter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-stone-50/80 border border-stone-200/80 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-8 h-8 text-signal mx-auto mb-3 animate-spin" />
          <p className="text-stone-500 font-medium">Loading assets...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && assets.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Server className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">No assets match your filters</p>
          <p className="text-stone-300 text-sm mt-1">Adjust filters or search criteria</p>
        </div>
      )}

      {/* Grid View */}
      {!isLoading && viewMode === 'grid' && assets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assets.map((asset) => {
            const Icon = typeIcons[asset.type] || Server;
            return (
              <div
                key={asset.id}
                onClick={() => handleNavigate(asset.id)}
                className="glass-card-hover p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={clsx(
                        'p-2.5 rounded-xl',
                        typeColors[asset.type]?.split(' ')[0]
                      )}
                    >
                      <Icon
                        className={clsx(
                          'w-5 h-5',
                          typeColors[asset.type]?.split(' ')[1]
                        )}
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-display font-bold text-stone-900 group-hover:text-signal transition-colors">
                        {asset.name}
                      </h3>
                      <p className="text-[11px] text-stone-400 font-mono mt-0.5">{asset.id}</p>
                    </div>
                  </div>
                  <MonitoringDot enabled={asset.monitoringEnabled} />
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <TypeBadge type={asset.type} />
                  <StatusBadge status={asset.status} />
                </div>

                <div className="space-y-1.5 text-xs text-stone-500">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-300">IP</span>
                    <span className="font-mono">{asset.ipAddress}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-300">Location</span>
                    <span className="font-mono">{asset.location}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-300">Datacenter</span>
                    <span className="font-mono">{asset.datacenter}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {!isLoading && viewMode === 'list' && assets.length > 0 && (
        <div className="glass-card overflow-hidden border-stone-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left text-[10px] font-mono font-medium text-stone-400 uppercase tracking-wider px-4 py-3">
                    Name
                  </th>
                  <th className="text-left text-[10px] font-mono font-medium text-stone-400 uppercase tracking-wider px-4 py-3">
                    Type
                  </th>
                  <th className="text-left text-[10px] font-mono font-medium text-stone-400 uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-[10px] font-mono font-medium text-stone-400 uppercase tracking-wider px-4 py-3">
                    IP
                  </th>
                  <th className="text-left text-[10px] font-mono font-medium text-stone-400 uppercase tracking-wider px-4 py-3">
                    Location
                  </th>
                  <th className="text-left text-[10px] font-mono font-medium text-stone-400 uppercase tracking-wider px-4 py-3">
                    Monitoring
                  </th>
                  <th className="text-left text-[10px] font-mono font-medium text-stone-400 uppercase tracking-wider px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {assets.map((asset) => {
                  const Icon = typeIcons[asset.type] || Server;
                  return (
                    <tr
                      key={asset.id}
                      className="hover:bg-stone-50 transition-colors cursor-pointer"
                      onClick={() => handleNavigate(asset.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={clsx('w-4 h-4', typeColors[asset.type]?.split(' ')[1])}
                          />
                          <div>
                            <p className="text-sm font-medium text-stone-900">{asset.name}</p>
                            <p className="text-[10px] text-stone-300 font-mono">{asset.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={asset.type} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={asset.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-stone-500">{asset.ipAddress}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-xs text-stone-500">{asset.location}</span>
                          <p className="text-[10px] text-stone-300">{asset.datacenter}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <MonitoringDot enabled={asset.monitoringEnabled} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigate(asset.id);
                          }}
                          className="btn-ghost px-2.5 py-1 text-xs"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
