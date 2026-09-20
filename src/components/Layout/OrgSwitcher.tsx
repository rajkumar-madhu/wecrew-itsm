import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronDown, Check, Globe } from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

interface Org {
  id: string;
  name: string;
  slug: string;
  environment: string;
  isActive: boolean;
  _count?: { users: number; incidents: number };
}

const envColors: Record<string, string> = {
  PROD: 'bg-emerald-500/20 text-emerald-300',
  DR: 'bg-amber-500/20 text-amber-300',
  UAT: 'bg-sky-500/20 text-sky-300',
  DEV: 'bg-violet-500/20 text-violet-300',
};

export default function OrgSwitcher() {
  const user = useAuthStore((s) => s.user);
  const selectedOrgId = useAuthStore((s) => s.selectedOrgId);
  const setSelectedOrg = useAuthStore((s) => s.setSelectedOrg);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function switchOrg(id: string | null) {
    setSelectedOrg(id);
    setOpen(false);
    qc.invalidateQueries({ predicate: (q) => !q.queryKey.includes('organizations') });
  }
  // Platform staff only — a self-registered trial owner is also role ADMIN
  // but must stay locked to their own org (see useAuth.isPlatformAdmin).
  const isSuperAdmin = user?.role === 'ADMIN' && user?.isPlatformAdmin === true;

  const { data } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await api.get('/organizations?limit=50');
      return data;
    },
    staleTime: 120000,
    enabled: isSuperAdmin,
  });

  const orgs: Org[] = data?.data || [];
  const selected = orgs.find((o) => o.id === selectedOrgId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!isSuperAdmin) return null;

  return (
    <div ref={ref} className="relative px-2 pt-2 pb-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={clsx(
          'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium transition-colors border',
          'border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white'
        )}
      >
        <Building2 size={14} className="text-sky-300 shrink-0" />
        <span className="truncate flex-1 text-left">
          {selected ? selected.name : 'All organizations'}
        </span>
        {selected && (
          <span
            className={clsx(
              'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
              envColors[selected.environment] || 'bg-white/10 text-white/60'
            )}
          >
            {selected.environment}
          </span>
        )}
        <ChevronDown size={12} className={clsx('transition-transform opacity-70', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-[#121a24] border border-white/10 rounded-md shadow-xl max-h-[360px] overflow-y-auto">
          <button
            type="button"
            onClick={() => switchOrg(null)}
            className={clsx(
              'w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors border-b border-white/5',
              !selectedOrgId ? 'bg-sky-500/15 text-sky-200' : 'text-white/60 hover:bg-white/5 hover:text-white'
            )}
          >
            <Globe size={13} />
            <span className="flex-1 text-left font-medium">All organizations</span>
            {!selectedOrgId && <Check size={13} className="text-sky-300" />}
          </button>

          {orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => switchOrg(org.id)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors',
                selectedOrgId === org.id
                  ? 'bg-sky-500/15 text-sky-200'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              )}
            >
              <Building2 size={12} className="shrink-0 opacity-50" />
              <span className="flex-1 text-left truncate">{org.name}</span>
              <span
                className={clsx(
                  'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0',
                  envColors[org.environment] || 'bg-white/10 text-white/50'
                )}
              >
                {org.environment}
              </span>
              {selectedOrgId === org.id && <Check size={12} className="text-sky-300 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
