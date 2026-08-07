import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowLeft,
  Bug,
  Clock,
  User,
  Target,
  Link2,
  ChevronRight,
  AlertTriangle,
  Send,
  Lightbulb,
  Loader2,
  Pencil,
  X,
  Save,
  ChevronDown,
  UserPlus,
  CheckCircle,
  Brain,
  Shield,
  BookOpen,
  Zap,
  Terminal,
  Activity,
  Server,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProblem, useUpdateProblem, useAiRCA, useAlertKB } from '../../hooks/useProblems';
import { useTeams } from '../../hooks/useTeams';
import api from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type Priority = 'P1' | 'P2' | 'P3' | 'P4';
type ProblemState = 'NEW' | 'INVESTIGATION' | 'RCA_IN_PROGRESS' | 'KNOWN_ERROR' | 'RESOLVED' | 'CLOSED';

interface WorkNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const priorityClass: Record<Priority, string> = { P1: 'priority-p1', P2: 'priority-p2', P3: 'priority-p3', P4: 'priority-p4' };

const stateClass: Record<ProblemState, string> = {
  NEW: 'bg-indigo-50 text-[#4F46E5] border-indigo-200',
  INVESTIGATION: 'bg-amber-50 text-[#D97706] border-amber-200',
  RCA_IN_PROGRESS: 'bg-violet-50 text-[#7C3AED] border-violet-200',
  KNOWN_ERROR: 'bg-red-50 text-[#DC2626] border-red-200',
  RESOLVED: 'bg-emerald-50 text-[#059669] border-emerald-200',
  CLOSED: 'bg-stone-100 text-stone-500 border-stone-200',
};

const stateLabel: Record<ProblemState, string> = {
  NEW: 'New',
  INVESTIGATION: 'Investigating',
  RCA_IN_PROGRESS: 'RCA Identified',
  KNOWN_ERROR: 'Known Error',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── State Transitions ──────────────────────────────────────────────────────

const PROBLEM_TRANSITIONS: Record<string, string[]> = {
  NEW:                    ['INVESTIGATION'],
  INVESTIGATION:          ['RCA_IN_PROGRESS', 'KNOWN_ERROR'],
  RCA_IN_PROGRESS:  ['KNOWN_ERROR', 'RESOLVED'],
  KNOWN_ERROR:            ['RESOLVED'],
  RESOLVED:               ['CLOSED'],
  CLOSED:                 [],
};

const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];
const CATEGORIES = ['Hardware', 'Software', 'Network', 'Database', 'Security', 'Cloud', 'Infrastructure', 'Application', 'Configuration', 'Human Error', 'Other'];

// ─── Modals ─────────────────────────────────────────────────────────────────

