import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertTriangle, Shield, Lock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

/** Visible deploy marker — change when shipping login UI */
export const LOGIN_UI_BUILD = 'itsm-login-v3';

/**
 * WeCrew ITSM login — brand-forward split (dark ops rail + light sign-in desk)
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Enter your email and password');
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    if (!cleanEmail.includes('@')) {
      setError('Use your full email address (for example support@wecrew.in)');
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(cleanEmail, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password');
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('support@wecrew.in');
    setPassword('Wecrew@2026');
    setError('');
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex"
      style={{ background: 'linear-gradient(165deg, #efeae0 0%, #f4f1ea 42%, #fffcf7 100%)' }}
      data-login-build-root={LOGIN_UI_BUILD}
    >
      {/* Brand rail — ops deck with signal rib */}
      <aside
        data-login-rail
        className="hidden lg:flex lg:w-[46%] xl:w-[44%] flex-col justify-between text-white relative overflow-hidden"
        style={{ background: '#0a0c10' }}
      >
        <div
          data-login-rib
          className="absolute left-0 top-0 bottom-0 w-[5px]"
          style={{ background: 'var(--argus-coral)' }}
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        <div
          className="absolute -right-24 top-1/4 w-[420px] h-[420px] rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{ background: 'color-mix(in srgb, var(--argus-coral) 35%, transparent)' }}
          aria-hidden
        />

        <div className="relative px-12 xl:px-16 pt-12 pb-8 flex flex-col h-full">
          <div className="flex items-center gap-3">
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
          </div>

          <div className="flex-1 flex flex-col justify-center py-16">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] mb-4" style={{ color: 'var(--argus-coral)' }}>
              Operations workspace
            </p>
            <h1
              data-login-headline
              className="font-display text-[2.65rem] xl:text-[3.1rem] font-semibold leading-[1.05] tracking-[-0.04em] max-w-md"
            >
              WeCrew
            </h1>
            <p className="mt-5 text-[15px] text-white/60 leading-relaxed max-w-sm">
              Incidents, changes, CMDB, and on-call — one desk for the crew that keeps production up.
            </p>

            <div className="mt-12 grid gap-3 max-w-sm">
              {[
                { k: '01', t: 'Incident & problem triage' },
                { k: '02', t: 'Change + CMDB control' },
                { k: '03', t: 'SLA, alerts, on-call' },
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
            FinSpot · {LOGIN_UI_BUILD}
          </p>
        </div>
      </aside>

      {/* Sign-in desk */}
      <main className="auth-light-panel flex-1 flex items-center justify-center px-5 sm:px-8 py-10">
        <div className={`w-full max-w-[420px] ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
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
              data-login-build
              className="text-[10px] font-mono uppercase tracking-[0.16em] mb-3"
              style={{ color: 'var(--argus-coral)' }}
            >
              {LOGIN_UI_BUILD}
            </p>
            <h2 className="font-display text-[1.65rem] font-semibold text-ink tracking-[-0.03em]">
              Sign in to the desk
            </h2>
            <p className="text-[13px] text-muted mt-1.5 mb-6">
              Use your work email to open the service workspace.
            </p>

            <button
              type="button"
              onClick={fillDemo}
              className="mb-5 w-full text-left rounded-md border px-3.5 py-3 transition-colors hover:bg-[color:var(--argus-elevated)]"
              style={{
                borderColor: 'color-mix(in srgb, var(--argus-coral) 40%, var(--argus-border))',
                background: 'color-mix(in srgb, var(--argus-coral) 8%, white)',
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--argus-coral)' }}>
                Demo admin · click to fill
              </p>
              <p className="text-[12px] font-mono text-ink">support@wecrew.in</p>
              <p className="text-[12px] font-mono text-muted">Wecrew@2026</p>
            </button>

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
              <div>
                <label htmlFor="login-email" className="block text-[12px] font-medium text-muted mb-1.5">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="name@company.com"
                  className="input-field py-2.5 text-[14px]"
                  autoFocus
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-[12px] font-medium text-muted mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="Password"
                    className="input-field py-2.5 text-[14px] pr-10"
                    autoComplete="current-password"
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
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[color:var(--argus-input-border)]"
                  style={{ accentColor: 'var(--argus-coral)' }}
                />
                <span className="text-[12px] text-muted">Keep me signed in</span>
              </label>

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
                    Open workspace
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-5 text-center space-y-2">
            <p className="text-[13px] text-muted">
              No account?{' '}
              <Link to="/signup" className="font-medium hover:underline" style={{ color: 'var(--argus-coral)' }}>
                Request access
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
