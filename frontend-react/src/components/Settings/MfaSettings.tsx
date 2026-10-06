import { useState } from 'react';
import { clsx } from 'clsx';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Loader2, AlertTriangle, Copy, Check, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useSetupMfa, useEnableMfa, useDisableMfa, type MfaSetup } from '../../hooks/useAuth';
import apiErrorMessage from '../Auth/apiErrorMessage';

type Mode = 'idle' | 'enrolling' | 'disabling';

const codeInputClass = 'input-field font-mono tracking-[0.3em] text-center max-w-[180px]';
const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

// Settings → Security → Two-Factor Authentication.
// Enrolment: setup (QR + secret) → confirm with a first code → on.
// Turning it off needs the password AND a current code.
export default function MfaSettings() {
  const enabled = useAuthStore((s) => !!s.user?.mfaEnabled);
  const [mode, setMode] = useState<Mode>('idle');
  const [setupData, setSetupData] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const setup = useSetupMfa();
  const enable = useEnableMfa();
  const disable = useDisableMfa();

  const reset = () => {
    setMode('idle'); setSetupData(null); setCode(''); setPassword(''); setError(''); setCopied(false);
  };

  const startEnrolment = async () => {
    setError('');
    try {
      setSetupData(await setup.mutateAsync());
      setMode('enrolling');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not start setup. Try again.'));
    }
  };

  const confirmEnrolment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError('Enter the 6-digit code shown in your app'); return; }
    try {
      await enable.mutateAsync(code);
      reset();
    } catch (err) {
      setCode('');
      setError(apiErrorMessage(err, 'That code is incorrect. Try the next one.'));
    }
  };

  const confirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || code.length !== 6) { setError('Enter your password and a current 6-digit code'); return; }
    try {
      await disable.mutateAsync({ password, code });
      reset();
    } catch (err) {
      setCode('');
      setError(apiErrorMessage(err, 'Password or code is incorrect'));
    }
  };

  const copySecret = async () => {
    if (!setupData) return;
    try {
      await navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — the key is still visible to copy by hand */ }
  };

  const errorLine = error && (
    <p role="alert" className="text-xs text-[#EF4444] flex items-center gap-1">
      <AlertTriangle className="w-3 h-3 shrink-0" /> {error}
    </p>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#FAFBFC] border border-[#F1F5F9]">
        <div className="flex items-center gap-3">
          <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', enabled ? 'bg-[#ECFDF5]' : 'bg-[#FEF2F2]')}>
            <Shield className={clsx('w-5 h-5', enabled ? 'text-[#10B981]' : 'text-[#EF4444]')} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">{enabled ? 'MFA is enabled' : 'MFA is disabled'}</p>
            <p className="text-xs text-[#94A3B8]">
              {enabled
                ? 'Signing in needs your password and a code from your authenticator app'
                : 'Enable MFA to secure your account against unauthorized access'}
            </p>
          </div>
        </div>
        {mode === 'idle' && (
          enabled ? (
            <button type="button" onClick={() => { setError(''); setMode('disabling'); }} className="btn-primary text-sm bg-[#EF4444] hover:bg-[#DC2626]">
              Disable MFA
            </button>
          ) : (
            <button type="button" onClick={startEnrolment} disabled={setup.isPending} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
              {setup.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Enable MFA
            </button>
          )
        )}
      </div>

      {mode === 'idle' && errorLine}

      {mode === 'enrolling' && setupData && (
        <form onSubmit={confirmEnrolment} className="p-4 rounded-xl bg-[#FAFBFC] border border-[#E2E8F0] space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-[#0F172A]">Set up your authenticator app</p>
            <button type="button" onClick={reset} aria-label="Cancel setup" className="text-[#94A3B8] hover:text-[#475569]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="shrink-0 self-start rounded-xl overflow-hidden border border-[#E2E8F0]">
              <QRCodeSVG value={setupData.otpauthUrl} size={156} marginSize={3} bgColor="#FFFFFF" fgColor="#0F172A" aria-label="QR code for your authenticator app" />
            </div>
            <ol className="text-xs text-[#475569] space-y-2 list-decimal pl-4 min-w-0">
              <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).</li>
              <li>Scan the QR code, or enter this key by hand:
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="px-2 py-1 rounded-lg bg-[#F1F5F9] text-[#0F172A] font-mono text-[11px] break-all">{setupData.secret}</code>
                  <button type="button" onClick={copySecret} aria-label="Copy key" className="shrink-0 text-[#94A3B8] hover:text-[#4F46E5]">
                    {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </li>
              <li>Enter the 6-digit code the app shows to finish.</li>
            </ol>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              aria-label="6-digit code"
              className={codeInputClass}
              value={code}
              onChange={(e) => { setCode(onlyDigits(e.target.value)); setError(''); }}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
            <button type="submit" disabled={enable.isPending} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
              {enable.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Verify and turn on
            </button>
          </div>
          {errorLine}
        </form>
      )}

      {mode === 'disabling' && (
        <form onSubmit={confirmDisable} className="p-4 rounded-xl bg-[#FAFBFC] border border-[#FECACA] space-y-3 max-w-md">
          <p className="text-sm font-semibold text-[#0F172A]">Turn off two-factor authentication</p>
          <p className="text-xs text-[#94A3B8]">Confirm with your password and a current code from your app.</p>
          <input
            aria-label="Current password"
            className="input-field"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Current password"
            autoComplete="current-password"
            autoFocus
          />
          <input
            aria-label="6-digit code"
            className={codeInputClass}
            value={code}
            onChange={(e) => { setCode(onlyDigits(e.target.value)); setError(''); }}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          {errorLine}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={disable.isPending} className="btn-primary text-sm bg-[#EF4444] hover:bg-[#DC2626] flex items-center gap-2 disabled:opacity-60">
              {disable.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Turn off
            </button>
            <button type="button" onClick={reset} className="text-sm text-[#64748B] hover:text-[#0F172A]">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
