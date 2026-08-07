import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowLeft,
  Server,
  Activity,
  Link2,
  ChevronRight,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Clock,
  MapPin,
  Shield,
  AlertTriangle,
  Loader2,
  Pencil,
  X,
  Save,
  Wifi,
  ArrowDownCircle,
  ArrowUpCircle,
  Info,
  RefreshCw,
  Zap,
  MonitorSpeaker,
  Database,
  Thermometer,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAsset, useUpdateAsset, useAssetLiveMetrics, useAssetMetricsHistory } from '../../hooks/useAssets';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

type AssetType = 'SERVER' | 'KUBERNETES_CLUSTER' | 'DATABASE' | 'APPLICATION' | 'NETWORK' | 'STORAGE' | 'CONTAINER' | 'VM' | 'LOAD_BALANCER';
type AssetStatus = 'LIVE' | 'MAINTENANCE' | 'DECOMMISSIONED' | 'PLANNED';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusClass: Record<AssetStatus, string> = {
  LIVE: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  MAINTENANCE: 'bg-amber-50 text-amber-600 border-amber-200',
  DECOMMISSIONED: 'bg-stone-100 text-stone-500 border-stone-200',
  PLANNED: 'bg-violet-50 text-violet-600 border-violet-200',
};

const typeClass: Record<AssetType, string> = {
  SERVER: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  KUBERNETES_CLUSTER: 'bg-violet-50 text-violet-600 border-violet-200',
  DATABASE: 'bg-amber-50 text-amber-600 border-amber-200',
  APPLICATION: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  NETWORK: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  STORAGE: 'bg-amber-50 text-amber-600 border-amber-200',
  CONTAINER: 'bg-violet-50 text-violet-600 border-violet-200',
  VM: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  LOAD_BALANCER: 'bg-red-50 text-red-600 border-red-200',
};

