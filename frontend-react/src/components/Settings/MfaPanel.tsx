import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Loader2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

type Step = 'idle' | 'enrolling' | 'disabling';

function errMsg(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } } };
  return e?.response?.data?.error || fallback;
}

/** TOTP enrolment: setup → scan QR → confirm with a code. Disabling needs password + code. */
export default function MfaPanel() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const enabled = !!user?.mfaEnabled;

  const [step, setStep] = useState<Step>('idle');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  function reset() {
    setStep('idle'); setSecret(''); setOtpauthUrl(''); setCode(''); setPassword(''); setError('');
  }

  async function startSetup() {
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/auth/mfa/setup');
      setSecret(data.data.secret);
      setOtpauthUrl(data.data.otpauthUrl);
      setStep('enrolling');
    } catch (err) {
      setError(errMsg(err, 'Could not start setup. Try again.'));
    } finally { setBusy(false); }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from your app'); return; }
    setBusy(true); setError('');
    try {
      await api.post('/auth/mfa/enable', { code });
      if (user) setUser({ ...user, mfaEnabled: true });
      toast.success('Two-factor authentication is on');
      reset();
    } catch (err) {
      setError(errMsg(err, 'That code did not match. Try again.'));
    } finally { setBusy(false); }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    if (!password || !/^\d{6}$/.test(code)) { setError('Enter your password and a current 6-digit code'); return; }
    setBusy(true); setError('');
    try {
      await api.post('/auth/mfa/disable', { password, code });
      if (user) setUser({ ...user, mfaEnabled: false });
      toast.success('Two-factor authentication is off');
      reset();
    } catch (err) {
      setError(errMsg(err, 'Could not turn off two-factor authentication.'));
    } finally { setBusy(false); }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked; the key is still selectable */ }
  }

  const inputCls = 'w-full px-3 py-2 text-sm bg-[#0B1424] text-[#E8F1FA] border border-[rgba(99,179,255,0.16)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] placeholder:text-[#7590A9]';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#0F1B2D] border border-[rgba(99,179,255,0.12)]">
        <div className="flex items-center gap-3">
          <div className={enabled ? 'w-10 h-10 rounded-xl flex items-center justify-center bg-[rgba(16,185,129,0.14)]' : 'w-10 h-10 rounded-xl flex items-center justify-center bg-[rgba(244,63,94,0.14)]'}>
            <Shield aria-hidden="true" className={enabled ? 'w-5 h-5 text-[#34D399]' : 'w-5 h-5 text-[#FB7185]'} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#E8F1FA]">{enabled ? 'Two-factor authentication is on' : 'Two-factor authentication is off'}</p>
            <p className="text-xs text-[#8AABC4]">
              {enabled ? 'Sign-in asks for a code from your authenticator app.' : 'Add a code from an authenticator app to every sign-in.'}
            </p>
          </div>
        </div>
        {step === 'idle' && (
          enabled ? (
            <button type="button" onClick={() => { setStep('disabling'); setError(''); }}
              className="text-sm font-medium px-3 py-2 rounded-lg border border-[rgba(244,63,94,0.4)] text-[#FB7185] hover:bg-[rgba(244,63,94,0.1)]">
              Turn off
            </button>
          ) : (
            <button type="button" onClick={startSetup} disabled={busy} className="btn-primary text-sm flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Set up
            </button>
          )
        )}
      </div>

      {step === 'enrolling' && (
        <form onSubmit={confirm} className="p-4 rounded-xl border border-[rgba(99,179,255,0.12)] bg-[#0F1B2D] grid gap-4 sm:grid-cols-[auto,1fr]">
          <div className="p-2 bg-[#FFFFFF] rounded-lg self-start justify-self-start">
            <QRCodeSVG value={otpauthUrl} size={148} level="M" title="QR code for your authenticator app" />
          </div>
          <div className="space-y-3 min-w-0">
            <ol className="text-sm text-[#C5D8E8] list-decimal pl-5 space-y-1">
              <li>Scan the QR code with Google Authenticator, 1Password, Authy or similar.</li>
              <li>Enter the 6-digit code the app shows.</li>
            </ol>
            <div>
              <p className="text-xs text-[#8AABC4] mb-1">Can't scan? Enter this key instead:</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-[#152238] text-[#E8F1FA] px-2 py-1 rounded break-all select-all">{secret}</code>
                <button type="button" onClick={copySecret} aria-label="Copy setup key"
                  className="p-1.5 rounded-md text-[#8AABC4] hover:bg-[#152238]">
                  {copied ? <Check className="w-4 h-4 text-[#34D399]" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="mfa-enrol-code" className="block text-xs font-semibold text-[#C5D8E8] mb-1">Code from app</label>
              <input id="mfa-enrol-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                className={`${inputCls} font-mono tracking-[0.3em] max-w-[12rem]`} placeholder="123456" autoFocus />
            </div>
            {error && <p role="alert" className="text-xs text-[#FB7185]">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="btn-primary text-sm flex items-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Turn on
              </button>
              <button type="button" onClick={reset} className="text-sm px-3 py-2 rounded-lg text-[#C5D8E8] hover:bg-[#152238]">Cancel</button>
            </div>
          </div>
        </form>
      )}

      {step === 'disabling' && (
        <form onSubmit={disable} className="p-4 rounded-xl border border-[rgba(244,63,94,0.3)] bg-[#0F1B2D] space-y-3 max-w-md">
          <p className="text-sm text-[#C5D8E8]">Confirm with your password and a current code to turn off two-factor authentication.</p>
          <div>
            <label htmlFor="mfa-disable-password" className="block text-xs font-semibold text-[#C5D8E8] mb-1">Password</label>
            <input id="mfa-disable-password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }} className={inputCls} />
          </div>
          <div>
            <label htmlFor="mfa-disable-code" className="block text-xs font-semibold text-[#C5D8E8] mb-1">Code from app</label>
            <input id="mfa-disable-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              className={`${inputCls} font-mono tracking-[0.3em] max-w-[12rem]`} placeholder="123456" />
          </div>
          {error && <p role="alert" className="text-xs text-[#FB7185]">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy}
              className="text-sm font-medium px-3 py-2 rounded-lg bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-60 flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Turn off
            </button>
            <button type="button" onClick={reset} className="text-sm px-3 py-2 rounded-lg text-[#C5D8E8] hover:bg-[#152238]">Cancel</button>
          </div>
        </form>
      )}

      {step === 'idle' && error && <p role="alert" className="text-xs text-[#FB7185]">{error}</p>}
    </div>
  );
}