function EditProblemModal({ problem, onClose }: { problem: any; onClose: () => void }) {
  const updateProblem = useUpdateProblem();
  const [form, setForm] = useState({
    shortDescription: problem.shortDescription || '',
    description: problem.description || '',
    priority: problem.priority || 'P3',
    category: problem.category || '',
    workaround: problem.workaround || '',
    rootCause: problem.rootCause || '',
  });

  const handleSave = async () => {
    try {
      const data: any = {};
      if (form.shortDescription !== problem.shortDescription) data.shortDescription = form.shortDescription;
      if (form.description !== (problem.description || '')) data.description = form.description;
      if (form.priority !== problem.priority) data.priority = form.priority;
      if (form.category !== (problem.category || '')) data.category = form.category;
      if (form.workaround !== (problem.workaround || '')) data.workaround = form.workaround;
      if (form.rootCause !== (problem.rootCause || '')) data.rootCause = form.rootCause;
      if (Object.keys(data).length === 0) { onClose(); return; }
      await updateProblem.mutateAsync({ id: problem.id, data });
      toast.success('Problem updated');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="glass-card w-full max-w-lg p-6 space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-900">Edit Problem</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Short Description *</label>
            <input value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field resize-y" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input-field">
                {PRIORITIES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field">
                <option value="">Select...</option>
                {CATEGORIES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Root Cause</label>
            <textarea rows={2} value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} className="input-field resize-y" placeholder="Root cause analysis..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Workaround</label>
            <textarea rows={2} value={form.workaround} onChange={(e) => setForm({ ...form, workaround: e.target.value })} className="input-field resize-y" placeholder="Known workaround..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={updateProblem.isPending || !form.shortDescription.trim()} className="btn-primary flex items-center gap-1.5">
            {updateProblem.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignProblemModal({ problem, onClose }: { problem: any; onClose: () => void }) {
  const updateProblem = useUpdateProblem();
  const { data: teamsData } = useTeams();
  const teams = teamsData?.data || [];
  const [selectedTeam, setSelectedTeam] = useState(problem.assignmentGroupId || '');
  const [selectedUser, setSelectedUser] = useState(problem.assignedToId || '');
  const currentTeam = teams.find((t: any) => t.id === selectedTeam);
  const members = currentTeam?.members || [];

  const handleAssign = async () => {
    try {
      const data: any = {};
      if (selectedTeam && selectedTeam !== problem.assignmentGroupId) data.assignmentGroupId = selectedTeam;
      if (selectedUser && selectedUser !== problem.assignedToId) data.assignedToId = selectedUser;
      if (Object.keys(data).length === 0) { onClose(); return; }
      await updateProblem.mutateAsync({ id: problem.id, data });
      toast.success('Problem assigned');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to assign');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-6 space-y-4 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-900">Assign Problem</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Assignment Group</label>
            <select value={selectedTeam} onChange={(e) => { setSelectedTeam(e.target.value); setSelectedUser(''); }} className="input-field">
              <option value="">Select team...</option>
              {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Assign To</label>
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="input-field">
              <option value="">Select member...</option>
              {members.map((m: any) => {
                const user = m.user || m;
                return <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>;
              })}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleAssign} disabled={updateProblem.isPending} className="btn-primary flex items-center gap-1.5">
            {updateProblem.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

function ProblemStateDropdown({ problem }: { problem: any }) {
  const updateProblem = useUpdateProblem();
  const [open, setOpen] = useState(false);
  const allowed = PROBLEM_TRANSITIONS[problem.state] || [];
  if (allowed.length === 0) return null;

  const labels: Record<string, string> = {
    INVESTIGATION: 'Investigating',
    RCA_IN_PROGRESS: 'RCA Identified',
    KNOWN_ERROR: 'Known Error',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
  };

  const handleTransition = async (newState: string) => {
    setOpen(false);
    try {
      const data: any = { state: newState };
      if (newState === 'KNOWN_ERROR') data.isKnownError = true;
      await updateProblem.mutateAsync({ id: problem.id, data });
      toast.success(`State changed to ${labels[newState] || newState}`);
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
          <div className="absolute right-0 z-20 mt-1 w-48 glass-card border border-stone-200 rounded-lg py-1 shadow-xl animate-fade-in">
            {allowed.map((s) => (
              <button key={s} onClick={() => handleTransition(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-stone-100 transition-colors">
                {labels[s] || s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Confidence Arc Gauge ────────────────────────────────────────────────────

function ConfidenceGauge({ value }: { value: number }) {
  const angle = (value / 100) * 180;
  const radians = (angle - 90) * (Math.PI / 180);
  const r = 40;
  const cx = 50, cy = 50;
  const x = cx + r * Math.cos(radians);
  const y = cy + r * Math.sin(radians);
  const largeArc = angle > 90 ? 1 : 0;
  const color = value >= 70 ? '#059669' : value >= 40 ? '#D97706' : '#DC2626';

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 60" className="w-24 h-14">
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#E5E7EB" strokeWidth="6" strokeLinecap="round" />
        <path d={`M 10 50 A 40 40 0 ${largeArc} 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
      </svg>
      <span className="text-lg font-display font-bold" style={{ color }}>{value}%</span>
      <span className="text-[9px] text-stone-400 font-mono uppercase tracking-wider">Confidence</span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProblemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'details' | 'rca' | 'worknotes' | 'related'>('details');
  const [newNote, setNewNote] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);

  const { data: problemData, isLoading, isError, refetch } = useProblem(id || '');
  const aiRCA = useAiRCA();
  const { data: kbData } = useAlertKB();
  const alertKBEntries: any[] = kbData?.data || [];

  const prb = problemData?.data;
  const worknotes: WorkNote[] = (prb?.workNotes || []).map((note: any) => {
    const authorName = typeof note.author === 'object'
      ? [note.author?.firstName, note.author?.lastName].filter(Boolean).join(' ')
      : typeof note.user === 'object'
      ? [note.user?.firstName, note.user?.lastName].filter(Boolean).join(' ')
      : (note.author || note.user || 'Unknown');
    return { ...note, author: authorName };
  });
  const relatedIncidents = (prb?.linkedIncidents || []).map((li: any) => ({
    id: li.incident?.id || li.id,
    number: li.incident?.number || li.number || '',
    title: li.incident?.shortDescription || li.title || '',
    priority: li.incident?.priority,
    state: li.incident?.state,
    alertName: li.incident?.alertName,
  }));
  const relatedChanges = prb?.relatedChangeId
    ? [{ id: prb.relatedChangeId, number: '', title: 'Related Change' }]
    : [];

  const rca = prb?.rootCauseAnalysis as any;

  const assignedToName = typeof prb?.assignedTo === 'object'
    ? [prb.assignedTo?.firstName, prb.assignedTo?.lastName].filter(Boolean).join(' ') || 'Unassigned'
    : (prb?.assignedTo || 'Unassigned');
  const assignmentGroupName = typeof prb?.assignmentGroup === 'object'
    ? (prb.assignmentGroup?.name || 'Unassigned')
    : (prb?.assignmentGroup || 'Unassigned');

  // Match KB entries based on linked incident alert names
  const matchedKBEntries = alertKBEntries.filter((kb: any) => {
    const kbKey = kb.key?.toLowerCase() || '';
    return relatedIncidents.some((inc: any) => {
      const alertName = (inc.alertName || inc.title || '').toLowerCase();
      return alertName.includes(kbKey) || kbKey.includes(alertName.split(/[^a-z]/)[0]);
    });
  });

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setNoteLoading(true);
    try {
      await api.post(`/problems/${id}/notes`, { content: newNote });
      toast.success('Work note added');
      setNewNote('');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to add note');
    } finally { setNoteLoading(false); }
  };

  const handleAiRCA = async () => {
    if (!id) return;
    try {
      await aiRCA.mutateAsync(id);
      toast.success('AI root cause analysis complete');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'AI analysis failed');
    }
  };

  const handleAcceptRCA = async () => {
    if (!id || !rca) return;
    try {
      const updateData: any = {
        rootCause: rca.rootCause,
        state: 'RCA_IN_PROGRESS',
      };
      if (rca.workaround) updateData.workaround = rca.workaround;
      if (rca.permanentFix) updateData.permanentFix = rca.permanentFix;
      if (rca.category) updateData.category = rca.category;
      await api.patch(`/problems/${id}`, updateData);
      toast.success('RCA accepted — state moved to RCA In Progress');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to accept RCA');
    }
  };

  const handleApplyKB = async (kb: any) => {
    if (!id) return;
    try {
      await api.patch(`/problems/${id}/rca`, {
        rootCause: kb.rootCauses.join('; '),
        workaround: kb.remediate?.[0] || '',
      });
      toast.success('KB applied to root cause');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to apply KB');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-[#4F46E5]" />
      </div>
    );
  }

  if (isError || !prb) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle size={32} className="text-[#DC2626]" />
        <p className="text-stone-500">Failed to load problem</p>
        <button onClick={() => navigate('/problems')} className="btn-ghost text-sm">Back to Problems</button>
      </div>
    );
  }

  const tabs = [
    { key: 'details', label: 'Details' },
    { key: 'rca', label: 'Root Cause' },
    { key: 'worknotes', label: 'Work Notes', count: worknotes.length },
    { key: 'related', label: 'Related', count: relatedIncidents.length + relatedChanges.length },
  ] as const;

  return (
    <div className="animate-fade-in space-y-0">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0F172A] mb-5">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => navigate('/problems')} className="flex items-center gap-1.5 text-[#64748B] hover:text-white text-sm transition-colors">
              <ArrowLeft size={14} /> Problems
            </button>
            <span className="text-[#475569]">/</span>
            <span className="text-[#94A3B8] font-mono text-sm">{prb.number}</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2.5 flex-wrap mb-3">
                <span className={clsx('badge', priorityClass[prb.priority as keyof typeof priorityClass])}>{prb.priority}</span>
                <span className={clsx('badge text-[10px] border', stateClass[prb.state as keyof typeof stateClass])}>{stateLabel[prb.state as keyof typeof stateLabel]}</span>
                {prb.category && <span className="text-[10px] bg-white/[0.06] text-[#94A3B8] px-2 py-0.5 rounded border border-white/[0.08]">{prb.category}</span>}
              </div>
              <h1 className="text-xl font-display font-bold text-white">{prb.shortDescription}</h1>
              <div className="flex items-center gap-4 mt-3 text-sm text-[#64748B]">
                <span className="flex items-center gap-1.5"><User size={14} /> {assignedToName}</span>
                <span className="flex items-center gap-1.5"><Clock size={14} /> {relativeTime(prb.createdAt)}</span>
                <span className="flex items-center gap-1.5"><AlertTriangle size={14} className="text-amber-400" /> {relatedIncidents.length} linked incidents</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setShowEditModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-[#94A3B8] text-xs font-medium rounded-lg transition-all border border-white/[0.08]">
                <Pencil size={13} /> Edit
              </button>
              <button onClick={() => setShowAssignModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-[#94A3B8] text-xs font-medium rounded-lg transition-all border border-white/[0.08]">
                <UserPlus size={13} /> Assign
              </button>
              <ProblemStateDropdown problem={prb} />
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-violet-500/60 to-transparent -mt-5 mb-4" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-200 bg-stone-50/50 rounded-t-xl px-2">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={clsx('px-4 py-2.5 text-sm font-medium transition-colors relative', activeTab === tab.key ? 'text-[#7C3AED]' : 'text-stone-400 hover:text-stone-700')}>
            {tab.label}
            {'count' in tab && tab.count > 0 && <span className="ml-1.5 text-xs text-stone-300">({tab.count})</span>}
            {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7C3AED] rounded-full" />}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-5">
            <h3 className="text-sm font-medium text-stone-500 mb-3">Description</h3>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{prb.description}</p>
          </div>
          <div className="space-y-4">
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-sm font-medium text-stone-500 mb-2">Properties</h3>
              {[
                ['Category', prb.category || 'N/A'],
                ['Assignment Group', assignmentGroupName],
                ['Assigned To', assignedToName],
                ['Created', formatDate(prb.createdAt)],
                ['Updated', formatDate(prb.updatedAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-stone-400">{label}</span>
                  <span className="text-stone-700 font-mono text-xs">{value}</span>
                </div>
              ))}
            </div>
            {prb.workaround && (
              <div className="glass-card p-5 border-amber-200 bg-amber-50/30">
                <h3 className="text-sm font-medium text-[#D97706] mb-2 flex items-center gap-2"><Lightbulb size={14} /> Workaround</h3>
                <p className="text-sm text-stone-700 leading-relaxed">{prb.workaround}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROOT CAUSE TAB — AI-powered RCA workspace
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'rca' && (
        <div className="space-y-5">
          {/* 1. AI Root Cause Suggestion Panel */}
          <div className="glass-card p-5 border-violet-200/50 bg-gradient-to-br from-violet-50/30 to-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-2">
                <Brain size={16} className="text-[#7C3AED]" />
                AI Root Cause Analysis
              </h3>
              <button
                onClick={handleAiRCA}
                disabled={aiRCA.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-violet-500/25 transition-all disabled:opacity-50"
              >
                {aiRCA.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap size={13} />
                    Analyze with AI
                  </>
                )}
              </button>
            </div>

            {/* AI Loading State */}
            {aiRCA.isPending && (
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-3 animate-pulse">
                  <Brain size={28} className="text-[#7C3AED]" />
                </div>
                <p className="text-sm text-stone-500">Analyzing linked incidents and knowledge base...</p>
                <p className="text-[10px] text-stone-400 font-mono mt-1">Ollama Qwen3-32B + ALERT_KB ({alertKBEntries.length} entries)</p>
              </div>
            )}

            {/* AI Results */}
            {rca && !aiRCA.isPending && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Confidence Gauge */}
                  <div className="flex items-center justify-center">
                    <ConfidenceGauge value={rca.confidence || 0} />
                  </div>

                  {/* Category + Root Cause */}
                  <div className="md:col-span-3 space-y-3">
                    <div className="flex items-center gap-2">
                      {rca.category && (
                        <span className="text-[10px] font-bold bg-violet-100 text-[#7C3AED] px-2 py-0.5 rounded-md border border-violet-200">
                          {rca.category}
                        </span>
                      )}
                    </div>
                    <div className="bg-white border border-stone-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-stone-800 mb-2">Root Cause</p>
                      <p className="text-sm text-stone-600 leading-relaxed">{rca.rootCause}</p>
                    </div>
                  </div>
                </div>

                {/* Evidence */}
                {rca.evidence?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-stone-500 mb-2 flex items-center gap-1.5"><Activity size={12} /> Evidence</p>
                    <div className="space-y-1">
                      {rca.evidence.map((ev: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-stone-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                          {ev}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Workaround + Fix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rca.workaround && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-[#D97706] mb-1 flex items-center gap-1"><Lightbulb size={11} /> Suggested Workaround</p>
                      <p className="text-xs text-stone-600">{rca.workaround}</p>
                    </div>
                  )}
                  {rca.permanentFix && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-[#059669] mb-1 flex items-center gap-1"><CheckCircle size={11} /> Suggested Permanent Fix</p>
                      <p className="text-xs text-stone-600">{rca.permanentFix}</p>
                    </div>
                  )}
                </div>

                {/* Accept Button */}
                <button
                  onClick={handleAcceptRCA}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                >
                  <CheckCircle size={13} />
                  Accept RCA & Advance State
                </button>
              </div>
            )}

            {/* No RCA yet */}
            {!rca && !aiRCA.isPending && (
              <div className="text-center py-6">
                <Brain size={32} className="mx-auto mb-2 text-stone-300" />
                <p className="text-sm text-stone-400">Click "Analyze with AI" to generate a root cause suggestion</p>
                <p className="text-[10px] text-stone-300 mt-1">Uses linked incidents, ALERT_KB, and Ollama AI</p>
              </div>
            )}
          </div>

          {/* 2. Impact Blast Radius */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-2">
              <Shield size={14} className="text-red-500" />
              Impact &amp; Blast Radius
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-stone-50 rounded-xl border border-stone-100">
                <AlertTriangle size={18} className="mx-auto mb-1 text-amber-500" />
                <p className="text-lg font-display font-bold text-stone-800">{relatedIncidents.length}</p>
                <p className="text-[10px] text-stone-400">Linked Incidents</p>
              </div>
              <div className="text-center p-3 bg-stone-50 rounded-xl border border-stone-100">
                <Server size={18} className="mx-auto mb-1 text-indigo-500" />
                <p className="text-lg font-display font-bold text-stone-800">{prb.category || '—'}</p>
                <p className="text-[10px] text-stone-400">Category</p>
              </div>
              <div className="text-center p-3 bg-stone-50 rounded-xl border border-stone-100">
                <Users size={18} className="mx-auto mb-1 text-violet-500" />
                <p className="text-lg font-display font-bold text-stone-800">{assignmentGroupName}</p>
                <p className="text-[10px] text-stone-400">Team Impacted</p>
              </div>
            </div>
          </div>

          {/* 3. Evidence Chain — linked incidents timeline */}
          {relatedIncidents.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-2">
                <Activity size={14} className="text-amber-500" />
                Evidence Chain
              </h3>
              <div className="space-y-0">
                {relatedIncidents.map((inc: any, idx: number) => (
                  <div key={inc.id} className="relative">
                    <div className="flex items-start gap-3 py-2.5">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700 border border-amber-200">
                          {idx + 1}
                        </div>
                        {idx < relatedIncidents.length - 1 && <div className="w-px h-6 bg-stone-200 mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button onClick={() => navigate(`/incidents/${inc.id}`)} className="text-xs font-mono text-[#4F46E5] hover:underline">{inc.number}</button>
                        <p className="text-xs text-stone-600 truncate">{inc.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {inc.priority && <PriorityBadge p={inc.priority} />}
                          {inc.state && <span className="text-[9px] font-mono text-stone-400">{inc.state}</span>}
                          {inc.alertName && <span className="text-[9px] font-mono text-amber-600 bg-amber-50 px-1 rounded">{inc.alertName}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Knowledge Base Match */}
          {(matchedKBEntries.length > 0 || alertKBEntries.length > 0) && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-2">
                <BookOpen size={14} className="text-indigo-500" />
                Knowledge Base {matchedKBEntries.length > 0 ? 'Matches' : 'Browser'}
                {matchedKBEntries.length > 0 && <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{matchedKBEntries.length} match{matchedKBEntries.length !== 1 ? 'es' : ''}</span>}
              </h3>
              <div className="space-y-3">
                {(matchedKBEntries.length > 0 ? matchedKBEntries : alertKBEntries.slice(0, 5)).map((kb: any) => (
                  <div key={kb.key} className={clsx('rounded-xl border p-4', matchedKBEntries.includes(kb) ? 'border-emerald-200 bg-emerald-50/30' : 'border-stone-200 bg-stone-50/50')}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded">{kb.key}</span>
                        <span className="text-[10px] text-stone-400">{kb.category}</span>
                      </div>
                      <button
                        onClick={() => handleApplyKB(kb)}
                        className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-0.5 rounded transition-all"
                      >
                        Apply to RCA
                      </button>
                    </div>
                    {kb.rootCauses?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-semibold text-stone-500 mb-1">Root Causes</p>
                        {kb.rootCauses.slice(0, 2).map((rc: string, i: number) => (
                          <p key={i} className="text-xs text-stone-600 flex items-start gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-stone-400 mt-1.5 shrink-0" /> {rc}
                          </p>
                        ))}
                      </div>
                    )}
                    {kb.investigate?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-semibold text-stone-500 mb-1 flex items-center gap-1"><Terminal size={9} /> Diagnostic</p>
                        {kb.investigate.slice(0, 2).map((cmd: string, i: number) => (
                          <p key={i} className="text-[10px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded mb-0.5">{cmd}</p>
                        ))}
                      </div>
                    )}
                    {kb.remediate?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-stone-500 mb-1 flex items-center gap-1"><Zap size={9} /> Remediation</p>
                        {kb.remediate.slice(0, 2).map((rem: string, i: number) => (
                          <p key={i} className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mb-0.5">{rem}</p>
                        ))}
                      </div>
                    )}
                    {kb.blastRadius && (
                      <p className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded mt-2 inline-block">Blast: {kb.blastRadius}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Existing RCA (manual) */}
          <div className="glass-card p-5 border-violet-200/50">
            <h3 className="text-sm font-medium text-[#7C3AED] mb-3 flex items-center gap-2">
              <Target size={14} /> Manual Root Cause
            </h3>
            {prb.rootCause ? (
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{prb.rootCause}</p>
            ) : (
              <p className="text-sm text-stone-300 italic">Root cause analysis is pending investigation.</p>
            )}
            {prb.permanentFix && (
              <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-[#059669] mb-1">Permanent Fix</p>
                <p className="text-xs text-stone-600">{prb.permanentFix}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Work Notes Tab */}
      {activeTab === 'worknotes' && (
        <div className="space-y-4">
          <div className="glass-card p-4 flex gap-3">
            <input type="text" placeholder="Add a work note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddNote()} className="input-field flex-1" />
            <button onClick={handleAddNote} disabled={noteLoading || !newNote.trim()} className="btn-primary flex items-center gap-1.5">
              {noteLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Add Note
            </button>
          </div>
          {worknotes.map((note) => (
            <div key={note.id} className="glass-card p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-xs text-[#4F46E5] font-bold">
                    {note.author.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <span className="text-sm font-medium text-stone-700">{note.author}</span>
                </div>
                <span className="text-xs text-stone-300">{relativeTime(note.createdAt)}</span>
              </div>
              <p className="text-sm text-stone-500 leading-relaxed">{note.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Related Tab */}
      {activeTab === 'related' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-5">
            <h3 className="text-sm font-medium text-stone-500 mb-3 flex items-center gap-2">
              <Link2 size={14} /> Related Incidents ({relatedIncidents.length})
            </h3>
            <div className="space-y-2">
              {relatedIncidents.map((inc: any) => (
                <button key={inc.id} onClick={() => navigate(`/incidents/${inc.id}`)} className="w-full text-left p-3 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[#4F46E5] text-xs">{inc.number}</span>
                    <p className="text-sm text-stone-700 mt-0.5">{inc.title}</p>
                  </div>
                  <ChevronRight size={14} className="text-stone-300" />
                </button>
              ))}
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-medium text-stone-500 mb-3 flex items-center gap-2">
              <Link2 size={14} /> Related Changes ({relatedChanges.length})
            </h3>
            <div className="space-y-2">
              {relatedChanges.map((chg: any) => (
                <button key={chg.id} onClick={() => navigate(`/changes/${chg.id}`)} className="w-full text-left p-3 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[#4F46E5] text-xs">{chg.number}</span>
                    <p className="text-sm text-stone-700 mt-0.5">{chg.title}</p>
                  </div>
                  <ChevronRight size={14} className="text-stone-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showEditModal && <EditProblemModal problem={prb} onClose={() => setShowEditModal(false)} />}
      {showAssignModal && <AssignProblemModal problem={prb} onClose={() => setShowAssignModal(false)} />}
    </div>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const cls =
    p === 'P1' ? 'bg-red-50 text-red-600 border-red-200' :
    p === 'P2' ? 'bg-amber-50 text-amber-600 border-amber-200' :
    p === 'P3' ? 'bg-sky-50 text-sky-600 border-sky-200' :
    'bg-stone-100 text-stone-500 border-stone-200';
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold rounded-md border', cls)}>
      {p}
    </span>
  );
}
