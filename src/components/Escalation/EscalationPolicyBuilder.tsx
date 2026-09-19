import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Save, Mail, MessageSquare, Phone, Zap, Bell,
  CheckCircle, AlertCircle, Loader2, Users, Clock, Shield,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../lib/api';
import { Page, Toolbar, Panel, GhostButton } from '../ui/PageChrome';

interface Rule { level: number; delayMinutes: number; notifyType: string; notifyTargets: string; }
interface Policy { id: string; name: string; description?: string; isActive: boolean; rules: Rule[]; }
interface Team { id: string; name: string; organizationId?: string; }

const NOTIFY_TYPES = [
  { value: 'SMS_NOTIFY',   label: 'SMS',          icon: MessageSquare, color: '#0f7a55', bg: 'rgba(15,122,85,0.10)',  border: 'rgba(15,122,85,0.22)' },
  { value: 'VOICE_NOTIFY', label: 'Voice',        icon: Phone,         color: '#2b4cff', bg: 'rgba(43,76,255,0.10)',  border: 'rgba(43,76,255,0.22)' },
  { value: 'EMAIL_NOTIFY', label: 'Email',        icon: Mail,          color: '#d97706', bg: 'rgba(217,119,6,0.10)',  border: 'rgba(217,119,6,0.22)' },
  { value: 'SLACK_NOTIFY', label: 'Slack',        icon: Zap,           color: '#ff5b2e', bg: 'rgba(255,91,46,0.10)',  border: 'rgba(255,91,46,0.22)' },
  { value: 'ALL',          label: 'All channels', icon: Bell,          color: '#dc2626', bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.22)' },
];

const emptyRule = (): Rule => ({ level: 1, delayMinutes: 5, notifyType: 'SMS_NOTIFY', notifyTargets: '' });

