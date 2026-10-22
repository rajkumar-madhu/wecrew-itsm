// ═══════════════════════════════════════════════════════════
// Argus ITSM — Single sign-on settings (org admins)
// One OpenID Connect identity provider per organization.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Copy, Check, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

interface SsoConfig {
  configured: boolean;
  enabled: boolean;
  issuer: string;
  clientId: string;
  hasClientSecret: boolean;
  domains: string[];
  defaultRole: string;
  autoProvision: boolean;
  enforce: boolean;
  redirectUri: string;
}

const ROLE_OPTIONS = [
  { value: 'REQUESTER', label: 'Requester — self-service portal only' },
  { value: 'VIEWER', label: 'Viewer — read-only console' },
  { value: 'OPERATOR', label: 'Operator' },
  { value: 'ENGINEER', label: 'Engineer' },
  { value: 'MANAGER', label: 'Manager' },
];

function errMsg(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string; details?: { msg?: string }[] } } };
  return e?.response?.data?.error || e?.response?.data?.details?.[0]?.msg || fallback;
}

const input = 'w-full px-3 py-2 text-[13px] rounded-lg bg-[#0F1B2D] border border-[rgba(99,179,255,0.12)] text-[#E8F1FA] placeholder:text-[#5A7D99] focus:outline-none focus:border-[#818CF8]';
const label = 'block text-xs font-semibold text-[#8AABC4] mb-1.5 uppercase tracking-wider';

export default function SsoPanel() {
  const selectedOrgId = useAuthStore((s) => s.selectedOrgId);
  const qc = useQueryClient();
  const key = ['sso-config', selectedOrgId];
  const { data, isLoading, error } = useQuery<SsoConfig>({
    queryKey: key,
    queryFn: async () => (await api.get('/auth/sso/config')).data.data,
    retry: false,
  });

  if (isLoading) return <p className="text-[13px] text-[#8AABC4] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;
  if (error || !data) return <p className="text-[13px] text-[#F59E0B]">{errMsg(error, 'Select an organization to configure single sign-on.')}</p>;
  // Re-mount the form whenever a save returns new server state
  return <SsoForm key={JSON.stringify(data)} data={data} onSaved={(saved) => qc.setQueryData(key, saved)} />;
}

