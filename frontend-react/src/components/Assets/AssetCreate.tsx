import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Server } from 'lucide-react';
import clsx from 'clsx';
import { useCreateAsset } from '../../hooks/useAssets';
import api from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface FormData {
  name: string;
  type: CIType;
  status: CIStatus;
  category: string;
  description: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  location: string;
  ipAddress: string;
  hostname: string;
  os: string;
  osVersion: string;
  cpu: string;
  memory: string;
  storage: string;
  supportGroupId: string;
  monitoringEnabled: boolean;
}

// ─── Static Data ─────────────────────────────────────────────────────────────

const CI_TYPES: { value: CIType; label: string }[] = [
  { value: 'SERVER', label: 'Server' },
  { value: 'KUBERNETES_CLUSTER', label: 'Kubernetes Cluster' },
  { value: 'DATABASE', label: 'Database' },
  { value: 'APPLICATION', label: 'Application' },
  { value: 'NETWORK', label: 'Network' },
  { value: 'STORAGE', label: 'Storage' },
  { value: 'CONTAINER', label: 'Container' },
  { value: 'VM', label: 'VM' },
  { value: 'LOAD_BALANCER', label: 'Load Balancer' },
];

const CI_STATUSES: { value: CIStatus; label: string }[] = [
  { value: 'LIVE', label: 'Live' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'DECOMMISSIONED', label: 'Decommissioned' },
  { value: 'PLANNED', label: 'Planned' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function AssetCreate() {
  const navigate = useNavigate();
  const createAsset = useCreateAsset();

  // Fetch teams from API
  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data } = await api.get('/teams');
      return data;
    },
    staleTime: 60000,
  });

  const teams: { id: string; name: string }[] = teamsData?.data || [];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      type: 'SERVER',
      status: 'PLANNED',
      category: '',
      description: '',
      serialNumber: '',
      manufacturer: '',
      model: '',
      location: '',
      ipAddress: '',
      hostname: '',
      os: '',
      osVersion: '',
      cpu: '',
      memory: '',
      storage: '',
      supportGroupId: '',
      monitoringEnabled: false,
    },
  });

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      supportGroupId: data.supportGroupId || undefined,
    };
    try {
      await createAsset.mutateAsync(payload);
      toast.success('Asset registered successfully');
      navigate('/assets');
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to register asset';
      toast.error(message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-0">
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
            <span className="text-slate-300 text-sm">Register</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
              <Server size={20} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-white">Register New Asset</h1>
              <p className="text-slate-400 text-sm mt-0.5">Add a configuration item to the CMDB</p>
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent -mt-5 mb-5" />

      {/* Form card */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 md:p-8">

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Section: Basic Information ─────────────────────────────── */}
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
            Basic Information
          </h3>

          {/* Name (full width) */}
          <div>
            <label className="block text-sm font-medium text-stone-500 mb-1.5">
              Name <span className="text-crimson">*</span>
            </label>
            <input
              type="text"
              placeholder="Asset name (e.g. prod-api-server-01)"
              className={clsx(
                'input-field',
                errors.name &&
                  'border-crimson/60 focus:border-crimson/80 focus:ring-crimson/20',
              )}
              {...register('name', {
                required: 'Name is required',
                minLength: { value: 2, message: 'Minimum 2 characters' },
              })}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-crimson">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Type | Status | Category */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Type
              </label>
              <select className="input-field" {...register('type')}>
                {CI_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Status
              </label>
              <select className="input-field" {...register('status')}>
                {CI_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Category
              </label>
              <input
                type="text"
                placeholder="e.g. Production, Staging"
                className="input-field"
                {...register('category')}
              />
            </div>
          </div>

          {/* Description (full width textarea) */}
          <div>
            <label className="block text-sm font-medium text-stone-500 mb-1.5">
              Description
            </label>
            <textarea
              rows={4}
              placeholder="Detailed description of the asset, its purpose, and any relevant notes..."
              className="input-field resize-y min-h-[100px]"
              {...register('description')}
            />
          </div>

          {/* ── Section: Hardware Details ──────────────────────────────── */}
          <div className="border-t border-stone-200" />
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
            Hardware Details
          </h3>

          {/* Manufacturer | Model | Serial Number */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Manufacturer
              </label>
              <input
                type="text"
                placeholder="e.g. Dell, HP, Lenovo"
                className="input-field"
                {...register('manufacturer')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Model
              </label>
              <input
                type="text"
                placeholder="e.g. PowerEdge R740"
                className="input-field"
                {...register('model')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Serial Number
              </label>
              <input
                type="text"
                placeholder="e.g. SN-2026-00001"
                className="input-field"
                {...register('serialNumber')}
              />
            </div>
          </div>

          {/* CPU | Memory | Storage */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                CPU
              </label>
              <input
                type="text"
                placeholder="e.g. Intel Xeon E5-2680 v4"
                className="input-field"
                {...register('cpu')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Memory
              </label>
              <input
                type="text"
                placeholder="e.g. 64 GB DDR4"
                className="input-field"
                {...register('memory')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Storage
              </label>
              <input
                type="text"
                placeholder="e.g. 2x 1TB SSD RAID 1"
                className="input-field"
                {...register('storage')}
              />
            </div>
          </div>

          {/* ── Section: Network & Location ────────────────────────────── */}
          <div className="border-t border-stone-200" />
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
            Network & Location
          </h3>

          {/* Location | IP Address | Hostname */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Location
              </label>
              <input
                type="text"
                placeholder="e.g. DC1-Rack-A3"
                className="input-field"
                {...register('location')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                IP Address
              </label>
              <input
                type="text"
                placeholder="e.g. 10.0.1.25"
                className="input-field"
                {...register('ipAddress')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Hostname
              </label>
              <input
                type="text"
                placeholder="e.g. prod-api-01.argus.local"
                className="input-field"
                {...register('hostname')}
              />
            </div>
          </div>

          {/* OS | OS Version */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                OS
              </label>
              <input
                type="text"
                placeholder="e.g. Ubuntu, RHEL, Windows Server"
                className="input-field"
                {...register('os')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                OS Version
              </label>
              <input
                type="text"
                placeholder="e.g. 22.04 LTS"
                className="input-field"
                {...register('osVersion')}
              />
            </div>
          </div>

          {/* ── Section: Support & Monitoring ──────────────────────────── */}
          <div className="border-t border-stone-200" />
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
            Support & Monitoring
          </h3>

          {/* Support Group (half width) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                Support Group
              </label>
              <select className="input-field" {...register('supportGroupId')}>
                <option value="">Select team...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Monitoring Enabled (toggle-style checkbox) */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  {...register('monitoringEnabled')}
                />
                <div
                  className={clsx(
                    'w-10 h-5 rounded-full transition-colors',
                    'bg-stone-300 peer-checked:bg-indigo-500',
                  )}
                />
                <div
                  className={clsx(
                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform',
                    'bg-gray-300 peer-checked:bg-white peer-checked:translate-x-5',
                  )}
                />
              </div>
              <span className="text-sm font-medium text-stone-500 group-hover:text-stone-700 transition-colors">
                Monitoring Enabled
              </span>
            </label>
            <p className="text-xs text-stone-300 mt-1 ml-[52px]">
              Enable Prometheus/Grafana monitoring for this asset
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-stone-200" />

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/assets')}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || createAsset.isPending}
              className={clsx(
                'btn-primary flex items-center gap-2',
                (isSubmitting || createAsset.isPending) && 'opacity-60 cursor-not-allowed',
              )}
            >
              <Save size={16} />
              {isSubmitting || createAsset.isPending ? 'Registering...' : 'Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
