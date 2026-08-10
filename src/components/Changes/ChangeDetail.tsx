import { useState } from 'react';
import type React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowLeft,
  GitBranch,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Activity,
  Shield,
  Calendar,
  FileText,
  AlertTriangle,
  Loader2,
  Pencil,
  X,
  Save,
  ChevronDown,
  UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useChange, useUpdateChange } from '../../hooks/useChanges';
import { useTeams } from '../../hooks/useTeams';
import api from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type ChangeType = 'NORMAL' | 'STANDARD' | 'EMERGENCY';
type ChangeState = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'SCHEDULED' | 'IMPLEMENTING' | 'COMPLETED' | 'CANCELLED';
type Risk = 'HIGH' | 'MEDIUM' | 'LOW';

interface Approval {
  id: string;
  approver: string | { firstName?: string; lastName?: string };
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comments: string;
  decidedAt: string | null;
}

interface TimelineEvent {
  id: string;
  type: string;
  description?: string;
  action?: string;
  actor?: string;
  user?: string | { firstName?: string; lastName?: string };
  timestamp?: string;
  createdAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Keep for JSX fallback — actual badge styling below
const typeClass: Record<ChangeType, string> = { NORMAL: '', STANDARD: '', EMERGENCY: '' };
const stateClass: Record<ChangeState, string> = { DRAFT: '', SUBMITTED: '', APPROVED: '', SCHEDULED: '', IMPLEMENTING: '', COMPLETED: '', CANCELLED: '' };
const riskClass: Record<Risk, string> = { HIGH: '', MEDIUM: '', LOW: '' };

const typeStyle: Record<ChangeType, React.CSSProperties> = {
  NORMAL: { background: 'rgba(79,70,229,0.15)', color: 'var(--argus-signal)', border: '1px solid rgba(79,70,229,0.3)' },
  STANDARD: { background: 'rgba(124,58,237,0.15)', color: 'var(--argus-signal)', border: '1px solid rgba(124,58,237,0.3)' },
  EMERGENCY: { background: 'rgba(220,38,38,0.15)', color: 'var(--argus-crimson)', border: '1px solid rgba(220,38,38,0.3)' },
};
const stateStyle: Record<ChangeState, React.CSSProperties> = {
  DRAFT: { background: 'var(--argus-elevated)', color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' },
  SUBMITTED: { background: 'rgba(217,119,6,0.15)', color: 'var(--argus-amber)', border: '1px solid rgba(217,119,6,0.3)' },
  APPROVED: { background: 'rgba(79,70,229,0.15)', color: 'var(--argus-signal)', border: '1px solid rgba(79,70,229,0.3)' },
  SCHEDULED: { background: 'rgba(124,58,237,0.15)', color: 'var(--argus-signal)', border: '1px solid rgba(124,58,237,0.3)' },
  IMPLEMENTING: { background: 'rgba(217,119,6,0.15)', color: 'var(--argus-amber)', border: '1px solid rgba(217,119,6,0.3)' },
  COMPLETED: { background: 'rgba(5,150,105,0.15)', color: 'var(--argus-emerald)', border: '1px solid rgba(5,150,105,0.3)' },
  CANCELLED: { background: 'var(--argus-elevated)', color: 'var(--argus-dim)', border: '1px solid var(--argus-border)' },
};
const riskStyle: Record<Risk, React.CSSProperties> = {
  HIGH: { background: 'rgba(220,38,38,0.15)', color: 'var(--argus-crimson)', border: '1px solid rgba(220,38,38,0.3)' },
  MEDIUM: { background: 'rgba(217,119,6,0.15)', color: 'var(--argus-amber)', border: '1px solid rgba(217,119,6,0.3)' },
  LOW: { background: 'rgba(5,150,105,0.15)', color: 'var(--argus-emerald)', border: '1px solid rgba(5,150,105,0.3)' },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatPersonName(value: unknown): string {
  if (!value) return 'Unknown';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const obj = value as { firstName?: string; lastName?: string; name?: string };
    if (obj.firstName || obj.lastName) {
      return [obj.firstName, obj.lastName].filter(Boolean).join(' ');
    }
    if (obj.name) return obj.name;
  }
  return 'Unknown';
}

// ─── State Transitions ──────────────────────────────────────────────────────

const CHANGE_TRANSITIONS: Record<string, string[]> = {
  NEW:          ['ASSESSMENT', 'CANCELLED'],
  ASSESSMENT:   ['APPROVAL', 'CANCELLED'],
  APPROVAL:     ['SCHEDULED', 'CANCELLED'],
  SCHEDULED:    ['IMPLEMENTING', 'CANCELLED'],
  IMPLEMENTING: ['REVIEW', 'CANCELLED'],
  REVIEW:       ['CLOSED', 'CANCELLED'],
  CLOSED:       [],
  CANCELLED:    [],
};

const CHANGE_TYPES = ['NORMAL', 'STANDARD', 'EMERGENCY'];
const RISK_LEVELS = ['HIGH', 'MEDIUM', 'LOW'];
const CATEGORIES = ['Hardware', 'Software', 'Network', 'Database', 'Security', 'Cloud', 'Infrastructure', 'Application', 'Other'];

// ─── Modals ─────────────────────────────────────────────────────────────────

function EditChangeModal({ change, onClose }: { change: any; onClose: () => void }) {
  const updateChange = useUpdateChange();
  const [form, setForm] = useState({
    shortDescription: change.shortDescription || '',
    description: change.description || '',
    type: change.type || 'NORMAL',
    risk: change.risk || change.riskLevel || 'MEDIUM',
    category: change.category || '',
    justification: change.justification || '',
  });

  const handleSave = async () => {
    try {
      const data: any = {};
      if (form.shortDescription !== change.shortDescription) data.shortDescription = form.shortDescription;
      if (form.description !== (change.description || '')) data.description = form.description;
      if (form.type !== change.type) data.type = form.type;
      if (form.risk !== (change.risk || change.riskLevel)) data.riskLevel = form.risk;
      if (form.category !== (change.category || '')) data.category = form.category;
      if (form.justification !== (change.justification || '')) data.justification = form.justification;
      if (Object.keys(data).length === 0) { onClose(); return; }
      await updateChange.mutateAsync({ id: change.id, data });
      toast.success('Change updated');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update');
    }
  };

  const darkInputStyle: React.CSSProperties = { background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)', borderRadius: '8px', padding: '8px 12px', width: '100%', fontSize: '14px' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg p-6 space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto rounded-2xl" style={{ background: 'var(--argus-surface)', border: '1px solid rgba(124,58,237,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--argus-ink)' }}>Edit Change</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--argus-muted)' }}><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--argus-muted)' }}>Short Description *</label>
            <input value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} style={darkInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--argus-muted)' }}>Description</label>
            <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="resize-y" style={darkInputStyle} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--argus-muted)' }}>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={darkInputStyle}>
                {CHANGE_TYPES.map((v) => <option key={v} value={v} style={{ background: 'var(--argus-surface)' }}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--argus-muted)' }}>Risk</label>
              <select value={form.risk} onChange={(e) => setForm({ ...form, risk: e.target.value })} style={darkInputStyle}>
                {RISK_LEVELS.map((v) => <option key={v} value={v} style={{ background: 'var(--argus-surface)' }}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--argus-muted)' }}>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={darkInputStyle}>
                <option value="" style={{ background: 'var(--argus-surface)' }}>Select...</option>
                {CATEGORIES.map((v) => <option key={v} value={v} style={{ background: 'var(--argus-surface)' }}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--argus-muted)' }}>Justification</label>
            <textarea rows={2} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} className="resize-y" style={darkInputStyle} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' }}>Cancel</button>
          <button onClick={handleSave} disabled={updateChange.isPending || !form.shortDescription.trim()} className="btn-primary flex items-center gap-1.5">
            {updateChange.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignChangeModal({ change, onClose }: { change: any; onClose: () => void }) {
  const updateChange = useUpdateChange();
  const { data: teamsData } = useTeams();
  const teams = teamsData?.data || [];
  const [selectedTeam, setSelectedTeam] = useState(change.assignmentGroupId || '');
  const [selectedUser, setSelectedUser] = useState(change.assignedToId || '');
  const currentTeam = teams.find((t: any) => t.id === selectedTeam);
  const members = currentTeam?.members || [];

  const handleAssign = async () => {
    try {
      const data: any = {};
      if (selectedTeam && selectedTeam !== change.assignmentGroupId) data.assignmentGroupId = selectedTeam;
      if (selectedUser && selectedUser !== change.assignedToId) data.assignedToId = selectedUser;
      if (Object.keys(data).length === 0) { onClose(); return; }
      await updateChange.mutateAsync({ id: change.id, data });
      toast.success('Change assigned');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to assign');
    }
  };

  const darkInputStyle: React.CSSProperties = { background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)', color: 'var(--argus-ink)', borderRadius: '8px', padding: '8px 12px', width: '100%', fontSize: '14px' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md p-6 space-y-4 shadow-2xl animate-fade-in rounded-2xl" style={{ background: 'var(--argus-surface)', border: '1px solid rgba(124,58,237,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--argus-ink)' }}>Assign Change</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--argus-muted)' }}><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--argus-muted)' }}>Assignment Group</label>
            <select value={selectedTeam} onChange={(e) => { setSelectedTeam(e.target.value); setSelectedUser(''); }} style={darkInputStyle}>
              <option value="" style={{ background: 'var(--argus-surface)' }}>Select team...</option>
              {teams.map((t: any) => <option key={t.id} value={t.id} style={{ background: 'var(--argus-surface)' }}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--argus-muted)' }}>Assign To</label>
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} style={darkInputStyle}>
              <option value="" style={{ background: 'var(--argus-surface)' }}>Select member...</option>
              {members.map((m: any) => {
                const user = m.user || m;
                return <option key={user.id} value={user.id} style={{ background: 'var(--argus-surface)' }}>{user.firstName} {user.lastName}</option>;
              })}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: 'var(--argus-muted)', border: '1px solid var(--argus-border)' }}>Cancel</button>
          <button onClick={handleAssign} disabled={updateChange.isPending} className="btn-primary flex items-center gap-1.5">
            {updateChange.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangeStateDropdown({ change }: { change: any }) {
  const updateChange = useUpdateChange();
  const [open, setOpen] = useState(false);
  const allowed = CHANGE_TRANSITIONS[change.state] || [];
  if (allowed.length === 0) return null;

  const handleTransition = async (newState: string) => {
    setOpen(false);
    try {
      await updateChange.mutateAsync({ id: change.id, data: { state: newState } });
      toast.success(`State changed to ${newState.replace(/_/g, ' ')}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'State change failed');
    }
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="btn-ghost flex items-center gap-1.5 text-sm">
        <ChevronDown size={14} /> Change State
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg py-1 shadow-xl animate-fade-in" style={{ background: 'var(--argus-surface)', border: '1px solid rgba(124,58,237,0.3)' }}>
            {allowed.map((s) => (
              <button key={s} onClick={() => handleTransition(s)} className="w-full text-left px-3 py-2 text-sm transition-colors" style={{ color: 'var(--argus-ink)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChangeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'details' | 'plans' | 'approvals' | 'timeline'>('details');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  const { data: changeData, isLoading, isError } = useChange(id || '');
  const chg = changeData?.data;
  const approvals: Approval[] = chg?.approvals || [];
  const timeline: TimelineEvent[] = chg?.activities || [];

  const handleApprove = async () => {
    setApproveLoading(true);
    try {
      await api.post(`/changes/${id}/approve`, { comments: 'Approved' });
      toast.success('Change approved');
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to approve');
    } finally { setApproveLoading(false); }
  };

  const handleReject = async () => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    setApproveLoading(true);
    try {
      await api.post(`/changes/${id}/reject`, { comments: reason });
      toast.success('Change rejected');
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to reject');
    } finally { setApproveLoading(false); }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-signal" />
      </div>
    );
  }

  // Error state
  if (isError || !chg) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle size={40} className="text-crimson" />
        <p className="text-stone-500 text-lg">Failed to load change</p>
        <button onClick={() => navigate('/changes')} className="btn-ghost flex items-center gap-1.5">
          <ArrowLeft size={16} /> Back to Changes
        </button>
      </div>
    );
  }

  // Map API field names to display values
  const requestedBy = formatPersonName(chg.requestedBy);
  const assignedTo = formatPersonName(chg.assignedTo);
  const assignmentGroup = typeof chg.assignmentGroup === 'object' && chg.assignmentGroup
    ? (chg.assignmentGroup.name || 'Unassigned')
    : (chg.assignmentGroup || 'Unassigned');
  const riskLevel = (chg.risk || chg.riskLevel || 'MEDIUM') as Risk;
  const scheduledStart = chg.plannedStartDate || chg.scheduledStart;
  const scheduledEnd = chg.plannedEndDate || chg.scheduledEnd;
  const backoutPlan = chg.rollbackPlan || chg.backoutPlan || '';
  const configItems: string[] = (chg.affectedCIs || chg.configItems || []).map((ci: any) =>
    typeof ci === 'object' && ci !== null ? (ci.configItem?.name || ci.name || ci.ciName || String(ci)) : String(ci)
  );

  const tabs = [
    { key: 'details', label: 'Details' },
    { key: 'plans', label: 'Plans' },
    { key: 'approvals', label: 'Approvals', count: approvals.length },
    { key: 'timeline', label: 'Timeline', count: timeline.length },
  ] as const;

  return (
    <div className="animate-fade-in space-y-0" style={{ background: 'var(--argus-surface)', minHeight: '100vh', margin: '-1.5rem', padding: '1.5rem' }}>
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden mb-5" style={{ background: 'var(--argus-surface)' }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #7C3AED, transparent)' }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 70%)' }} />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => navigate('/changes')} className="flex items-center gap-1.5 text-slate-400 hover:text-ink text-sm transition-colors">
              <ArrowLeft size={14} /> Changes
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 font-mono text-sm">{chg.number}</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2.5 flex-wrap mb-3">
                <span className="badge text-[10px] px-2 py-0.5 rounded-md font-mono" style={typeStyle[chg.type as ChangeType] || typeStyle.NORMAL}>{chg.type}</span>
                <span className="badge text-[10px] px-2 py-0.5 rounded-md" style={stateStyle[chg.state as ChangeState] || stateStyle.DRAFT}>{chg.state}</span>
                <span className="badge text-[10px] px-2 py-0.5 rounded-md" style={riskStyle[riskLevel]}>Risk: {riskLevel}</span>
              </div>
              <h1 className="text-xl font-display font-bold text-ink">{chg.shortDescription}</h1>
              <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
                <span className="flex items-center gap-1.5"><User size={14} /> {requestedBy}</span>
                <span className="flex items-center gap-1.5"><Clock size={14} /> {relativeTime(chg.createdAt)}</span>
                {scheduledStart && <span className="flex items-center gap-1.5"><Calendar size={14} className="text-signal" /> {formatDate(scheduledStart)}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setShowEditModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[color:var(--argus-elevated)] hover:bg-[color:var(--argus-elevated)] text-slate-300 text-xs font-medium rounded-lg transition-all border border-[color:var(--argus-border)]">
                <Pencil size={13} /> Edit
              </button>
              <button onClick={() => setShowAssignModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[color:var(--argus-elevated)] hover:bg-[color:var(--argus-elevated)] text-slate-300 text-xs font-medium rounded-lg transition-all border border-[color:var(--argus-border)]">
                <UserPlus size={13} /> Assign
              </button>
              {chg.state === 'APPROVAL' && (
                <>
                  <button onClick={handleReject} disabled={approveLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-all border border-red-500/20">
                    <XCircle size={13} /> Reject
                  </button>
                  <button onClick={handleApprove} disabled={approveLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[color:var(--argus-signal)] to-[color:var(--argus-signal-bright)] text-white text-xs font-semibold rounded-lg shadow-lg transition-all">
                    {approveLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    Approve
                  </button>
                </>
              )}
              <ChangeStateDropdown change={chg} />
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent -mt-5 mb-4" />

      {/* Tabs */}
      <div className="flex gap-1 px-2 rounded-t-xl" style={{ borderBottom: '1px solid var(--argus-border)', background: 'var(--argus-elevated)' }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="px-4 py-2.5 text-sm font-medium transition-colors relative" style={{ color: activeTab === tab.key ? '#C4B5FD' : 'rgba(255,255,255,0.4)' }}>
            {tab.label}
            {'count' in tab && tab.count > 0 && <span className="ml-1.5 text-xs" style={{ color: 'var(--argus-dim)' }}>({tab.count})</span>}
            {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: '#7C3AED' }} />}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl p-5" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--argus-muted)' }}>Description</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--argus-ink)' }}>{chg.description}</p>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--argus-muted)' }}>Properties</h3>
              {[
                ['Assigned To', assignedTo],
                ['Assignment Group', assignmentGroup],
                ['Scheduled Start', formatDate(scheduledStart)],
                ['Scheduled End', formatDate(scheduledEnd)],
                ['Created', formatDate(chg.createdAt)],
                ['Updated', formatDate(chg.updatedAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span style={{ color: 'var(--argus-muted)' }}>{label}</span>
                  <span className="font-mono text-xs" style={{ color: 'var(--argus-ink)' }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-5" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--argus-muted)' }}>Configuration Items</h3>
              <div className="space-y-1.5">
                {configItems.length > 0 ? configItems.map((ci, idx) => (
                  <div key={ci + idx} className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#A5B4FC' }} />
                    <span className="font-mono text-xs" style={{ color: 'var(--argus-ink)' }}>{ci}</span>
                  </div>
                )) : (
                  <p className="text-sm" style={{ color: 'var(--argus-muted)' }}>No configuration items</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          {[
            { title: 'Implementation Plan', icon: FileText, content: chg.implementationPlan },
            { title: 'Backout Plan', icon: Shield, content: backoutPlan },
            { title: 'Test Plan', icon: CheckCircle, content: chg.testPlan },
          ].map((plan) => (
            <div key={plan.title} className="rounded-xl p-5" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--argus-muted)' }}>
                <plan.icon size={14} /> {plan.title}
              </h3>
              <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono p-4 rounded-lg" style={{ background: 'var(--argus-elevated)', color: 'var(--argus-ink)', border: '1px solid var(--argus-border)' }}>{plan.content || 'No plan provided'}</pre>
            </div>
          ))}
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {approvals.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--argus-muted)' }}>No approvals found</p>
          ) : approvals.map((approval) => {
            const approverName = formatPersonName(approval.approver);
            const borderColor = approval.status === 'APPROVED' ? 'rgba(5,150,105,0.3)' : approval.status === 'REJECTED' ? 'rgba(220,38,38,0.3)' : 'rgba(217,119,6,0.3)';
            return (
              <div key={approval.id} className="rounded-xl p-5" style={{ background: 'var(--argus-elevated)', border: `1px solid ${borderColor}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: approval.status === 'APPROVED' ? 'rgba(5,150,105,0.15)' : approval.status === 'REJECTED' ? 'rgba(220,38,38,0.15)' : 'rgba(217,119,6,0.15)' }}>
                      {approval.status === 'APPROVED' ? <CheckCircle size={16} style={{ color: 'var(--argus-emerald)' }} /> : approval.status === 'REJECTED' ? <XCircle size={16} style={{ color: 'var(--argus-crimson)' }} /> : <Clock size={16} style={{ color: 'var(--argus-amber)' }} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--argus-ink)' }}>{approverName}</p>
                      <p className="text-xs" style={{ color: 'var(--argus-dim)' }}>{approval.decidedAt ? formatDate(approval.decidedAt) : 'Pending'}</p>
                    </div>
                  </div>
                  <span className="badge text-[10px] px-2 py-0.5 rounded-md" style={approval.status === 'APPROVED' ? { background: 'rgba(5,150,105,0.15)', color: 'var(--argus-emerald)', border: '1px solid rgba(5,150,105,0.3)' } : approval.status === 'REJECTED' ? { background: 'rgba(220,38,38,0.15)', color: 'var(--argus-crimson)', border: '1px solid rgba(220,38,38,0.3)' } : { background: 'rgba(217,119,6,0.15)', color: 'var(--argus-amber)', border: '1px solid rgba(217,119,6,0.3)' }}>{approval.status}</span>
                </div>
                {approval.comments && <p className="text-sm mt-2 pl-11" style={{ color: 'var(--argus-muted)' }}>{approval.comments}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="rounded-xl p-5" style={{ background: 'var(--argus-elevated)', border: '1px solid var(--argus-border)' }}>
          {timeline.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--argus-muted)' }}>No timeline events</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px" style={{ background: 'var(--argus-elevated)' }} />
              <div className="space-y-6">
                {timeline.map((event) => {
                  const eventDescription = event.description || event.action || '';
                  const eventActor = event.actor || formatPersonName(event.user);
                  const eventTimestamp = event.timestamp || event.createdAt || '';
                  return (
                    <div key={event.id} className="flex gap-4 relative">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center z-10" style={{ background: 'rgba(124,58,237,0.2)', color: 'var(--argus-signal)' }}>
                        <Activity size={14} />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm" style={{ color: 'var(--argus-ink)' }}>{eventDescription}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--argus-dim)' }}>
                          <span>{eventActor}</span>
                          {eventTimestamp && <span>{formatDate(eventTimestamp)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showEditModal && <EditChangeModal change={chg} onClose={() => setShowEditModal(false)} />}
      {showAssignModal && <AssignChangeModal change={chg} onClose={() => setShowAssignModal(false)} />}
    </div>
  );
}
