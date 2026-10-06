import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { AuthCard, AuthError } from './AuthCard';

// Keycloak → API → here. The API puts either a one-time hand-off token or,
// for two-factor users, an MFA challenge in the URL fragment (never sent to
// a server). Read it, wipe it from the address bar, and finish the sign-in.
export default function SsoCallbackPage() {
  const navigate = useNavigate();
  const ssoExchange = useAuthStore((s) => s.ssoExchange);
  // Read the fragment once, on first render.
  const [{ handoff, mfaToken }] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    return { handoff: params.get('handoff'), mfaToken: params.get('mfaToken') };
  });
  const [error, setError] = useState(() => (handoff || mfaToken ? '' : 'This sign-in link is incomplete. Try signing in again.'));
  const started = useRef(false); // StrictMode runs effects twice; the hand-off is single-use

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    window.history.replaceState(null, '', window.location.pathname); // tokens out of the address bar and history

    if (mfaToken) {
      navigate('/login', { replace: true, state: { mfaToken } });
    } else if (handoff) {
      ssoExchange(handoff)
        .then(() => navigate('/dashboard', { replace: true }))
        .catch((err: Error) => setError(err.message || 'Single sign-on failed. Try again.'));
    }
  }, [handoff, mfaToken, navigate, ssoExchange]);

  if (!error) {
    return (
      <AuthCard title="Signing you in…" subtitle="Finishing single sign-on">
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Single sign-on didn't finish" subtitle="Your WeCrew account wasn't signed in">
      <AuthError message={error} />
    </AuthCard>
  );
}
