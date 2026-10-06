import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import api from '../../lib/api';
import {
  AuthCard, AuthError, AuthNotice, AuthSubmit, authInputClass, authLabelClass,
} from './AuthCard';
import apiErrorMessage from './apiErrorMessage';

// The API answers the same way whether or not the address has an account,
// so this page does too — it never says "no such user".
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Enter the email address you sign in with'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to choose a new one">
      {sent ? (
        <AuthNotice>
          If <span className="font-semibold">{email.trim()}</span> has an account, a reset link is on its way.
          It works once and expires in 30 minutes. Check your spam folder if it doesn't arrive.
        </AuthNotice>
      ) : (
        <>
          {error && <AuthError message={error} />}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="forgot-email" className={authLabelClass}>Email address</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="you@company.com"
                className={authInputClass}
                autoFocus
                autoComplete="email"
              />
            </div>
            <AuthSubmit loading={loading}>
              Send reset link <ArrowRight size={14} className="opacity-60" />
            </AuthSubmit>
          </form>
        </>
      )}
    </AuthCard>
  );
}
