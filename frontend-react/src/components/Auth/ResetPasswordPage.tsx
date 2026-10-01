import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';
import {
  AuthCard, AuthError, AuthNotice, AuthSubmit, authInputClass, authLabelClass,
} from './AuthCard';
import apiErrorMessage from './apiErrorMessage';

const MIN_LENGTH = 8; // matches the /auth/reset-password validator

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH) { setError(`Use at least ${MIN_LENGTH} characters`); return; }
    if (password !== confirm) { setError("The two passwords don't match"); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'This reset link is invalid or has expired. Request a new one.'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="Reset link missing" subtitle="Open the link from your reset email, or request a new one">
        <Link to="/forgot-password" className="text-[13px] text-indigo-500 hover:text-indigo-700 font-semibold">
          Request a new reset link
        </Link>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated" subtitle="You've been signed out everywhere for safety">
        <AuthNotice>Your password has been changed. Sign in with your new password.</AuthNotice>
        <Link
          to="/login"
          replace
          className="mt-5 w-full py-2.5 bg-[#0F172A] text-white font-semibold rounded-xl hover:bg-[#1E293B] transition-all flex items-center justify-center gap-2 text-[13px] shadow-lg shadow-stone-900/10"
        >
          Go to sign in <ArrowRight size={14} className="opacity-60" />
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle={`At least ${MIN_LENGTH} characters`}>
      {error && (
        <>
          <AuthError message={error} />
          {/invalid|expired/i.test(error) && (
            <p className="-mt-3 mb-5 text-[12px]">
              <Link to="/forgot-password" className="text-indigo-500 hover:text-indigo-700 font-semibold">
                Request a new reset link
              </Link>
            </p>
          )}
        </>
      )}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="reset-password" className={authLabelClass}>New password</label>
          <div className="relative">
            <input
              id="reset-password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className={`${authInputClass} pr-10`}
              autoFocus
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600 transition-colors"
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="reset-confirm" className={authLabelClass}>Confirm new password</label>
          <input
            id="reset-confirm"
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(''); }}
            className={authInputClass}
            autoComplete="new-password"
          />
        </div>
        <AuthSubmit loading={loading}>
          Update password <ArrowRight size={14} className="opacity-60" />
        </AuthSubmit>
      </form>
    </AuthCard>
  );
}