function SsoForm({ data, onSaved }: { data: SsoConfig; onSaved: (c: SsoConfig) => void }) {
  const [form, setForm] = useState({
    issuer: data.issuer, clientId: data.clientId, clientSecret: '', domains: data.domains.join(', '),
    defaultRole: data.defaultRole, autoProvision: data.autoProvision, enabled: data.enabled, enforce: data.enforce,
  });
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const save = useMutation({
    mutationFn: async () => (await api.put('/auth/sso/config', {
      ...form,
      domains: form.domains.split(/[\s,]+/).filter(Boolean),
      clientSecret: form.clientSecret || undefined,
      enforce: form.enabled && form.enforce,
    })).data.data as SsoConfig,
    onSuccess: (saved) => { onSaved(saved); toast.success(saved.enabled ? 'Single sign-on is on' : 'Single sign-on settings saved'); },
    onError: (err) => toast.error(errMsg(err, 'Could not save the settings')),
  });

  const remove = useMutation({
    mutationFn: async () => (await api.delete('/auth/sso/config')).data.data as SsoConfig,
    onSuccess: (cleared) => { onSaved(cleared); toast.success('Single sign-on removed'); },
    onError: (err) => toast.error(errMsg(err, 'Could not remove the settings')),
  });

  const test = useMutation({
    mutationFn: async () => (await api.post('/auth/sso/config/test', { issuer: form.issuer })).data.data as { ok: boolean; issuer?: string; error?: string },
    onSuccess: (r) => setTestResult(r.ok ? { ok: true, text: `Reached ${r.issuer}` } : { ok: false, text: r.error || 'Not reachable' }),
    onError: (err) => setTestResult({ ok: false, text: errMsg(err, 'Test failed') }),
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="space-y-4 max-w-2xl"
      onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
    >
      <div className="rounded-xl p-3.5 bg-[#0F1B2D] border border-[rgba(99,179,255,0.12)]">
        <p className="text-[12px] text-[#C5D8E8]">Register Argus in your identity provider (Okta, Microsoft Entra ID, Google Workspace, Keycloak…) as an OpenID Connect web app with this redirect URI:</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate text-[12px] font-mono text-[#E8F1FA] bg-[#060A14] px-2 py-1.5 rounded">{data.redirectUri}</code>
          <button
            type="button"
            aria-label="Copy redirect URI"
            onClick={() => { navigator.clipboard?.writeText(data.redirectUri); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="p-1.5 rounded-lg border border-[rgba(99,179,255,0.12)] text-[#8AABC4] hover:text-[#E8F1FA]"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="sso-issuer" className={label}>Issuer URL</label>
        <div className="flex gap-2">
          <input id="sso-issuer" className={input} value={form.issuer} onChange={(e) => { set('issuer', e.target.value); setTestResult(null); }}
            placeholder="https://acme.okta.com" required />
          <button type="button" onClick={() => test.mutate()} disabled={!form.issuer || test.isPending}
            className="shrink-0 px-3 py-2 text-[12px] font-semibold rounded-lg border border-[rgba(99,179,255,0.2)] text-[#C5D8E8] hover:text-[#E8F1FA] disabled:opacity-50">
            {test.isPending ? 'Testing…' : 'Test'}
          </button>
        </div>
        {testResult && (
          <p className={`text-[12px] mt-1.5 flex items-center gap-1 ${testResult.ok ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
            {testResult.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />} {testResult.text}
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="sso-client-id" className={label}>Client ID</label>
          <input id="sso-client-id" className={input} value={form.clientId} onChange={(e) => set('clientId', e.target.value)} required autoComplete="off" />
        </div>
        <div>
          <label htmlFor="sso-client-secret" className={label}>Client secret</label>
          <input id="sso-client-secret" type="password" className={input} value={form.clientSecret} onChange={(e) => set('clientSecret', e.target.value)}
            placeholder={data.hasClientSecret ? 'Saved — leave blank to keep' : ''} required={!data.hasClientSecret} autoComplete="new-password" />
        </div>
      </div>

      <div>
        <label htmlFor="sso-domains" className={label}>Email domains</label>
        <input id="sso-domains" className={input} value={form.domains} onChange={(e) => set('domains', e.target.value)} placeholder="acme.com, acme.co.in" required />
        <p className="text-[11px] text-[#8AABC4] mt-1">People with these addresses sign in through your provider. Public mail domains (gmail.com…) aren't allowed.</p>
      </div>

      <div>
        <label htmlFor="sso-role" className={label}>Role for new users</label>
        <select id="sso-role" className={input} value={form.defaultRole} onChange={(e) => set('defaultRole', e.target.value)}>
          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div className="space-y-2.5">
        <Toggle id="sso-provision" checked={form.autoProvision} onChange={(v) => set('autoProvision', v)}
          title="Create accounts on first sign-in" hint="Otherwise an admin must add each user before they can sign in." />
        <Toggle id="sso-enabled" checked={form.enabled} onChange={(v) => set('enabled', v)}
          title="Enable single sign-on" hint="Shows 'Sign in with SSO' for these domains. The issuer is checked before saving." />
        <Toggle id="sso-enforce" checked={form.enabled && form.enforce} disabled={!form.enabled} onChange={(v) => set('enforce', v)}
          title="Require single sign-on" hint="Turns off password sign-in for these domains. Test SSO with your own account first." />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={save.isPending} className="btn-primary flex items-center gap-2 disabled:opacity-60">
          {save.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save'}
        </button>
        {data.configured && (
          <button type="button" disabled={remove.isPending}
            onClick={() => { if (window.confirm('Remove single sign-on? Users will sign in with passwords again.')) remove.mutate(); }}
            className="px-3 py-2 text-[13px] font-semibold rounded-lg text-[#F87171] border border-[#F87171]/30 hover:bg-[#F87171]/10 disabled:opacity-60">
            Remove
          </button>
        )}
        <span className="text-[12px] text-[#8AABC4]">Status: {data.enabled ? (data.enforce ? 'on, required' : 'on') : 'off'}</span>
      </div>
    </form>
  );
}

function Toggle({ id, checked, onChange, title, hint, disabled }: {
  id: string; checked: boolean; onChange: (v: boolean) => void; title: string; hint: string; disabled?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-[#6366F1]" />
      <label htmlFor={id}>
        <span className="block text-[13px] font-medium text-[#E8F1FA]">{title}</span>
        <span className="block text-[11px] text-[#8AABC4]">{hint}</span>
      </label>
    </div>
  );
}
