import { useState } from 'react';
import { clsx } from 'clsx';
import {
  User, Bell, Shield, Palette, Database, Save, Loader2, Settings,
  Building2, Globe, Clock, Mail, Phone, Key, Lock, CheckCircle,
  AlertTriangle, Monitor, Moon, Sun, Eye, ChevronRight, Plus, Server,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUpdateProfile, useChangePassword } from '../../hooks/useAuth';
import { useOrganizations, useCreateOrganization, useUpdateOrganization } from '../../hooks/useOrganizations';

const TIMEZONES = [
  'Asia/Kolkata', 'UTC', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'Europe/London', 'Europe/Berlin',
  'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];

const avatarGradients = [
  'from-[#6366F1] to-[#8B5CF6]', 'from-[#10B981] to-[#14B8A6]',
  'from-[#F59E0B] to-[#F97316]', 'from-[#EF4444] to-[#EC4899]',
  'from-[#0EA5E9] to-[#6366F1]',
];

function avatarGrad(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return avatarGradients[Math.abs(h) % avatarGradients.length];
}

// ── Section wrapper ──
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
        {description && <p className="text-xs text-[#94A3B8] mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Field wrapper ──
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-[#94A3B8] mt-1">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const user = useAuthStore((s) => s.user);
  const initials = user ? `${(user.firstName?.[0] || '').toUpperCase()}${(user.lastName?.[0] || '').toUpperCase()}` : 'U';
  const grad = user ? avatarGrad(user.id) : avatarGradients[0];
  const isAdmin = user?.role === 'ADMIN';

  // ── Profile state ──
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'Asia/Kolkata');
  const updateProfile = useUpdateProfile();

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    updateProfile.mutate({ firstName, lastName, phone, department, timezone });
  }

  // ── Password state ──
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const changePassword = useChangePassword();

  function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return; }
    changePassword.mutate({ oldPassword, newPassword }, {
      onSuccess: () => { setOldPassword(''); setNewPassword(''); setConfirmPassword(''); },
    });
  }

  // ── Org data for admin ──
  const { data: orgData } = useOrganizations();
  const orgs: any[] = orgData?.data || [];
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();

  // ── Org modal state ──
  const [orgModal, setOrgModal] = useState<any | null>(null); // null = closed, {} = create, {id,...} = edit
  const [orgForm, setOrgForm] = useState({ name: '', slug: '', environment: 'PROD', serverIp: '', fqdn: '', description: '' });
  const [orgMsg, setOrgMsg] = useState<string | null>(null);

  function openOrgCreate() {
    setOrgForm({ name: '', slug: '', environment: 'PROD', serverIp: '', fqdn: '', description: '' });
    setOrgMsg(null);
    setOrgModal({});
  }

  function openOrgEdit(org: any) {
    setOrgForm({
      name: org.name || '',
      slug: org.slug || '',
      environment: org.environment || 'PROD',
      serverIp: org.serverIp || '',
      fqdn: org.fqdn || '',
      description: org.description || '',
    });
    setOrgMsg(null);
    setOrgModal(org);
  }

  function handleOrgNameChange(name: string) {
    setOrgForm(f => ({
      ...f,
      name,
      // Auto-generate slug only in create mode
      slug: orgModal?.id ? f.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    }));
  }

  function handleOrgSave() {
    setOrgMsg(null);
    if (!orgForm.name.trim() || !orgForm.slug.trim()) {
      setOrgMsg('Name and slug are required');
      return;
    }
    if (orgModal?.id) {
      updateOrg.mutate(
        { id: orgModal.id, data: { name: orgForm.name, environment: orgForm.environment, serverIp: orgForm.serverIp || null, fqdn: orgForm.fqdn || null, description: orgForm.description || null } },
        { onSuccess: () => { setOrgMsg('Organization updated'); setTimeout(() => setOrgModal(null), 800); }, onError: (err: any) => setOrgMsg(`Error: ${err?.response?.data?.error || err.message}`) },
      );
    } else {
      createOrg.mutate(
        { name: orgForm.name, slug: orgForm.slug, environment: orgForm.environment, serverIp: orgForm.serverIp || undefined, fqdn: orgForm.fqdn || undefined, description: orgForm.description || undefined },
        { onSuccess: () => { setOrgMsg('Organization created'); setTimeout(() => setOrgModal(null), 800); }, onError: (err: any) => setOrgMsg(`Error: ${err?.response?.data?.error || err.message}`) },
      );
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User, desc: 'Personal information' },
    { id: 'security', label: 'Security', icon: Shield, desc: 'Password & MFA' },
    { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Alert preferences' },
    { id: 'appearance', label: 'Appearance', icon: Palette, desc: 'Theme & display' },
    ...(isAdmin ? [{ id: 'organization', label: 'Organizations', icon: Building2, desc: 'Manage tenants' }] : []),
    { id: 'system', label: 'System', icon: Database, desc: 'Platform info' },
  ];

  return (
    <div className="animate-fade-in space-y-0">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0F172A] mb-5">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#6366F1]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-4">
            <div className={clsx('w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-xl font-bold text-white shadow-lg', grad)}>
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-0.5">
                <h1 className="font-display text-2xl font-bold text-white tracking-tight">Settings</h1>
                <span className="text-[9px] font-mono font-bold text-[#818CF8] bg-[#6366F1]/15 px-1.5 py-0.5 rounded border border-[#6366F1]/20">{user?.role}</span>
              </div>
              <p className="text-[#94A3B8] text-sm">{user?.email} &middot; {user?.timezone || 'Asia/Kolkata'}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-[#6366F1]/60 to-transparent -mt-5 mb-4" />

      <div className="flex gap-6">
        {/* ── Tab nav ── */}
        <div className="w-56 shrink-0 space-y-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                  activeTab === tab.id
                    ? 'bg-[#EEF2FF] border border-[#C7D2FE] shadow-sm'
                    : 'hover:bg-[#F8FAFC] border border-transparent'
                )}
              >
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  activeTab === tab.id ? 'bg-[#6366F1] text-white' : 'bg-[#F1F5F9] text-[#94A3B8]'
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className={clsx('text-sm font-medium truncate', activeTab === tab.id ? 'text-[#0F172A]' : 'text-[#64748B]')}>{tab.label}</p>
                  <p className="text-[10px] text-[#94A3B8] truncate">{tab.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">

          {/* ── PROFILE ── */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSave} className="space-y-6">
              <Section title="Profile Information" description="Update your personal details and contact information">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-[#FAFBFC] border border-[#F1F5F9]">
                  <div className={clsx('w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center text-xl font-bold text-white shadow-md', grad)}>
                    {initials}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#0F172A]">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-[#94A3B8]">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded border',
                        user?.role === 'ADMIN' ? 'bg-[#FEF2F2] text-[#EF4444] border-[#FECACA]' :
                        user?.role === 'MANAGER' ? 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]' :
                        'bg-[#EEF2FF] text-[#6366F1] border-[#C7D2FE]'
                      )}>{user?.role}</span>
                      {user?.mfaEnabled && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0] flex items-center gap-0.5">
                          <Shield className="w-2.5 h-2.5" /> MFA
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Section>

              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name">
                  <input className="input-field" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                </Field>
                <Field label="Last Name">
                  <input className="input-field" value={lastName} onChange={e => setLastName(e.target.value)} required />
                </Field>
                <Field label="Email">
                  <input className="input-field bg-[#F8FAFC] cursor-not-allowed" value={user?.email ?? ''} disabled />
                </Field>
                <Field label="Phone">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                    <input className="input-field pl-9" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                  </div>
                </Field>
                <Field label="Department">
                  <input className="input-field" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. DevOps, Network" />
                </Field>
                <Field label="Timezone">
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                    <select className="input-field pl-9" value={timezone} onChange={e => setTimezone(e.target.value)}>
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </Field>
              </div>

              <button type="submit" disabled={updateProfile.isPending} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                {updateProfile.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
              {updateProfile.isSuccess && <p className="text-xs text-[#10B981] flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Profile updated successfully</p>}
            </form>
          )}

          {/* ── SECURITY ── */}
          {activeTab === 'security' && (
            <div className="space-y-8">
              <Section title="Change Password" description="Update your account password regularly for security">
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  <Field label="Current Password">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                      <input className="input-field pl-9" type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required autoComplete="current-password" />
                    </div>
                  </Field>
                  <Field label="New Password" hint="Minimum 8 characters with mixed case and numbers">
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                      <input className="input-field pl-9" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" />
                    </div>
                  </Field>
                  <Field label="Confirm Password">
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                      <input className="input-field pl-9" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
                    </div>
                  </Field>
                  {pwError && <p className="text-xs text-[#EF4444] flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {pwError}</p>}
                  {changePassword.isSuccess && <p className="text-xs text-[#10B981] flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Password updated successfully</p>}
                  <button type="submit" disabled={changePassword.isPending} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                    {changePassword.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : 'Update Password'}
                  </button>
                </form>
              </Section>

              <div className="border-t border-[#F1F5F9]" />

              <Section title="Two-Factor Authentication" description="Add an extra layer of security using TOTP authenticator">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#FAFBFC] border border-[#F1F5F9]">
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', user?.mfaEnabled ? 'bg-[#ECFDF5]' : 'bg-[#FEF2F2]')}>
                      <Shield className={clsx('w-5 h-5', user?.mfaEnabled ? 'text-[#10B981]' : 'text-[#EF4444]')} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {user?.mfaEnabled ? 'MFA is enabled' : 'MFA is disabled'}
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        {user?.mfaEnabled ? 'Your account is protected with TOTP authentication' : 'Enable MFA to secure your account against unauthorized access'}
                      </p>
                    </div>
                  </div>
                  <button className={clsx('btn-primary text-sm', user?.mfaEnabled ? 'bg-[#EF4444] hover:bg-[#DC2626]' : '')}>
                    {user?.mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
                  </button>
                </div>
              </Section>

              <div className="border-t border-[#F1F5F9]" />

              <Section title="Active Sessions" description="Manage your active login sessions">
                <div className="space-y-2">
                  {[
                    { device: 'Chrome on Linux', ip: '103.231.79.231', current: true, time: 'Current session' },
                    { device: 'Firefox on Windows', ip: '49.249.139.196', current: false, time: '2 hours ago' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[#FAFBFC] border border-[#F1F5F9]">
                      <div className="flex items-center gap-3">
                        <Monitor className="w-4 h-4 text-[#94A3B8]" />
                        <div>
                          <p className="text-sm font-medium text-[#0F172A]">
                            {s.device} {s.current && <span className="text-[9px] font-bold px-1 py-0.5 ml-1 rounded bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]">CURRENT</span>}
                          </p>
                          <p className="text-[10px] text-[#94A3B8] font-mono">{s.ip} &middot; {s.time}</p>
                        </div>
                      </div>
                      {!s.current && (
                        <button className="text-xs text-[#EF4444] hover:bg-[#FEF2F2] px-2.5 py-1 rounded-lg transition-colors font-medium">Revoke</button>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <Section title="Notification Preferences" description="Configure how and when you receive alerts">
                <div className="space-y-1">
                  {[
                    { label: 'P1 Critical Incidents', desc: 'SMS + Voice Call + Slack + Email', default: true, critical: true },
                    { label: 'P2 High Incidents', desc: 'SMS + Slack + Email', default: true, critical: false },
                    { label: 'P3/P4 Incidents', desc: 'Email + In-app notification', default: true, critical: false },
                    { label: 'Change Approvals', desc: 'Email + Slack when approval needed', default: true, critical: false },
                    { label: 'SLA Breach Warnings', desc: 'Alert at 80% of SLA threshold', default: true, critical: true },
                    { label: 'Asset Health Alerts', desc: 'When monitored assets go critical', default: true, critical: false },
                    { label: 'On-Call Reminders', desc: 'Notify before on-call shift starts', default: false, critical: false },
                    { label: 'Daily Digest', desc: 'Morning summary at 9:00 AM IST', default: false, critical: false },
                    { label: 'Weekly Report', desc: 'Team performance report every Monday', default: false, critical: false },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-[#FAFBFC] transition-colors">
                      <div className="flex items-center gap-3">
                        {item.critical && <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />}
                        <div>
                          <p className="text-sm font-medium text-[#0F172A]">{item.label}</p>
                          <p className="text-xs text-[#94A3B8]">{item.desc}</p>
                        </div>
                      </div>
                      <div className={clsx(
                        'w-10 h-5 rounded-full transition-colors cursor-pointer flex items-center px-0.5',
                        item.default ? 'bg-[#6366F1]' : 'bg-[#CBD5E1]'
                      )}>
                        <div className={clsx(
                          'w-4 h-4 rounded-full transition-transform bg-white shadow-sm',
                          item.default ? 'translate-x-5' : 'translate-x-0'
                        )} />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <div className="border-t border-[#F1F5F9]" />

              <Section title="Escalation Settings" description="Define your escalation chain preferences">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Escalation Timeout">
                    <select className="input-field">
                      <option>5 minutes</option><option>10 minutes</option><option>15 minutes</option><option>30 minutes</option>
                    </select>
                  </Field>
                  <Field label="Preferred Channel">
                    <select className="input-field">
                      <option>Slack DM</option><option>SMS</option><option>Voice Call</option><option>Email</option>
                    </select>
                  </Field>
                </div>
              </Section>
            </div>
          )}

          {/* ── APPEARANCE ── */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <Section title="Theme" description="Choose your preferred interface theme">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'light', label: 'Light', icon: Sun, desc: 'Clean white background', selected: true, preview: 'bg-white border-[#E2E8F0]' },
                    { id: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes', selected: false, preview: 'bg-[#0F172A] border-[#334155]' },
                    { id: 'auto', label: 'System', icon: Monitor, desc: 'Follows OS setting', selected: false, preview: 'bg-gradient-to-r from-white to-[#0F172A] border-[#94A3B8]' },
                  ].map(theme => {
                    const Icon = theme.icon;
                    return (
                      <div
                        key={theme.id}
                        className={clsx(
                          'p-4 rounded-xl border-2 cursor-pointer transition-all',
                          theme.selected ? 'border-[#6366F1] bg-[#EEF2FF] shadow-sm' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                        )}
                      >
                        <div className={clsx('w-full h-12 rounded-lg border mb-3', theme.preview)} />
                        <div className="flex items-center gap-2">
                          <Icon className={clsx('w-4 h-4', theme.selected ? 'text-[#6366F1]' : 'text-[#94A3B8]')} />
                          <div>
                            <p className={clsx('text-sm font-medium', theme.selected ? 'text-[#0F172A]' : 'text-[#64748B]')}>{theme.label}</p>
                            <p className="text-[10px] text-[#94A3B8]">{theme.desc}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <div className="border-t border-[#F1F5F9]" />

              <Section title="Display" description="Adjust interface density and sizing">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Density">
                    <select className="input-field"><option>Comfortable</option><option>Compact</option><option>Spacious</option></select>
                  </Field>
                  <Field label="Sidebar">
                    <select className="input-field"><option>Expanded</option><option>Collapsed by default</option></select>
                  </Field>
                  <Field label="Date Format">
                    <select className="input-field"><option>DD/MM/YYYY (Indian)</option><option>MM/DD/YYYY (US)</option><option>YYYY-MM-DD (ISO)</option></select>
                  </Field>
                  <Field label="Time Format">
                    <select className="input-field"><option>12-hour (AM/PM)</option><option>24-hour</option></select>
                  </Field>
                </div>
              </Section>
            </div>
          )}

          {/* ── ORGANIZATIONS (Admin only) ── */}
          {activeTab === 'organization' && isAdmin && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Section title="Organizations" description={`Managing ${orgs.length} client organizations across environments`}>
                  <></>
                </Section>
                <button onClick={openOrgCreate} className="btn-primary flex items-center gap-2 shrink-0">
                  <Plus className="w-4 h-4" /> Create Organization
                </button>
              </div>
              <div className="space-y-2">
                {orgs.map((org: any) => (
                  <div
                    key={org.id}
                    onClick={() => openOrgEdit(org)}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAFBFC] border border-[#F1F5F9] hover:border-[#C7D2FE] hover:shadow-sm transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#0F172A]">{org.name}</p>
                          <span className={clsx('text-[8px] font-bold px-1.5 py-0.5 rounded',
                            org.environment === 'PROD' ? 'bg-[#ECFDF5] text-[#10B981]' :
                            org.environment === 'DR' ? 'bg-[#FEF3C7] text-[#D97706]' :
                            org.environment === 'UAT' ? 'bg-[#EEF2FF] text-[#6366F1]' :
                            'bg-[#F1F5F9] text-[#64748B]'
                          )}>{org.environment}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-[#94A3B8] font-mono">{org.slug}</span>
                          {org.serverIp && <span className="text-[10px] text-[#94A3B8]">{org.serverIp}</span>}
                          {org.fqdn && <span className="text-[10px] text-[#0EA5E9]">{org.fqdn}</span>}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#CBD5E1] group-hover:text-[#6366F1] transition-colors" />
                  </div>
                ))}
                {orgs.length === 0 && (
                  <div className="text-center py-8 text-[#94A3B8]">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-[#CBD5E1]" />
                    <p className="text-sm">No organizations found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SYSTEM ── */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <Section title="Platform Information" description="WeCrew ITSM system details and version info">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Eye,      label: 'Platform',     value: 'WeCrew ITSM' },
                    { icon: Globe,    label: 'API',          value: '/api/v1' },
                    { icon: Database, label: 'Database',     value: 'PostgreSQL 16.2' },
                    { icon: Database, label: 'Cache',        value: 'Redis 7.2' },
                    { icon: Shield,   label: 'AI Backend',   value: 'Ollama (Qwen3-32B)' },
                    { icon: Mail,     label: 'Voice',        value: 'XTTS v2 + Whisper' },
                    { icon: Globe,    label: 'Runtime',      value: 'Node.js v20.20.0' },
                    { icon: Monitor,  label: 'Environment',  value: 'Production' },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center gap-3 p-3.5 rounded-xl bg-[#FAFBFC] border border-[#F1F5F9]">
                        <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-[#94A3B8]" />
                        </div>
                        <div>
                          <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-medium">{item.label}</p>
                          <p className="text-sm font-mono font-medium text-[#0F172A]">{item.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <div className="border-t border-[#F1F5F9]" />

              <Section title="Integrations Summary">
                <div className="flex items-center gap-4">
                  {[
                    { label: 'Monitoring', desc: 'Prometheus + Grafana + Loki' },
                    { label: 'Orchestration', desc: 'K8s + StackStorm + n8n' },
                    { label: 'Communications', desc: 'Slack + Twilio + MSG91 + Apprise' },
                    { label: 'ITSM', desc: 'PagerDuty + Jira + ServiceNow' },
                  ].map(s => (
                    <div key={s.label} className="flex-1 p-3 rounded-xl bg-[#FAFBFC] border border-[#F1F5F9]">
                      <p className="text-xs font-semibold text-[#0F172A] mb-0.5">{s.label}</p>
                      <p className="text-[10px] text-[#94A3B8]">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ORG CREATE / EDIT MODAL                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {orgModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setOrgModal(null)}>
          <div className="absolute inset-0 bg-[#0F172A]/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl border border-[#E2E8F0] p-6 w-full max-w-lg animate-slide-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0F172A]">{orgModal?.id ? 'Edit Organization' : 'Create Organization'}</h2>
                  <p className="text-xs text-[#94A3B8]">{orgModal?.id ? `Editing ${orgModal.name}` : 'Add a new client organization to the platform'}</p>
                </div>
              </div>
              <button onClick={() => setOrgModal(null)} className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Organization Name">
                  <input className="input-field" placeholder="e.g. IndMoney Production" value={orgForm.name} onChange={e => handleOrgNameChange(e.target.value)} required />
                </Field>
                <Field label="Slug" hint={orgModal?.id ? 'Cannot change slug after creation' : 'Auto-generated from name'}>
                  <input className="input-field font-mono" placeholder="e.g. indmoney-prod" value={orgForm.slug} onChange={e => setOrgForm(f => ({ ...f, slug: e.target.value }))} disabled={!!orgModal?.id} required />
                </Field>
              </div>

              <Field label="Environment">
                <select className="input-field" value={orgForm.environment} onChange={e => setOrgForm(f => ({ ...f, environment: e.target.value }))}>
                  <option value="PROD">Production</option>
                  <option value="DR">Disaster Recovery</option>
                  <option value="UAT">UAT / Staging</option>
                  <option value="DEV">Development</option>
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Server IP" hint="Public IP for SSH access">
                  <div className="relative">
                    <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                    <input className="input-field pl-9" placeholder="154.210.170.126" value={orgForm.serverIp} onChange={e => setOrgForm(f => ({ ...f, serverIp: e.target.value }))} />
                  </div>
                </Field>
                <Field label="FQDN" hint="Ingress URL / domain">
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                    <input className="input-field pl-9" placeholder="app.example.com" value={orgForm.fqdn} onChange={e => setOrgForm(f => ({ ...f, fqdn: e.target.value }))} />
                  </div>
                </Field>
              </div>

              <Field label="Description">
                <textarea className="input-field min-h-[60px] resize-none" placeholder="Brief description of this organization..." value={orgForm.description} onChange={e => setOrgForm(f => ({ ...f, description: e.target.value }))} />
              </Field>
            </div>

            {/* Feedback */}
            {orgMsg && (
              <div className={clsx('mt-4 p-3 rounded-lg text-sm flex items-center gap-2',
                orgMsg.startsWith('Error') ? 'bg-[#FEF2F2] text-[#EF4444] border border-[#FECACA]' : 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]'
              )}>
                {orgMsg.startsWith('Error') ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
                {orgMsg}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#F1F5F9]">
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
                disabled={createOrg.isPending || updateOrg.isPending}
                onClick={handleOrgSave}
              >
                {(createOrg.isPending || updateOrg.isPending) ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> {orgModal?.id ? 'Update Organization' : 'Create Organization'}</>
                )}
              </button>
              <button onClick={() => setOrgModal(null)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
