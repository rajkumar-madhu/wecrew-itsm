import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertTriangle, Shield, Lock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const SIGNUP_UI_BUILD = 'itsm-signup-v2';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /\d/.test(password) },
    { label: 'Special', pass: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  if (!password) return null;

  const tone =
    score <= 1 ? 'var(--argus-crimson)' : score <= 2 ? 'var(--argus-amber)' : score <= 3 ? 'var(--argus-signal)' : 'var(--argus-emerald)';
  const label = score <= 1 ? 'Weak' : score <= 2 ? 'Fair' : score <= 3 ? 'Good' : 'Strong';

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{
              background: i <= score ? tone : 'var(--argus-border)',
            }}
          />
        ))}
      </div>
      <p className="text-[10px] font-mono" style={{ color: tone }}>
        {label}
        <span className="text-dim">
          {' · '}
          {checks.filter((c) => !c.pass).map((c) => c.label).join(', ') || 'meets policy'}
        </span>
      </p>
    </div>
  );
}

/**
 * WeCrew ITSM signup — same brand-forward split as login
 * (dark ops rail + light desk).
 */
export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const fail = (message: string) => {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!firstName.trim() || !lastName.trim() || !cleanEmail || !password) {
      fail('All fields are required');
      return;
    }
    if (!cleanEmail.includes('@')) {
      fail('Use your full work email address');
      return;
    }
    if (password.length < 8) {
      fail('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      fail('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          // Names the trial organization; the API falls back to the person's name.
          ...(companyName.trim() ? { companyName: companyName.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');

      const { setUser, setTokens } = useAuthStore.getState();
      setTokens(data.data.accessToken, data.data.refreshToken);
      setUser(data.data.user);
      // Signup creates the org + trial; store it exactly as login() does.
      useAuthStore.setState({
        organization: data.data.organization || null,
        selectedOrgId: data.data.user?.organizationId || null,
      });

      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      fail(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex"
      style={{ background: 'linear-gradient(165deg, #efeae0 0%, #f4f1ea 42%, #fffcf7 100%)' }}
      data-signup-build={SIGNUP_UI_BUILD}
    >
      <aside
        className="hidden lg:flex lg:w-[46%] xl:w-[44%] flex-col justify-between text-white relative overflow-hidden"
        style={{ background: '#0a0c10' }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-[5px]"
          style={{ background: 'var(--argus-coral)' }}
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        <div
          className="absolute -right-24 top-1/4 w-[420px] h-[420px] rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{ background: 'color-mix(in srgb, var(--argus-coral) 35%, transparent)' }}
          aria-hidden
        />

        <div className="relative px-12 xl:px-16 pt-12 pb-8 flex flex-col h-full">
          <Link to="/" className="flex items-center gap-3 w-fit">
            <div
              className="w-11 h-11 rounded-sm flex items-center justify-center text-sm font-bold tracking-wide"
              style={{ background: 'var(--argus-coral)', color: '#fff' }}
            >
              WC
            </div>
            <div>
              <p className="font-display text-[18px] font-semibold tracking-[-0.03em] leading-none">WeCrew</p>
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/40 mt-1">ITSM</p>
            </div>
          </Link>

          <div className="flex-1 flex flex-col justify-center py-16">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] mb-4" style={{ color: 'var(--argus-coral)' }}>
              Request access
            </p>
            <h1 className="font-display text-[2.65rem] xl:text-[3.1rem] font-semibold leading-[1.05] tracking-[-0.04em] max-w-md">
              Join the desk
            </h1>
            <p className="mt-5 text-[15px] text-white/60 leading-relaxed max-w-sm">
              One workspace for incidents, changes, CMDB and on-call — on infrastructure you control.
            </p>

            <div className="mt-12 grid gap-3 max-w-sm">
              {[
                { k: '01', t: 'Incidents, problems, changes' },
                { k: '02', t: 'CMDB + SLA on the same record' },
                { k: '03', t: 'Approval before anything runs' },
              ].map((row) => (
                <div
                  key={row.k}
                  className="flex items-center gap-3 border-t border-white/10 pt-3 text-[13px] text-white/75"
                >
                  <span className="font-mono text-[11px]" style={{ color: 'var(--argus-coral)' }}>{row.k}</span>
                  {row.t}
                </div>
              ))}
            </div>
          </div>

          <p className="relative text-[11px] text-white/30 font-mono">
            WeCrew · {SIGNUP_UI_BUILD}
          </p>
        </div>
      </aside>

      <main className="auth-light-panel flex-1 flex items-center justify-center px-5 sm:px-8 py-10">
        <div className={`w-full max-w-[420px] ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <Link to="/" className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-sm flex items-center justify-center text-xs font-bold"
                style={{ background: 'var(--argus-coral)', color: '#fff' }}
              >
                WC
              </div>
              <div>
                <p className="font-semibold text-ink text-sm">WeCrew</p>
                <p className="text-[11px] font-mono text-muted uppercase tracking-wider">ITSM</p>
              </div>
            </Link>
          </div>

          <div
            className="rounded-lg border px-6 py-7 sm:px-8 sm:py-8"
            style={{
              background: 'var(--argus-surface)',
              borderColor: 'var(--argus-border)',
              boxShadow: '0 1px 0 rgba(14,17,22,0.04), 0 18px 40px rgba(14,17,22,0.06)',
            }}
          >
            <p
              className="text-[10px] font-mono uppercase tracking-[0.16em] mb-3"
              style={{ color: 'var(--argus-coral)' }}
            >
              New account
            </p>
            <h2 className="font-display text-[1.65rem] font-semibold text-ink tracking-[-0.03em]">
              Create your workspace
            </h2>
            <p className="text-[13px] text-muted mt-1.5 mb-6">
              Use your work email. You will land on the Command Centre after this.
            </p>

            {error && (
              <div
                className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-md border"
                style={{
                  background: 'var(--argus-crimson-dim)',
                  borderColor: 'color-mix(in srgb, var(--argus-crimson) 28%, transparent)',
                }}
                role="alert"
              >
                <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--argus-crimson)' }} />
                <p className="text-[12px]" style={{ color: 'var(--argus-crimson)' }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="signup-first" className="block text-[12px] font-medium text-muted mb-1.5">
                    First name
                  </label>
                  <input
                    id="signup-first"
                    type="text"
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); setError(''); }}
                    placeholder="Anita"
                    className="input-field py-2.5 text-[14px]"
                    autoFocus
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label htmlFor="signup-last" className="block text-[12px] font-medium text-muted mb-1.5">
                    Last name
                  </label>
                  <input
                    id="signup-last"
                    type="text"
                    value={lastName}
                    onChange={(e) => { setLastName(e.target.value); setError(''); }}
                    placeholder="Sharma"
                    className="input-field py-2.5 text-[14px]"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-company" className="block text-[12px] font-medium text-muted mb-1.5">
                  Company <span className="text-dim">(optional)</span>
                </label>
                <input
                  id="signup-company"
                  type="text"
                  value={companyName}
                  onChange={(e) => { setCompanyName(e.target.value); setError(''); }}
                  placeholder="Acme Operations"
                  className="input-field py-2.5 text-[14px]"
                  autoComplete="organization"
                  maxLength={100}
                />
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-[12px] font-medium text-muted mb-1.5">
                  Work email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="name@company.com"
                  className="input-field py-2.5 text-[14px]"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-[12px] font-medium text-muted mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="At least 8 characters"
                    className="input-field py-2.5 text-[14px] pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-dim hover:text-muted"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>

              <div>
                <label htmlFor="signup-confirm" className="block text-[12px] font-medium text-muted mb-1.5">
                  Confirm password
                </label>
                <input
                  id="signup-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  placeholder="Re-enter password"
                  className="input-field py-2.5 text-[14px]"
                  autoComplete="new-password"
                  aria-invalid={Boolean(confirmPassword && confirmPassword !== password)}
                />
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--argus-crimson)' }}>
                    Passwords do not match
                  </p>
                )}
              </div>

              <p className="text-[11px] text-muted leading-relaxed">
                By creating an account you agree that production changes require a named approver,
                and that every state change is written to the audit trail.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-md text-[13px] font-semibold text-white disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                style={{ background: 'var(--argus-coral)' }}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Create workspace
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-5 text-center space-y-2">
            <p className="text-[13px] text-muted">
              Already have an account?{' '}
              <Link to="/login" className="font-medium hover:underline" style={{ color: 'var(--argus-coral)' }}>
                Sign in
              </Link>
            </p>
            <div className="flex items-center justify-center gap-3 text-[10px] text-dim font-mono">
              <span className="inline-flex items-center gap-1"><Lock size={10} /> TLS</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1"><Shield size={10} /> RBAC</span>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-3px); }
          40%, 80% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