function RuleCard({
  rule, index, total, onChange, onRemove,
}: { rule: Rule; index: number; total: number; onChange: (r: Rule) => void; onRemove: () => void; }) {
  const nt = NOTIFY_TYPES.find(n => n.value === rule.notifyType) || NOTIFY_TYPES[0];
  const Icon = nt.icon;

  return (
    <div className="relative">
      {index > 0 && (
        <div className="flex flex-col items-center mb-0 -mt-1">
          <div className="w-px h-4 bg-[color:var(--argus-border)]" />
          <div
            className="flex items-center gap-2 py-1.5 px-3 rounded-full text-[10px] font-mono font-bold bg-signal-dim text-signal"
            style={{ border: '1px solid color-mix(in srgb, var(--argus-signal) 25%, transparent)' }}
          >
            <Clock className="w-3 h-3" />
            Wait {rule.delayMinutes} min if no response
          </div>
          <div className="w-px h-4 bg-[color:var(--argus-border)]" />
          <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[color:var(--argus-border)] -mt-0.5" />
        </div>
      )}

      <div className="rounded-xl border border-steel bg-[color:var(--argus-surface)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-steel">
          <div className="flex items-center gap-2.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black"
              style={{ background: nt.bg, border: `1px solid ${nt.border}`, color: nt.color }}
            >
              {index + 1}
            </div>
            <span className="text-sm font-semibold text-ink">Level {index + 1}</span>
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: nt.bg, border: `1px solid ${nt.border}`, color: nt.color }}
            >
              <Icon className="w-3 h-3" />
              {nt.label}
            </div>
          </div>
          {total > 1 && (
            <button
              type="button"
              onClick={onRemove}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-crimson hover:bg-crimson-dim transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                {index === 0 ? 'Trigger after (min)' : 'Escalate after (min)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={480}
                  value={rule.delayMinutes}
                  onChange={e => onChange({ ...rule, delayMinutes: parseInt(e.target.value) || 0 })}
                  className="input-field font-mono pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-dim">min</span>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                Notification channel
              </label>
              <select
                value={rule.notifyType}
                onChange={e => onChange({ ...rule, notifyType: e.target.value })}
                className="filter-select w-full"
              >
                {NOTIFY_TYPES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Contact targets{' '}
              <span className="text-dim normal-case">(phone numbers, emails, or user IDs — comma-separated)</span>
            </label>
            <input
              type="text"
              value={rule.notifyTargets}
              onChange={e => onChange({ ...rule, notifyTargets: e.target.value })}
              placeholder="+91-9876543210, engineer@acme.com, user-uuid"
              className="input-field"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PolicyForm({ teamId, policy, onSaved, onCancel }: {
  teamId: string; policy?: Policy | null; onSaved: () => void; onCancel: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!policy;
  const [name, setName] = useState(policy?.name || '');
  const [desc, setDesc] = useState(policy?.description || '');
  const [rules, setRules] = useState<Rule[]>(
    policy?.rules?.length ? policy.rules : [{ ...emptyRule(), level: 1 }]
  );
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name, description: desc, rules: rules.map((r, i) => ({ ...r, level: i + 1 })) };
      if (isEdit) {
        return api.put(`/teams/${teamId}/escalation-policies/${policy!.id}`, payload);
      }
      return api.post(`/teams/${teamId}/escalation-policies`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-escalation', teamId] });
      setToast({ ok: true, msg: isEdit ? 'Policy updated' : 'Policy created successfully' });
      setTimeout(onSaved, 1200);
    },
    onError: (e: any) => setToast({ ok: false, msg: e?.response?.data?.error || 'Save failed' }),
  });

  const addRule = () => setRules(r => [...r, { ...emptyRule(), level: r.length + 1 }]);
  const removeRule = (i: number) => setRules(r => r.filter((_, idx) => idx !== i));
  const updateRule = (i: number, updated: Rule) => setRules(r => r.map((x, idx) => idx === i ? updated : x));

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
            Policy name *
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. P1 Critical Escalation"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
            Description <span className="text-dim normal-case">(optional)</span>
          </label>
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="When does this policy activate?"
            className="input-field"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Escalation levels</span>
          <span className="text-[10px] text-dim">{rules.length} level{rules.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="space-y-0">
          {rules.map((rule, i) => (
            <RuleCard
              key={i}
              rule={rule}
              index={i}
              total={rules.length}
              onChange={r => updateRule(i, r)}
              onRemove={() => removeRule(i)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addRule}
          className="cx-btn cx-btn--ghost mt-4 w-full"
          style={{ borderStyle: 'dashed' }}
        >
          <Plus className="w-4 h-4" />
          Add escalation level
        </button>
      </div>

      {toast && (
        <div className={clsx(
          'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm',
          toast.ok ? 'bg-emerald-dim text-emerald' : 'bg-crimson-dim text-crimson',
        )}>
          {toast.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={!name.trim() || save.isPending}
          className="cx-btn cx-btn--primary flex-1 disabled:opacity-50"
        >
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEdit ? 'Update policy' : 'Save policy'}
        </button>
        <button type="button" onClick={onCancel} className="cx-btn cx-btn--ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function EscalationPolicyBuilder() {
  const qc = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [editPolicy, setEditPolicy] = useState<Policy | null | 'new'>('new');

  const { data: teamsData } = useQuery({
    queryKey: ['teams-list'],
    queryFn: () => api.get('/teams').then(r => r.data),
  });
  const teams: Team[] = teamsData?.data || [];

  const { data: polData, isLoading: loadingPolicies } = useQuery({
    queryKey: ['team-escalation', selectedTeam],
    queryFn: () => api.get(`/teams/${selectedTeam}/escalation`).then(r => r.data),
    enabled: !!selectedTeam,
  });
  const policies: Policy[] = polData?.data || [];

  const deletePolicy = useMutation({
    mutationFn: (policyId: string) => api.delete(`/teams/${selectedTeam}/escalation-policies/${policyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-escalation', selectedTeam] }),
  });

  const activeTeam = teams.find(t => t.id === selectedTeam);
  const activePolicies = policies.filter(p => p.isActive).length;
  const totalLevels = policies.reduce((sum, p) => sum + p.rules.length, 0);

  const kpis = [
    { label: 'Policies', value: selectedTeam ? policies.length : '—', sub: selectedTeam ? 'for this team' : 'pick a team' },
    { label: 'Active', value: selectedTeam ? activePolicies : '—', sub: 'currently in force' },
    { label: 'Teams', value: teams.length, sub: 'that can hold a policy' },
    { label: 'Levels', value: selectedTeam ? totalLevels : '—', sub: 'across all policies' },
  ];

  return (
    <Page>
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="cx-eyebrow">Respond · escalation</span>
            <h1 className="cx-hero__title">Escalation</h1>
            <p className="cx-hero__deck">
              Who gets notified, how, and how long to wait before the next person. An empty chain
              is the one failure this page exists to catch.
            </p>
          </div>
          <Link to="/oncall" className="cx-hero__btn cx-hero__btn--ghost">
            On-call rota
          </Link>
        </div>
        <dl className="cx-hero__kpis mt-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="cx-hero__kpi">
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
        <Link to="/oncall">On-call</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Escalation</span>
      </nav>

      <Toolbar>
        <div className="flex items-center gap-2">
          <Users size={14} className="text-dim" />
          <span className="text-[10px] font-bold text-dim uppercase tracking-widest">Team</span>
        </div>
        <select
          value={selectedTeam}
          onChange={e => { setSelectedTeam(e.target.value); setEditPolicy('new'); }}
          className={clsx('filter-select min-w-[220px]', selectedTeam && 'filter-select--active')}
        >
          <option value="">— choose a team —</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {loadingPolicies && <Loader2 size={14} className="animate-spin text-dim" />}
      </Toolbar>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4">
          <Panel
            title="Policies"
            actions={selectedTeam ? (
              <GhostButton active={editPolicy === 'new'} onClick={() => setEditPolicy('new')}>
                <Plus size={12} />
                New
              </GhostButton>
            ) : undefined}
          >
            {!selectedTeam ? (
              <div className="py-10 text-center">
                <Users size={28} className="mx-auto mb-2 text-graphite" strokeWidth={1.75} />
                <p className="text-sm text-dim">Select a team above</p>
              </div>
            ) : loadingPolicies ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-dim" />
              </div>
            ) : policies.length === 0 ? (
              <div className="py-10 text-center">
                <Shield size={28} className="mx-auto mb-2 text-graphite" strokeWidth={1.75} />
                <p className="text-sm text-dim">No policies yet</p>
                <p className="text-[10px] text-graphite mt-0.5">Create one to enable escalation</p>
              </div>
            ) : (
              <div className="space-y-2">
                {policies.map(p => {
                  const isSelected = editPolicy && typeof editPolicy === 'object' && editPolicy.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEditPolicy(p)}
                      className={clsx(
                        'w-full text-left rounded-xl px-4 py-3 transition-all border',
                        isSelected
                          ? 'bg-signal-dim border-signal'
                          : 'bg-[color:var(--argus-elevated)] border-steel hover:bg-[color:var(--argus-surface)]',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-ink truncate">{p.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {p.isActive && <span className="cx-pill cx-pill--ok">Active</span>}
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); if (confirm(`Delete "${p.name}"?`)) deletePolicy.mutate(p.id); }}
                            className="p-1 rounded text-dim hover:text-crimson hover:bg-crimson-dim transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-dim font-mono mb-2">
                        {p.rules.length} level{p.rules.length !== 1 ? 's' : ''}
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {p.rules.map((r, i) => {
                          const nt = NOTIFY_TYPES.find(n => n.value === r.notifyType);
                          const Icon = nt?.icon || Bell;
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ background: nt?.bg, color: nt?.color, border: `1px solid ${nt?.border}` }}
                            >
                              <Icon className="w-2.5 h-2.5" />
                              L{r.level} {r.delayMinutes}m
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-8">
          <Panel
            title={editPolicy === 'new' ? 'New policy' : typeof editPolicy === 'object' ? editPolicy?.name : 'Policy editor'}
            titleExtra={selectedTeam && activeTeam ? (
              <span className="text-[10px] text-dim font-mono ml-2">{activeTeam.name}</span>
            ) : undefined}
          >
            {!selectedTeam ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Users size={28} className="text-graphite mb-2" strokeWidth={1.75} />
                <p className="text-sm text-dim">Select a team to manage its escalation policies</p>
              </div>
            ) : (
              (editPolicy === 'new' || typeof editPolicy === 'object') && (
                <PolicyForm
                  key={typeof editPolicy === 'object' ? editPolicy?.id : 'new'}
                  teamId={selectedTeam}
                  policy={typeof editPolicy === 'object' ? editPolicy : null}
                  onSaved={() => setEditPolicy('new')}
                  onCancel={() => setEditPolicy('new')}
                />
              )
            )}
          </Panel>
        </div>
      </div>
    </Page>
  );
}
