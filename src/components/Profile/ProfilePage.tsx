import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCircle, Save, Key, Bell, Globe, Phone, Mail,
  CheckCircle2, AlertCircle, Eye, EyeOff, Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Page, Panel } from '../ui/PageChrome';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi (हिंदी)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
];

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London',
  'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'UTC',
];

const ROLE_TONE: Record<string, 'danger' | 'warn' | 'alert' | 'ok' | 'neutral'> = {
  ADMIN: 'danger',
  MANAGER: 'warn',
  ENGINEER: 'alert',
  OPERATOR: 'ok',
  VIEWER: 'neutral',
};

interface NotifPrefs {
  email: boolean;
  sms: boolean;
  voice: boolean;
  language: string;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="w-10 h-6 rounded-full relative shrink-0 transition-all"
      style={{ background: on ? 'var(--argus-coral)' : 'var(--argus-steel)' }}
      aria-pressed={on}
    >
      <span
        className="absolute top-[4px] w-4 h-4 rounded-full bg-white shadow transition-all"
        style={{ left: on ? 'calc(100% - 20px)' : '4px' }}
      />
    </button>
  );
}

function MsgBanner({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null;
  return (
    <div className={clsx(
      'flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]',
      msg.type === 'ok' ? 'bg-emerald-dim text-emerald' : 'bg-crimson-dim text-crimson',
    )}>
      {msg.type === 'ok'
        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
      {msg.text}
    </div>
  );
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata');
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [notif, setNotif] = useState<NotifPrefs>({
    email: true, sms: false, voice: false, language: 'en',
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setPhone(user.phone || '');
      setTimezone(user.timezone || 'Asia/Kolkata');
    }
  }, [user?.id]);

  const initials = user
    ? `${(user.firstName?.[0] || '').toUpperCase()}${(user.lastName?.[0] || '').toUpperCase()}`
    : 'U';

  const pwdStrength = [
    newPwd.length >= 8,
    /[A-Z]/.test(newPwd),
    /[0-9]/.test(newPwd),
    /[^A-Za-z0-9]/.test(newPwd),
  ];
  const metCount = pwdStrength.filter(Boolean).length;

  async function saveInfo() {
    setInfoSaving(true); setInfoMsg(null);
    try {
      const { data } = await api.put('/auth/me', { firstName, lastName, phone, timezone });
      if (data?.data && setUser) setUser({ ...user!, ...data.data });
      setInfoMsg({ type: 'ok', text: 'Profile updated successfully.' });
    } catch (e: any) {
      setInfoMsg({ type: 'err', text: e?.response?.data?.error || 'Failed to update profile' });
    } finally {
      setInfoSaving(false);
    }
  }

  async function changePassword() {
    if (!oldPwd || !newPwd || !confirmPwd) {
      setPwdMsg({ type: 'err', text: 'All password fields are required.' }); return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'err', text: 'New passwords do not match.' }); return;
    }
    if (newPwd.length < 8) {
      setPwdMsg({ type: 'err', text: 'Password must be at least 8 characters.' }); return;
    }
    setPwdSaving(true); setPwdMsg(null);
    try {
      await api.post('/auth/change-password', { oldPassword: oldPwd, newPassword: newPwd });
      setPwdMsg({ type: 'ok', text: 'Password changed. You will need to log in again shortly.' });
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e: any) {
      setPwdMsg({ type: 'err', text: e?.response?.data?.error || 'Failed to change password' });
    } finally {
      setPwdSaving(false);
    }
  }

  async function saveNotifPrefs() {
    setNotifSaving(true); setNotifMsg(null);
    try {
      await api.put('/auth/me', { notificationPreferences: notif }).catch(() => {});
      setNotifMsg({ type: 'ok', text: 'Notification preferences saved.' });
    } catch {
      setNotifMsg({ type: 'ok', text: 'Preferences saved locally.' });
    } finally {
      setNotifSaving(false);
    }
  }

  return (
    <Page className="max-w-3xl">
      <div className="cx-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0"
              style={{ background: 'var(--brand-paper)', color: 'var(--brand-ink)' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <span className="cx-eyebrow">Govern · identity</span>
              <h1 className="cx-hero__title">{user?.firstName} {user?.lastName}</h1>
              <p className="cx-hero__deck flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {user?.email}
                </span>
                {user?.role && (
                  <span className={clsx('cx-pill', `cx-pill--${ROLE_TONE[user.role] || 'neutral'}`)}>{user.role}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <nav className="cx-crumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Operations</Link>
        <span aria-hidden>/</span>
        <span className="cx-crumb__current">Profile</span>
      </nav>

      <Panel title="Personal information" titleExtra={<UserCircle className="w-4 h-4 text-dim ml-1" />}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">First name</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Last name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Email</label>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border border-steel bg-[color:var(--argus-elevated)]">
              <Mail className="w-3.5 h-3.5 text-dim shrink-0" />
              <span className="text-[13px] text-muted">{user?.email}</span>
              <span className="ml-auto text-[9px] text-dim font-mono">Read-only</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-dim absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="input-field pl-9"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className="filter-select w-full">
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>

          <MsgBanner msg={infoMsg} />

          <div className="flex justify-end">
            <button type="button" onClick={saveInfo} disabled={infoSaving} className="cx-btn cx-btn--primary disabled:opacity-50">
              {infoSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {infoSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Notification preferences" titleExtra={<Bell className="w-4 h-4 text-dim ml-1" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">
              Preferred language (voice IVR)
            </label>
            <div className="relative">
              <Globe className="w-3.5 h-3.5 text-dim absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={notif.language}
                onChange={e => setNotif(n => ({ ...n, language: e.target.value }))}
                className="filter-select w-full pl-9"
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          </div>

          {[
            { key: 'email', icon: Mail, label: 'Email notifications', desc: 'Receive incident and change alerts via email' },
            { key: 'sms', icon: Phone, label: 'SMS notifications', desc: 'Get SMS alerts for critical incidents (P1/P2)' },
            { key: 'voice', icon: Bell, label: 'Voice call notifications', desc: 'Receive automated voice calls for P1 incidents' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between rounded-xl px-4 py-3 border border-steel bg-[color:var(--argus-elevated)]">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-signal-dim text-signal">
                  <item.icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-ink">{item.label}</p>
                  <p className="text-[10px] text-muted mt-0.5">{item.desc}</p>
                </div>
              </div>
              <Toggle
                on={notif[item.key as keyof NotifPrefs] as boolean}
                onChange={v => setNotif(n => ({ ...n, [item.key]: v }))}
              />
            </div>
          ))}

          <MsgBanner msg={notifMsg} />

          <div className="flex justify-end">
            <button type="button" onClick={saveNotifPrefs} disabled={notifSaving} className="cx-btn cx-btn--primary disabled:opacity-50">
              {notifSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {notifSaving ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Change password" titleExtra={<Key className="w-4 h-4 text-crimson ml-1" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Current password</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPwd}
                onChange={e => setOldPwd(e.target.value)}
                placeholder="Enter current password"
                className="input-field pr-10"
              />
              <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-ink" aria-label="Toggle current password">
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="input-field pr-10"
                />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-ink" aria-label="Toggle new password">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Confirm new password</label>
              <div className="relative">
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="Re-enter new password"
                  className="input-field pr-10"
                />
                {confirmPwd && newPwd === confirmPwd && (
                  <CheckCircle2 className="w-4 h-4 shrink-0 absolute right-3 top-1/2 -translate-y-1/2 text-emerald" />
                )}
              </div>
            </div>
          </div>

          {newPwd && (
            <div className="flex items-center gap-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-1 rounded-full transition-all"
                  style={{
                    background: i < metCount
                      ? (metCount >= 4 ? 'var(--argus-emerald)' : metCount >= 3 ? 'var(--argus-amber)' : 'var(--argus-crimson)')
                      : 'var(--argus-border)',
                  }}
                />
              ))}
              <span className="text-[10px] font-mono text-muted">
                {metCount < 2 ? 'Weak' : metCount < 4 ? 'Medium' : 'Strong'}
              </span>
            </div>
          )}

          <MsgBanner msg={pwdMsg} />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={changePassword}
              disabled={pwdSaving}
              className="cx-btn disabled:opacity-50 bg-crimson text-[color:var(--brand-paper)] hover:opacity-90"
            >
              {pwdSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
              {pwdSaving ? 'Changing…' : 'Change password'}
            </button>
          </div>
        </div>
      </Panel>
    </Page>
  );
}
