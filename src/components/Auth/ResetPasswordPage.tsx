import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AuthCard, AuthNotice } from './AuthCard';

/** /reset-password?token=… — sets the new password; every session is signed out server-side. */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'This reset link is invalid or has expired.');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Reset link missing" deck="Open the link from your reset email, or request a new one.">
        <Link to="/forgot-password" className="cx-btn cx-btn--primary w-full justify-center">Request a new link</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" deck="You'll be signed out everywhere and can sign in with the new password.">
      {done ? (
        <>
          <AuthNotice tone="ok">Password updated.</AuthNotice>
          <Link to="/login" className="cx-btn cx-btn--primary w-full justify-center">Sign in <ArrowRight size={14} /></Link>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <AuthNotice tone="error">
              {error}{' '}
              {/expired|invalid/i.test(error) && <Link to="/forgot-password" className="underline">Request a new link</Link>}
            </AuthNotice>
          )}
          <div>
            <label htmlFor="reset-password" className="block text-[12px] font-medium text-muted mb-1.5">New password</label>
            <input id="reset-password" type="password" value={password} autoComplete="new-password" autoFocus
              onChange={(e) => { setPassword(e.target.value); setError(''); }} className="input-field py-2.5 text-[14px]" />
          </div>
          <div>
            <label htmlFor="reset-confirm" className="block text-[12px] font-medium text-muted mb-1.5">Confirm new password</label>
            <input id="reset-confirm" type="password" value={confirm} autoComplete="new-password"
              onChange={(e) => { setConfirm(e.target.value); setError(''); }} className="input-field py-2.5 text-[14px]" />
          </div>
          <button type="submit" disabled={loading} className="cx-btn cx-btn--primary w-full justify-center">
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
