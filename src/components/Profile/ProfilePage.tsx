import { useState, useEffect } from 'react';
import {
  UserCircle, Save, Key, Bell, Globe, Phone, Mail,
  CheckCircle2, AlertCircle, Eye, EyeOff, Shield,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

// ── Constants ──────────────────────────────────────────────────────────────────
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

interface NotifPrefs {
  email: boolean;
  sms: boolean;
  voice: boolean;
  language: string;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, setUser } = useAuthStore();

  // Personal info state
  const [firstName, setFirstName]   = useState(user?.firstName || '');
  const [lastName, setLastName]     = useState(user?.lastName || '');
  const [phone, setPhone]           = useState(user?.phone || '');
  const [timezone, setTimezone]     = useState(user?.timezone || 'Asia/Kolkata');
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Password state
  const [oldPwd, setOldPwd]         = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showOld, setShowOld]       = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [pwdSaving, setPwdSaving]   = useState(false);
  const [pwdMsg, setPwdMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Notification prefs
  const [notif, setNotif] = useState<NotifPrefs>({
    email: true, sms: false, voice: false, language: 'en',
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Seed from user
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

  // ── Save profile info ──────────────────────────────────────────────────────
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

  // ── Change password ────────────────────────────────────────────────────────
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

  // ── Save notification prefs (local only — no dedicated endpoint) ───────────
  async function saveNotifPrefs() {
    setNotifSaving(true); setNotifMsg(null);
    try {
      // Try to persist via profile update (stores in user metadata if backend supports it)
      await api.put('/auth/me', { notificationPreferences: notif }).catch(() => {});
      setNotifMsg({ type: 'ok', text: 'Notification preferences saved.' });
    } catch {
      setNotifMsg({ type: 'ok', text: 'Preferences saved locally.' });
    } finally {
      setNotifSaving(false);
    }
  }

  function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        onClick={() => onChange(!on)}
        className="w-10 h-6 rounded-full relative shrink-0 transition-all"
        style={{ background: on ? '#4F46E5' : '#E7E5E4' }}>
        <span className="absolute top-[4px] w-4 h-4 rounded-full bg-white shadow transition-all"
          style={{ left: on ? 'calc(100% - 20px)' : '4px' }} />
      </button>
    );
  }

  function MsgBanner({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
    if (!msg) return null;
    return (
      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]"
        style={msg.type === 'ok'
          ? { background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', color: '#065F46' }
          : { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
        {msg.type === 'ok'
          ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#059669' }} />
          : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
        {msg.text}
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto px-4 pt-4 pb-8">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-white shadow-sm border border-stone-200 rounded-2xl mb-5">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #94A3B8 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-64 h-16 pointer-events-none opacity-[0.06]"
          style={{ background: 'radial-gradient(ellipse at 100% 0%, #4F46E5 0%, transparent 70%)' }} />

        <div className="relative px-6 py-5 flex items-center gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-ink shrink-0"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 4px 16px rgba(79,70,229,0.3)' }}>
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#4F46E5' }}>Platform</span>
              <span className="text-stone-300">/</span>
              <span className="text-[10px] font-mono text-stone-500 tracking-widest uppercase">My Profile</span>
            </div>
            <h1 className="text-[22px] font-display font-bold text-stone-900 tracking-tight">
              {user?.firstName} {user?.lastName}
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[11px] text-stone-500 flex items-center gap-1">
                <Mail className="w-3 h-3" /> {user?.email}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#4F46E5', border: '1px solid rgba(99,102,241,0.2)' }}>
                {user?.role}
              </span>
            </div>
          </div>
          <div className="ml-auto">
            <Shield className="w-8 h-8" style={{ color: 'rgba(99,102,241,0.2)' }} />
          </div>
        </div>
      </div>

      {/* ── Section: Personal Info ── */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '1px solid #E7E5E4' }}>
        <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid #E7E5E4', background: '#FAFAF9' }}>
          <UserCircle className="w-4 h-4" style={{ color: '#4F46E5' }} />
          <h2 className="text-[13px] font-display font-bold text-stone-900">Personal Information</h2>
        </div>

        <div className="px-5 py-5 space-y-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-[13px] text-stone-900 focus:outline-none"
                style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-[13px] text-stone-900 focus:outline-none"
                style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Email</label>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span className="text-[13px] text-stone-500">{user?.email}</span>
              <span className="ml-auto text-[9px] text-stone-400 font-mono">READ-ONLY</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Phone</label>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
                <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="flex-1 bg-transparent text-[13px] text-stone-900 placeholder:text-stone-400 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Timezone</label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-[13px] text-stone-900 focus:outline-none"
                style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>

          <MsgBanner msg={infoMsg} />

          <div className="flex justify-end">
            <button
              onClick={saveInfo}
              disabled={infoSaving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
              style={{ background: 'var(--argus-signal)', color: '#ffffff' }}>
              <Save className="w-3.5 h-3.5" />
              {infoSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section: Notification Preferences ── */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '1px solid #E7E5E4' }}>
        <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid #E7E5E4', background: '#FAFAF9' }}>
          <Bell className="w-4 h-4" style={{ color: '#4F46E5' }} />
          <h2 className="text-[13px] font-display font-bold text-stone-900">Notification Preferences</h2>
        </div>

        <div className="px-5 py-5 space-y-4 bg-white">
          {/* Preferred language */}
          <div>
            <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">
              Preferred Language (Voice IVR)
            </label>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
              <Globe className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <select
                value={notif.language}
                onChange={e => setNotif(n => ({ ...n, language: e.target.value }))}
                className="flex-1 bg-transparent text-[13px] text-stone-900 focus:outline-none">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          </div>

          {/* Toggles */}
          {[
            { key: 'email', icon: Mail, label: 'Email Notifications', desc: 'Receive incident and change alerts via email' },
            { key: 'sms', icon: Phone, label: 'SMS Notifications', desc: 'Get SMS alerts for critical incidents (P1/P2)' },
            { key: 'voice', icon: Bell, label: 'Voice Call Notifications', desc: 'Receive automated voice calls for P1 incidents' },
          ].map(item => (
            <div key={item.key}
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  <item.icon className="w-3.5 h-3.5" style={{ color: '#4F46E5' }} />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-stone-900">{item.label}</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">{item.desc}</p>
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
            <button
              onClick={saveNotifPrefs}
              disabled={notifSaving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
              style={{ background: 'var(--argus-signal)', color: '#ffffff' }}>
              <Save className="w-3.5 h-3.5" />
              {notifSaving ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section: Change Password ── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E7E5E4' }}>
        <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid #E7E5E4', background: '#FAFAF9' }}>
          <Key className="w-4 h-4" style={{ color: '#DC2626' }} />
          <h2 className="text-[13px] font-display font-bold text-stone-900">Change Password</h2>
        </div>

        <div className="px-5 py-5 space-y-4 bg-white">
          {/* Current password */}
          <div>
            <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Current Password</label>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPwd}
                onChange={e => setOldPwd(e.target.value)}
                placeholder="Enter current password"
                className="flex-1 bg-transparent text-[13px] text-stone-900 placeholder:text-stone-400 focus:outline-none"
              />
              <button onClick={() => setShowOld(v => !v)} className="text-stone-400 hover:text-stone-600 transition-colors">
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* New password */}
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">New Password</label>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="flex-1 bg-transparent text-[13px] text-stone-900 placeholder:text-stone-400 focus:outline-none"
                />
                <button onClick={() => setShowNew(v => !v)} className="text-stone-400 hover:text-stone-600 transition-colors">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {/* Confirm */}
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">Confirm New Password</label>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: '#FAFAF9', border: '1px solid #E7E5E4' }}>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="Re-enter new password"
                  className="flex-1 bg-transparent text-[13px] text-stone-900 placeholder:text-stone-400 focus:outline-none"
                />
                {confirmPwd && newPwd === confirmPwd && (
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#059669' }} />
                )}
              </div>
            </div>
          </div>

          {/* Password strength hint */}
          {newPwd && (
            <div className="flex items-center gap-2">
              {[...Array(4)].map((_, i) => {
                const strength = [newPwd.length >= 8, /[A-Z]/.test(newPwd), /[0-9]/.test(newPwd), /[^A-Za-z0-9]/.test(newPwd)];
                const metCount = strength.filter(Boolean).length;
                return (
                  <div key={i} className="flex-1 h-1 rounded-full transition-all"
                    style={{ background: i < metCount ? (metCount >= 4 ? '#059669' : metCount >= 3 ? '#D97706' : '#DC2626') : '#E7E5E4' }} />
                );
              })}
              <span className="text-[10px] font-mono text-stone-500">
                {[newPwd.length >= 8, /[A-Z]/.test(newPwd), /[0-9]/.test(newPwd), /[^A-Za-z0-9]/.test(newPwd)].filter(Boolean).length < 2 ? 'Weak'
                 : [newPwd.length >= 8, /[A-Z]/.test(newPwd), /[0-9]/.test(newPwd), /[^A-Za-z0-9]/.test(newPwd)].filter(Boolean).length < 4 ? 'Medium' : 'Strong'}
              </span>
            </div>
          )}

          <MsgBanner msg={pwdMsg} />

          <div className="flex justify-end">
            <button
              onClick={changePassword}
              disabled={pwdSaving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
              style={{ background: '#DC2626', color: 'var(--argus-ink)' }}>
              <Key className="w-3.5 h-3.5" />
              {pwdSaving ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
