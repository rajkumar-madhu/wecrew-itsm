// ═══════════════════════════════════════════════════════════
// Argus ITSM — SSO landing page
// The API's callback has opened a session and set the refresh cookie; trade it
// for tokens here, then send the person to their home (portal or console).
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export default function SsoCallback() {
  const navigate = useNavigate();
  const completeSsoLogin = useAuthStore((s) => s.completeSsoLogin);
  const [failed, setFailed] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; the refresh token rotates
    started.current = true;
    completeSsoLogin()
      .then((user) => navigate(user.role === 'REQUESTER' ? '/portal' : '/', { replace: true }))
      .catch((err: Error) => setFailed(err.message || 'Single sign-on did not complete'));
  }, [completeSsoLogin, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-6">
      <div className="w-full max-w-sm text-center" role="status" aria-live="polite">
        {failed ? (
          <>
            <h1 className="font-display text-xl font-bold text-[#0F172A]">Sign-in didn't finish</h1>
            <p className="text-[14px] text-[#475569] mt-2">{failed}</p>
            <Link to="/login" className="inline-block mt-5 px-4 py-2 rounded-xl bg-[#0F172A] text-white text-[13px] font-semibold">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-[#4F46E5]" aria-hidden="true" />
            <p className="text-[14px] text-[#475569] mt-3">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
