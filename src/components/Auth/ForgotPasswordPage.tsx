import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AuthCard, AuthNotice } from './AuthCard';

/**
 * /forgot-password — raw fetch, like signup: this is public, and the shared
 * axios instance would run its 401-refresh path. The API answers the same way
 * whether or not the address exists, and so does this page.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean.includes('@')) { setError('Enter your full work email address.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: clean }),
      });
      if (res.status === 429) throw new Error('Too many attempts. Wait a few minutes and try again.');
      if (!res.ok && res.status !== 400) throw new Error('Something went wrong. Please try again.');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Reset your password" deck="Enter the work email you sign in with. We'll send a link to choose a new password.">
      {sent ? (
        <AuthNotice tone="ok">
          If that address has an account, a reset link is on its way. It works once and expires in 30 minutes.
        </AuthNotice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <AuthNotice tone="error">{error}</AuthNotice>}
          <div>
            <label htmlFor="forgot-email" className="block text-[12px] font-medium text-muted mb-1.5">Work email</label>
            <input
              id="forgot-email" type="email" value={email} autoComplete="email" inputMode="email" autoFocus
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="name@company.com" className="input-field py-2.5 text-[14px]"
            />
          </div>
          <button type="submit" disabled={loading} className="cx-btn cx-btn--primary w-full justify-center">
            {loading ? 'Sending…' : <>Send reset link <ArrowRight size={14} /></>}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
