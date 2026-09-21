import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertTriangle, BookOpen, LifeBuoy } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { AuthRail, AuthShell, AuthSurface } from './AuthShell';

/** Visible deploy marker — change when shipping login UI */
export const LOGIN_UI_BUILD = 'itsm-login-v6-blue';

/**
 * WeCrew ITSM sign-in.
 *
 * Split layout: an ops rail carrying what the workspace is and where to get
 * help, and the sign-in desk itself. The rail is a genuinely dark surface, so
 * it opts out of the legacy light-mode shim at the end of index.css — see the
 * "Cascade trap" note in CLAUDE.md before changing its colours.
 *
 * There is deliberately no "keep me signed in" control. The session is held in
 * the persisted `wecrew-auth` store either way, so the checkbox that used to
 * sit here changed nothing at all — an affordance that misstates what the
 * product does is worse than no affordance. Sign-out is the way to end a
 * session; that is stated below the form.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const reject = (message: string) => {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return reject('Enter your email and password');
    if (!cleanEmail.includes('@')) {
      return reject('Use your full email address (for example name@company.com)');
    }
    setLoading(true);
    setError('');
    try {
      await login(cleanEmail, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      reject(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell build={LOGIN_UI_BUILD}>
      <AuthRail
        eyebrow="Operations workspace"
        title="One desk for the crew that keeps production up."
        deck="Incidents, changes, problems, CMDB and on-call in a single record per event — with the audit trail attached."
        points={[
          { k: '01', t: 'Alerts arrive already naming the customer, service and host' },
          { k: '02', t: 'On-call is paged and the SLA clock starts on the same record' },
          { k: '03', t: 'Every approval and state change is written down and exportable' },
        ]}
        build={LOGIN_UI_BUILD}
      />

      <AuthSurface
        shake={shake}
        footer={
          <>
            <p className="text-[13px] text-muted">
              No account yet?{' '}
              <Link to="/signup" className="font-medium hover:underline" style={{ color: 'var(--brand-blue)' }}>
                Start a free trial
              </Link>
              {' · '}
              <Link to="/pilot" className="font-medium hover:underline" style={{ color: 'var(--brand-blue)' }}>
                Book a pilot
              </Link>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11.5px] text-dim">
              <Link to="/docs" className="inline-flex items-center gap-1.5 hover:text-muted">
                <BookOpen size={12} aria-hidden /> Documentation
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-1.5 hover:text-muted">
                <LifeBuoy size={12} aria-hidden /> Get help signing in
              </Link>
            </div>
          </>
        }
      >
        <h2 className="font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-ink">
          Sign in to the desk
        </h2>
        <p className="mb-6 mt-1.5 text-[13px] text-muted">
          Use the work email your administrator invited.
        </p>

        {error && (
          <div
            className="mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5"
            style={{
              background: 'var(--argus-crimson-dim)',
              borderColor: 'color-mix(in srgb, var(--argus-crimson) 28%, transparent)',
            }}
            role="alert"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--argus-crimson)' }} />
            <p className="text-[12px]" style={{ color: 'var(--argus-crimson)' }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-[12px] font-medium text-muted">
              Work email
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
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <label htmlFor="login-password" className="text-[12px] font-medium text-muted">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-[12px] font-medium hover:underline"
                style={{ color: 'var(--brand-blue)' }}
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Password"
                className="input-field py-2.5 pr-10 text-[14px]"
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

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md py-3 text-[13px] font-semibold text-white transition-colors disabled:opacity-60"
            style={{ background: 'var(--brand-blue)' }}
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span className="sr-only">Signing in</span>
              </>
            ) : (
              <>
                Open workspace
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-[11.5px] leading-relaxed text-dim">
          Your session stays open on this device until you sign out. On a shared machine, sign out
          when you are done.
        </p>
      </AuthSurface>
    </AuthShell>
  );
}