const liveStatusColors: Record<string, string> = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function UsageGauge({ label, value, icon: Icon, suffix = '%', subtext }: { label: string; value: number; icon: React.ElementType; suffix?: string; subtext?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct > 85 ? 'text-red-500' : pct > 70 ? 'text-amber-500' : 'text-emerald-500';
  const bgColor = pct > 85 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-stone-400" />
          <span className="text-xs text-stone-400 uppercase tracking-wider">{label}</span>
        </div>
        <span className={clsx('text-lg font-display font-bold', color)}>{value.toFixed(1)}{suffix}</span>
      </div>
      <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-700', bgColor)} style={{ width: `${pct}%` }} />
      </div>
      {subtext && <p className="text-[10px] text-stone-400 mt-1.5">{subtext}</p>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls = severity === 'critical' ? 'bg-red-100 text-red-700 border-red-200'
    : severity === 'warning' ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-blue-100 text-blue-700 border-blue-200';
  return <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', cls)}>{severity}</span>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ASSET_TYPES = ['SERVER', 'KUBERNETES_CLUSTER', 'DATABASE', 'APPLICATION', 'NETWORK', 'STORAGE', 'CONTAINER', 'VM', 'LOAD_BALANCER'];
const ASSET_STATUSES = ['LIVE', 'MAINTENANCE', 'DECOMMISSIONED', 'PLANNED'];

// ─── Edit Modal ─────────────────────────────────────────────────────────────

function EditAssetModal({ asset, onClose }: { asset: any; onClose: () => void }) {
  const updateAsset = useUpdateAsset();
  const [form, setForm] = useState({
    name: asset.name || '',
    type: asset.type || 'SERVER',
    status: asset.status || 'LIVE',
    hostname: asset.hostname || '',
    ipAddress: asset.ipAddress || '',
    os: asset.os || '',
    description: asset.description || '',
    location: asset.location || '',
  });

  const handleSave = async () => {
    try {
      const data: any = {};
      if (form.name !== (asset.name || '')) data.name = form.name;
      if (form.type !== asset.type) data.type = form.type;
      if (form.status !== asset.status) data.status = form.status;
      if (form.hostname !== (asset.hostname || '')) data.hostname = form.hostname;
      if (form.ipAddress !== (asset.ipAddress || '')) data.ipAddress = form.ipAddress;
      if (form.os !== (asset.os || '')) data.os = form.os;
      if (form.description !== (asset.description || '')) data.description = form.description;
      if (form.location !== (asset.location || '')) data.location = form.location;
      if (Object.keys(data).length === 0) { onClose(); return; }
      await updateAsset.mutateAsync({ id: asset.id, data });
      toast.success('Asset updated');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="glass-card w-full max-w-lg p-6 space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-900">Edit Asset</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-field">
                {ASSET_TYPES.map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field">
                {ASSET_STATUSES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Hostname</label>
              <input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">IP Address</label>
              <input value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">OS</label>
              <input value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field resize-y" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={updateAsset.isPending || !form.name.trim()} className="btn-primary flex items-center gap-1.5">
            {updateAsset.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── System Info Card ────────────────────────────────────────────────────────

function SystemInfoCard({ sysInfo, asset }: { sysInfo: any; asset: any }) {
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2">
        <MonitorSpeaker size={15} className="text-indigo-500" /> System Information
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          ['Hostname', sysInfo.hostname || asset.hostname || '-'],
          ['OS', `${sysInfo.os || '-'} ${sysInfo.architecture || ''}`],
          ['Kernel', sysInfo.kernel || '-'],
          ['Architecture', sysInfo.architecture || '-'],
          ['IP Address', asset.ipAddress || '-'],
          ['Uptime', sysInfo.uptimeSeconds ? formatUptime(sysInfo.uptimeSeconds) : '-'],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-stone-50 rounded-lg p-3">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-sm font-mono text-stone-800 truncate" title={value as string}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Network Interfaces Table ────────────────────────────────────────────────

function NetworkInterfacesCard({ interfaces }: { interfaces: any[] }) {
  if (!interfaces || interfaces.length === 0) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
          <Wifi size={15} className="text-blue-500" /> Network Interfaces
        </h3>
        <p className="text-xs text-stone-400 text-center py-4">No network interface data available</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2">
        <Wifi size={15} className="text-blue-500" /> Network Interfaces
        <span className="text-[10px] font-mono text-stone-400 ml-auto">{interfaces.length} interfaces</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-2 px-2 text-stone-400 font-medium uppercase tracking-wider">Interface</th>
              <th className="text-left py-2 px-2 text-stone-400 font-medium uppercase tracking-wider">State</th>
              <th className="text-left py-2 px-2 text-stone-400 font-medium uppercase tracking-wider">MAC</th>
              <th className="text-right py-2 px-2 text-emerald-500 font-medium uppercase tracking-wider">RX Rate</th>
              <th className="text-right py-2 px-2 text-blue-500 font-medium uppercase tracking-wider">TX Rate</th>
              <th className="text-right py-2 px-2 text-stone-400 font-medium uppercase tracking-wider">RX Total</th>
              <th className="text-right py-2 px-2 text-stone-400 font-medium uppercase tracking-wider">TX Total</th>
              <th className="text-right py-2 px-2 text-stone-400 font-medium uppercase tracking-wider">Errors</th>
            </tr>
          </thead>
          <tbody>
            {interfaces.map((iface: any) => (
              <tr key={iface.device} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2">
                    <Network size={12} className="text-indigo-400" />
                    <span className="font-mono font-medium text-stone-800">{iface.device}</span>
                  </div>
                </td>
                <td className="py-2.5 px-2">
                  <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                    iface.operstate === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-500')}>
                    {iface.operstate === 'up' ? <CheckCircle size={9} /> : <XCircle size={9} />}
                    {iface.operstate}
                  </span>
                </td>
                <td className="py-2.5 px-2 font-mono text-stone-500">{iface.macAddress || '-'}</td>
                <td className="py-2.5 px-2 text-right font-mono text-emerald-600">
                  <span className="inline-flex items-center gap-0.5"><ArrowDownCircle size={10} />{iface.rxRate}</span>
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-blue-600">
                  <span className="inline-flex items-center gap-0.5"><ArrowUpCircle size={10} />{iface.txRate}</span>
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-stone-600">{iface.rxTotal}</td>
                <td className="py-2.5 px-2 text-right font-mono text-stone-600">{iface.txTotal}</td>
                <td className="py-2.5 px-2 text-right">
                  {(iface.rxErrors > 0 || iface.txErrors > 0) ? (
                    <span className="font-mono text-red-500">{iface.rxErrors + iface.txErrors}</span>
                  ) : (
                    <span className="font-mono text-emerald-500">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Filesystem Table ────────────────────────────────────────────────────────

function FilesystemCard({ filesystems }: { filesystems: any[] }) {
  if (!filesystems || filesystems.length === 0) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
          <HardDrive size={15} className="text-amber-500" /> Filesystems
        </h3>
        <p className="text-xs text-stone-400 text-center py-4">No filesystem data available</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2">
        <HardDrive size={15} className="text-amber-500" /> Filesystems
        <span className="text-[10px] font-mono text-stone-400 ml-auto">{filesystems.length} mountpoints</span>
      </h3>
      <div className="space-y-3">
        {filesystems.map((fs: any) => {
          const pct = parseFloat(fs.usedPct);
          const barColor = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500';
          const textColor = pct > 90 ? 'text-red-600' : pct > 75 ? 'text-amber-600' : 'text-emerald-600';
          return (
            <div key={fs.mountpoint} className="bg-stone-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-mono text-xs text-stone-800 truncate">{fs.mountpoint}</span>
                  <span className="text-[10px] text-stone-400">({fs.device})</span>
                  <span className="text-[10px] text-stone-300 font-mono">{fs.fstype}</span>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="text-stone-500">{fs.usedGB} / {fs.totalGB} GB</span>
                  <span className={clsx('font-bold font-mono', textColor)}>{fs.usedPct}%</span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                <div className={clsx('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-stone-400">
                <span>Used: {fs.usedGB} GB</span>
                <span>Free: {fs.availGB} GB</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Alerts Card ─────────────────────────────────────────────────────────────

function AlertsCard({ alerts }: { alerts: any[] }) {
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2">
        <AlertCircle size={15} className="text-red-500" /> Firing Alerts
        {alerts.length > 0 && (
          <span className="ml-auto bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{alerts.length}</span>
        )}
      </h3>
      {alerts.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle size={28} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-xs text-stone-400">No active alerts for this node</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert: any, i: number) => (
            <div key={i} className={clsx('rounded-lg p-3 border',
              alert.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200')}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-stone-800">{alert.alertname}</span>
                <SeverityBadge severity={alert.severity} />
              </div>
              {alert.summary && <p className="text-[11px] text-stone-600 leading-relaxed">{alert.summary}</p>}
              {alert.activeAt && <p className="text-[10px] text-stone-400 mt-1">Since: {formatDate(alert.activeAt)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Network Summary Cards ──────────────────────────────────────────────────

function NetworkSummaryCards({ interfaces }: { interfaces: any[] }) {
  const wanLinks = interfaces.filter((i: any) => i.isWan && i.operstate === 'up');
  const bonds = interfaces.filter((i: any) => i.isBond);
  const activeInterfaces = interfaces.filter((i: any) => i.operstate === 'up');
  const totalRx = activeInterfaces.reduce((s: number, i: any) => s + (i.rxBytesPerSec || 0), 0);
  const totalTx = activeInterfaces.reduce((s: number, i: any) => s + (i.txBytesPerSec || 0), 0);
  const criticalLinks = interfaces.filter((i: any) => i.threshold === 'critical');
  const warningLinks = interfaces.filter((i: any) => i.threshold === 'warning');

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Network size={14} className="text-indigo-500" />
          <span className="text-[10px] text-stone-400 uppercase tracking-wider">WAN Links</span>
        </div>
        <p className="text-lg font-display font-bold text-stone-800">{wanLinks.length}</p>
        <p className="text-[10px] text-stone-400 mt-0.5">{bonds.length > 0 ? `${bonds.length} bond(s)` : 'No bond interfaces'}</p>
      </div>
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <ArrowDownCircle size={14} className="text-emerald-500" />
          <span className="text-[10px] text-stone-400 uppercase tracking-wider">Total Inbound</span>
        </div>
        <p className="text-lg font-display font-bold text-emerald-600 font-mono">{formatBytesRate(totalRx)}</p>
        <p className="text-[10px] text-stone-400 mt-0.5">{activeInterfaces.length} active links</p>
      </div>
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <ArrowUpCircle size={14} className="text-blue-500" />
          <span className="text-[10px] text-stone-400 uppercase tracking-wider">Total Outbound</span>
        </div>
        <p className="text-lg font-display font-bold text-blue-600 font-mono">{formatBytesRate(totalTx)}</p>
        <p className="text-[10px] text-stone-400 mt-0.5">across all interfaces</p>
      </div>
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <AlertTriangle size={14} className={criticalLinks.length > 0 ? 'text-red-500' : warningLinks.length > 0 ? 'text-amber-500' : 'text-emerald-500'} />
          <span className="text-[10px] text-stone-400 uppercase tracking-wider">Link Health</span>
        </div>
        <p className={clsx('text-lg font-display font-bold', criticalLinks.length > 0 ? 'text-red-600' : warningLinks.length > 0 ? 'text-amber-600' : 'text-emerald-600')}>
          {criticalLinks.length > 0 ? `${criticalLinks.length} Critical` : warningLinks.length > 0 ? `${warningLinks.length} Warning` : 'All Healthy'}
        </p>
        <p className="text-[10px] text-stone-400 mt-0.5">{interfaces.filter((i: any) => i.rxErrors + i.txErrors > 0).length} with errors</p>
      </div>
    </div>
  );
}

function InterfaceThroughputBar({ iface }: { iface: any }) {
  const pct = Math.min(100, iface.utilizationPct || 0);
  const barColor = iface.threshold === 'critical' ? 'bg-red-500' : iface.threshold === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = iface.threshold === 'critical' ? 'text-red-600' : iface.threshold === 'warning' ? 'text-amber-600' : 'text-emerald-600';
  return (
    <div className="bg-stone-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Network size={12} className="text-indigo-400" />
          <span className="font-mono text-xs text-stone-800 font-medium">{iface.device}</span>
          {iface.isBond && <span className="text-[9px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-medium">BOND</span>}
          {iface.isWan && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">WAN</span>}
          <span className={clsx('inline-flex items-center gap-0.5 text-[10px]', iface.operstate === 'up' ? 'text-emerald-500' : 'text-stone-400')}>
            {iface.operstate === 'up' ? <CheckCircle size={9} /> : <XCircle size={9} />} {iface.operstate}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {iface.speedMbps > 0 && <span className="text-stone-400">{iface.speedMbps >= 1000 ? `${(iface.speedMbps / 1000).toFixed(0)} Gbps` : `${iface.speedMbps} Mbps`}</span>}
          <span className={clsx('font-mono font-bold', textColor)}>{pct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mb-1.5">
        <div className={clsx('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-stone-400">
        <span className="flex items-center gap-0.5"><ArrowDownCircle size={9} className="text-emerald-500" /> RX: {iface.rxRate}</span>
        <span className="flex items-center gap-0.5"><ArrowUpCircle size={9} className="text-blue-500" /> TX: {iface.txRate}</span>
        <span>Errors: {iface.rxErrors + iface.txErrors}</span>
      </div>
    </div>
  );
}

// ─── Disk IO Card ────────────────────────────────────────────────────────────

function DiskIOCard({ diskIO }: { diskIO: any[] }) {
  if (!diskIO || diskIO.length === 0) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
          <Activity size={15} className="text-indigo-500" /> Disk I/O
        </h3>
        <p className="text-xs text-stone-400 text-center py-4">No disk I/O data available</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2">
        <Activity size={15} className="text-indigo-500" /> Disk I/O Performance
        <span className="text-[10px] font-mono text-stone-400 ml-auto">{diskIO.length} devices</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-2 px-2 text-stone-400 font-medium uppercase tracking-wider">Device</th>
              <th className="text-right py-2 px-2 text-stone-400 font-medium uppercase tracking-wider">IOPS</th>
              <th className="text-right py-2 px-2 text-emerald-500 font-medium uppercase tracking-wider">Reads/s</th>
              <th className="text-right py-2 px-2 text-blue-500 font-medium uppercase tracking-wider">Writes/s</th>
              <th className="text-right py-2 px-2 text-stone-400 font-medium uppercase tracking-wider">Read Lat</th>
              <th className="text-right py-2 px-2 text-stone-400 font-medium uppercase tracking-wider">Write Lat</th>
              <th className="text-right py-2 px-2 text-stone-400 font-medium uppercase tracking-wider">Util %</th>
            </tr>
          </thead>
          <tbody>
            {diskIO.map((d: any) => {
              const utilColor = d.threshold === 'critical' ? 'text-red-600 font-bold' : d.threshold === 'warning' ? 'text-amber-600 font-bold' : 'text-emerald-600';
              const latWarn = (ms: number) => ms > 20 ? 'text-red-600 font-bold' : ms > 10 ? 'text-amber-600' : 'text-stone-600';
              return (
                <tr key={d.device} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <HardDrive size={12} className="text-indigo-400" />
                      <span className="font-mono font-medium text-stone-800">{d.device}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-stone-800 font-medium">{d.iops.toFixed(0)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-emerald-600">{d.readsPerSec.toFixed(1)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-blue-600">{d.writesPerSec.toFixed(1)}</td>
                  <td className={clsx('py-2.5 px-2 text-right font-mono', latWarn(d.readLatencyMs))}>{d.readLatencyMs.toFixed(2)} ms</td>
                  <td className={clsx('py-2.5 px-2 text-right font-mono', latWarn(d.writeLatencyMs))}>{d.writeLatencyMs.toFixed(2)} ms</td>
                  <td className="py-2.5 px-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                        <div className={clsx('h-full rounded-full', d.threshold === 'critical' ? 'bg-red-500' : d.threshold === 'warning' ? 'bg-amber-500' : 'bg-emerald-500')}
                          style={{ width: `${Math.min(100, d.utilizationPct)}%` }} />
                      </div>
                      <span className={clsx('font-mono', utilColor)}>{d.utilizationPct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Metrics History Charts ─────────────────────────────────────────────────

function MetricsHistorySection({ assetId }: { assetId: string }) {
  const [duration, setDuration] = useState('6h');
  const { data: histData, isLoading, isError } = useAssetMetricsHistory(assetId, duration);
  const series = histData?.data?.series;

  const durations = [
    { label: '1h', value: '1h' },
    { label: '6h', value: '6h' },
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' },
  ];

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return duration === '7d'
      ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatBytesShort = (b: number) => {
    if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB/s`;
    if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB/s`;
    if (b >= 1024) return `${(b / 1024).toFixed(1)} KB/s`;
    return `${b.toFixed(0)} B/s`;
  };

  const charts = [
    { key: 'cpu', label: 'CPU Usage', color: '#6366f1', unit: '%', data: series?.cpu },
    { key: 'memory', label: 'Memory Usage', color: '#8b5cf6', unit: '%', data: series?.memory },
    { key: 'disk', label: 'Disk Usage (root)', color: '#f59e0b', unit: '%', data: series?.disk },
    { key: 'load', label: 'Load Average (1m)', color: '#ef4444', unit: '', data: series?.load },
    { key: 'networkIn', label: 'Network Inbound', color: '#10b981', unit: 'bytes', data: series?.networkIn, formatVal: formatBytesShort },
    { key: 'networkOut', label: 'Network Outbound', color: '#3b82f6', unit: 'bytes', data: series?.networkOut, formatVal: formatBytesShort },
  ];

  if (isLoading) {
    return (
      <div className="glass-card p-12 flex flex-col items-center gap-3">
        <Loader2 size={28} className="text-indigo-500 animate-spin" />
        <p className="text-xs text-stone-400">Loading metric history...</p>
      </div>
    );
  }

  if (isError || !series) {
    return (
      <div className="glass-card p-8 text-center">
        <AlertTriangle size={28} className="text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-stone-500">Unable to fetch metric history</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <Clock size={15} className="text-indigo-500" /> Metric Trends
        </h3>
        <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
          {durations.map(d => (
            <button key={d.value} onClick={() => setDuration(d.value)}
              className={clsx('px-3 py-1 text-xs font-medium rounded-md transition-all',
                duration === d.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-stone-500 hover:text-stone-700')}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map(chart => {
          if (!chart.data || chart.data.length === 0) return null;
          const maxVal = Math.max(...chart.data.map((p: any) => p.v), 1);
          return (
            <div key={chart.key} className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-stone-600">{chart.label}</span>
                <span className="text-xs font-mono text-stone-400">
                  Current: <span style={{ color: chart.color }} className="font-bold">
                    {chart.formatVal ? chart.formatVal(chart.data[chart.data.length - 1]?.v || 0) : `${(chart.data[chart.data.length - 1]?.v || 0).toFixed(1)}${chart.unit}`}
                  </span>
                </span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={chart.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`grad-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chart.color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={chart.color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="t" tickFormatter={formatTime} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={40} />
                  <YAxis domain={chart.unit === '%' ? [0, 100] : [0, 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35}
                    tickFormatter={chart.formatVal ? (v) => formatBytesShort(v as number).replace('/s', '') : undefined} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    labelFormatter={(ts) => new Date(ts as number).toLocaleString('en-IN')}
                    formatter={(v) => [chart.formatVal ? chart.formatVal(v as number) : `${(v as number).toFixed(1)}${chart.unit}`, chart.label]}
                  />
                  <Area type="monotone" dataKey="v" stroke={chart.color} strokeWidth={1.5} fill={`url(#grad-${chart.key})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatBytesRate(b: number): string {
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(2)} GB/s`;
  if (b >= 1048576) return `${(b / 1048576).toFixed(2)} MB/s`;
  if (b >= 1024) return `${(b / 1024).toFixed(2)} KB/s`;
  return `${b.toFixed(0)} B/s`;
}

// ─── AI Analysis Card ────────────────────────────────────────────────────────

function AIAnalysisCard({ analysis, issues, recommendations }: { analysis: string; issues: any[]; recommendations: any[] }) {
  return (
    <div className="glass-card p-5 border-l-4 border-l-indigo-400">
      <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
        <Zap size={15} className="text-indigo-500" /> AI Analysis
      </h3>
      <p className="text-sm text-stone-600 leading-relaxed mb-4">{analysis}</p>

      {issues.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Issues Detected</h4>
          <div className="space-y-1.5">
            {issues.map((issue: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <SeverityBadge severity={issue.severity} />
                <div>
                  <span className="font-medium text-stone-800">{issue.title}</span>
                  <span className="text-stone-500 ml-1">{issue.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Recommendations</h4>
          <div className="space-y-1.5">
            {recommendations.map((rec: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs bg-indigo-50 rounded-lg p-2">
                <span className={clsx('shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold',
                  rec.priority === 'high' ? 'bg-red-100 text-red-700' : rec.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>{rec.priority}</span>
                <div>
                  <span className="font-medium text-stone-800">{rec.title}: </span>
                  <span className="text-stone-600">{rec.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'live' | 'network' | 'storage' | 'alerts' | 'incidents' | 'history'>('live');
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: assetData, isLoading, isError } = useAsset(id || '');
  const asset = assetData?.data;

  // Live metrics from Prometheus
  const { data: liveData, isLoading: isLiveLoading, isError: isLiveError, dataUpdatedAt } = useAssetLiveMetrics(id || '');
  const live = liveData?.data;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={() => navigate('/assets')} className="btn-ghost flex items-center gap-1.5 -ml-2">
          <ArrowLeft size={16} /> Back to Assets
        </button>
        <div className="glass-card p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="text-indigo-500 animate-spin" />
          <p className="text-sm text-stone-400">Loading asset details...</p>
        </div>
      </div>
    );
  }

  if (isError || !asset) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={() => navigate('/assets')} className="btn-ghost flex items-center gap-1.5 -ml-2">
          <ArrowLeft size={16} /> Back to Assets
        </button>
        <div className="glass-card p-16 flex flex-col items-center justify-center gap-3">
          <AlertTriangle size={32} className="text-red-500" />
          <p className="text-sm text-stone-500">Failed to load asset</p>
          <button onClick={() => navigate('/assets')} className="btn-ghost text-sm mt-2">Return to Assets</button>
        </div>
      </div>
    );
  }

  const relatedIncidents = (asset?.incidents || live?.incidents || []).map((inc: any) => ({ id: inc.id, number: inc.number, title: inc.shortDescription || inc.title || '-', priority: inc.priority, state: inc.state, createdAt: inc.createdAt }));

  const tabs = [
    { key: 'live', label: 'Live Metrics', icon: Activity },
    { key: 'network', label: 'Network', icon: Wifi, count: live?.interfaces?.length || 0 },
    { key: 'storage', label: 'Storage', icon: HardDrive, count: live?.filesystems?.length || 0 },
    { key: 'alerts', label: 'Alerts', icon: AlertCircle, count: live?.alerts?.length || 0 },
    { key: 'incidents', label: 'Incidents', icon: AlertTriangle, count: relatedIncidents.length },
    { key: 'history', label: 'History', icon: Clock },
  ] as const;

  return (
    <div className="animate-fade-in space-y-0">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0F172A] mb-5">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => navigate('/assets')} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
              <ArrowLeft size={14} /> Assets
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 text-sm font-mono">{asset.ciNumber || asset.id?.slice(0, 8)}</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                {asset.type && <span className={clsx('badge text-[10px] border', typeClass[asset.type as AssetType] || 'bg-stone-100 text-stone-500 border-stone-200')}>{(asset.type as string).replace(/_/g, ' ')}</span>}
                {asset.status && <span className={clsx('badge text-[10px] border', statusClass[asset.status as AssetStatus] || 'bg-stone-100 text-stone-500 border-stone-200')}>{asset.status}</span>}
                {live?.liveStatus && (
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className={clsx('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', liveStatusColors[live.liveStatus])} />
                      <span className={clsx('relative inline-flex rounded-full h-2.5 w-2.5', liveStatusColors[live.liveStatus])} />
                    </span>
                    <span className={clsx('text-[10px] font-bold uppercase tracking-wider',
                      live.liveStatus === 'healthy' ? 'text-emerald-400' : live.liveStatus === 'warning' ? 'text-amber-400' : 'text-red-400')}>
                      {live.liveStatus}
                    </span>
                  </span>
                )}
                {asset.monitoringEnabled && !live?.liveStatus && (
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">Monitored</span>
                  </span>
                )}
              </div>
              <h1 className="text-xl font-display font-bold text-white">{asset.name || '-'}</h1>
              <div className="flex items-center gap-4 mt-3 text-sm text-slate-400 flex-wrap">
                <span className="flex items-center gap-1.5"><Network size={14} /> {asset.ipAddress || '-'}</span>
                {(live?.systemInfo?.hostname || asset.hostname) && (
                  <span className="flex items-center gap-1.5 font-mono text-xs"><Server size={14} /> {live?.systemInfo?.hostname || asset.hostname}</span>
                )}
                {live?.systemInfo?.os && (
                  <span className="flex items-center gap-1.5 text-xs"><MonitorSpeaker size={14} /> {live.systemInfo.os} {live.systemInfo.kernel}</span>
                )}
                <span className="flex items-center gap-1.5"><Shield size={14} /> {asset.supportGroup?.name || '-'}</span>
              </div>
              {live?.systemInfo?.uptimeSeconds > 0 && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                  <Clock size={12} /> Uptime: <span className="font-mono text-slate-300">{formatUptime(live.systemInfo.uptimeSeconds)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {dataUpdatedAt > 0 && (
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <RefreshCw size={10} /> {new Date(dataUpdatedAt).toLocaleTimeString()}
                </span>
              )}
              <button onClick={() => setShowEditModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.1] transition-all">
                <Pencil size={14} /> Edit
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent -mt-5 mb-4" />

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 border-b border-stone-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={clsx('px-4 py-2.5 text-sm font-medium transition-colors relative flex items-center gap-1.5 whitespace-nowrap', activeTab === tab.key ? 'text-indigo-600' : 'text-stone-400 hover:text-stone-700')}>
            <tab.icon size={14} />
            {tab.label}
            {'count' in tab && tab.count > 0 && <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full', activeTab === tab.key ? 'bg-indigo-100 text-indigo-700' : 'bg-stone-100 text-stone-500')}>{tab.count}</span>}
            {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
          </button>
        ))}
      </div>

      {/* ─── Live Metrics Tab ─── */}
      {activeTab === 'live' && (
        <div className="space-y-5">
          {isLiveLoading && (
            <div className="glass-card p-12 flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-indigo-500 animate-spin" />
              <p className="text-xs text-stone-400">Fetching live metrics from Prometheus...</p>
            </div>
          )}

          {isLiveError && !live && (
            <div className="glass-card p-8 text-center">
              <AlertTriangle size={28} className="text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-stone-500">Unable to fetch live metrics</p>
              <p className="text-xs text-stone-400 mt-1">Prometheus may be unreachable or this asset has no IP address configured</p>
            </div>
          )}

          {live && (
            <>
              {/* System Info */}
              <SystemInfoCard sysInfo={live.systemInfo || {}} asset={asset} />

              {/* Resource Gauges */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <UsageGauge label="CPU Usage" value={live.cpu?.usagePct || 0} icon={Cpu} subtext={`${live.cpu?.cores || 0} cores`} />
                <UsageGauge label="Memory" value={parseFloat(live.memory?.usedPct || '0')} icon={MemoryStick} subtext={`${live.memory?.usedGB || 0} / ${live.memory?.totalGB || 0} GB`} />
                <UsageGauge
                  label="Disk (root)"
                  value={live.filesystems?.[0] ? parseFloat(live.filesystems.find((f: any) => f.mountpoint === '/')?.usedPct || live.filesystems[0].usedPct || '0') : 0}
                  icon={HardDrive}
                  subtext={live.filesystems?.[0] ? `${live.filesystems.find((f: any) => f.mountpoint === '/')?.usedGB || live.filesystems[0].usedGB} / ${live.filesystems.find((f: any) => f.mountpoint === '/')?.totalGB || live.filesystems[0].totalGB} GB` : ''}
                />
                <UsageGauge label="Swap" value={parseFloat(live.memory?.swapUsedPct || '0')} icon={Database} subtext={`${live.memory?.swapUsedGB || 0} / ${live.memory?.swapTotalGB || 0} GB`} />
              </div>

              {/* Load Averages + Memory Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                    <Thermometer size={15} className="text-orange-500" /> Load Averages
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['1 min', live.load?.load1],
                      ['5 min', live.load?.load5],
                      ['15 min', live.load?.load15],
                    ].map(([label, value]) => {
                      const v = value as number || 0;
                      const cores = live.cpu?.cores || 1;
                      const color = v > cores * 2 ? 'text-red-600' : v > cores ? 'text-amber-600' : 'text-emerald-600';
                      return (
                        <div key={label as string} className="text-center bg-stone-50 rounded-lg p-3">
                          <p className={clsx('text-2xl font-display font-bold', color)}>{v.toFixed(2)}</p>
                          <p className="text-[10px] text-stone-400 mt-1">{label}</p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-stone-400 mt-2 text-center">CPU Cores: {live.cpu?.cores || 0} — Load above core count indicates saturation</p>
                </div>

                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                    <MemoryStick size={15} className="text-violet-500" /> Memory Breakdown
                  </h3>
                  <div className="space-y-2">
                    {[
                      ['Total', `${live.memory?.totalGB} GB`, 'text-stone-800'],
                      ['Used', `${live.memory?.usedGB} GB (${live.memory?.usedPct}%)`, parseFloat(live.memory?.usedPct || '0') > 80 ? 'text-red-600' : 'text-stone-600'],
                      ['Available', `${live.memory?.availableGB} GB`, 'text-emerald-600'],
                      ['Buffers', `${live.memory?.buffersGB} GB`, 'text-stone-500'],
                      ['Cached', `${live.memory?.cachedGB} GB`, 'text-stone-500'],
                      ['Swap Used', `${live.memory?.swapUsedGB} / ${live.memory?.swapTotalGB} GB`, 'text-stone-500'],
                    ].map(([label, value, cls]) => (
                      <div key={label as string} className="flex justify-between text-xs">
                        <span className="text-stone-400">{label}</span>
                        <span className={clsx('font-mono', cls)}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              {live.aiAnalysis && (
                <AIAnalysisCard analysis={live.aiAnalysis} issues={live.issues || []} recommendations={live.recommendations || []} />
              )}
            </>
          )}

          {/* Fallback: Static specs if no live data */}
          {!live && !isLiveLoading && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-medium text-stone-500 mb-3">Specifications (from CMDB)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ['OS', asset.os],
                  ['CPU', asset.cpu],
                  ['Memory', asset.memory],
                  ['Storage', asset.storage],
                ].map(([label, value]) => (
                  <div key={label as string} className="bg-stone-50 rounded-lg p-3">
                    <p className="text-[10px] text-stone-400 uppercase">{label}</p>
                    <p className="text-sm font-mono text-stone-700">{value || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Network Tab ─── */}
      {activeTab === 'network' && (
        <div className="space-y-5">
          {isLiveLoading && (
            <div className="glass-card p-12 flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-indigo-500 animate-spin" />
              <p className="text-xs text-stone-400">Loading network data...</p>
            </div>
          )}
          {live && (
            <>
              <NetworkSummaryCards interfaces={live.interfaces || []} />
              {/* Throughput per interface with utilization bars */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2">
                  <Wifi size={15} className="text-blue-500" /> Interface Throughput
                  <span className="text-[10px] font-mono text-stone-400 ml-auto">{(live.interfaces || []).length} interfaces</span>
                </h3>
                <div className="space-y-3">
                  {(live.interfaces || []).map((iface: any) => (
                    <InterfaceThroughputBar key={iface.device} iface={iface} />
                  ))}
                </div>
              </div>
              <NetworkInterfacesCard interfaces={live.interfaces || []} />
            </>
          )}
          {!live && !isLiveLoading && (
            <div className="glass-card p-8 text-center">
              <Wifi size={32} className="text-stone-300 mx-auto mb-2" />
              <p className="text-sm text-stone-400">Network interface data requires live Prometheus connection</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Storage Tab ─── */}
      {activeTab === 'storage' && (
        <div className="space-y-5">
          {isLiveLoading && (
            <div className="glass-card p-12 flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-indigo-500 animate-spin" />
              <p className="text-xs text-stone-400">Loading filesystem data...</p>
            </div>
          )}
          {live && (
            <>
              <FilesystemCard filesystems={live.filesystems || []} />
              <DiskIOCard diskIO={live.diskIO || []} />
            </>
          )}
          {!live && !isLiveLoading && (
            <div className="glass-card p-8 text-center">
              <HardDrive size={32} className="text-stone-300 mx-auto mb-2" />
              <p className="text-sm text-stone-400">Filesystem data requires live Prometheus connection</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Alerts Tab ─── */}
      {activeTab === 'alerts' && (
        <div className="space-y-5">
          {isLiveLoading && (
            <div className="glass-card p-12 flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-indigo-500 animate-spin" />
              <p className="text-xs text-stone-400">Loading alerts...</p>
            </div>
          )}
          {live && <AlertsCard alerts={live.alerts || []} />}
          {!live && !isLiveLoading && (
            <div className="glass-card p-8 text-center">
              <AlertCircle size={32} className="text-stone-300 mx-auto mb-2" />
              <p className="text-sm text-stone-400">Alert data requires live Prometheus connection</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Incidents Tab ─── */}
      {activeTab === 'incidents' && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" /> Related Incidents
            {relatedIncidents.length > 0 && <span className="text-[10px] text-stone-400 ml-auto">{relatedIncidents.length} incidents</span>}
          </h3>
          {relatedIncidents.length > 0 ? (
            <div className="space-y-2">
              {relatedIncidents.map((inc: any) => (
                <button key={inc.id} onClick={() => navigate(`/incidents/${inc.id}`)} className="w-full text-left p-3 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-indigo-500 text-xs shrink-0">{inc.number}</span>
                    {inc.priority && <SeverityBadge severity={inc.priority === 'P1' ? 'critical' : inc.priority === 'P2' ? 'warning' : 'info'} />}
                    <p className="text-xs text-stone-600 truncate">{inc.title}</p>
                  </div>
                  <ChevronRight size={14} className="text-stone-300 shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-400 text-center py-6">No incidents linked to this asset</p>
          )}
        </div>
      )}

      {/* ─── History Tab ─── */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          {/* Metric Trend Charts */}
          {id && <MetricsHistorySection assetId={id} />}

          {/* Activity Timeline */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2">
              <Clock size={15} className="text-stone-400" /> Activity History
            </h3>
            {asset.activities && asset.activities.length > 0 ? (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-stone-200" />
                <div className="space-y-6">
                  {asset.activities.map((event: any, i: number) => (
                    <div key={i} className="flex gap-4 relative">
                      <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center z-10 text-indigo-500">
                        <Clock size={14} />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm text-stone-700">{event.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-stone-300">
                          <span>{event.actor || 'System'}</span>
                          <span>{event.timestamp ? formatDate(event.timestamp) : event.createdAt ? formatDate(event.createdAt) : '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-stone-200" />
                <div className="space-y-6">
                  <div className="flex gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center z-10 text-indigo-500">
                      <Clock size={14} />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm text-stone-700">Asset created in CMDB</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-stone-300">
                        <span>System</span>
                        <span>{asset.createdAt ? formatDate(asset.createdAt) : '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showEditModal && <EditAssetModal asset={asset} onClose={() => setShowEditModal(false)} />}
    </div>
  );
}
