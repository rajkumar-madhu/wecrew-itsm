import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertTriangle, BookOpen, CalendarClock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { AuthRail, AuthShell, AuthSurface } from './AuthShell';
import { PILOT_DAYS } from '../Public/site';

export const SIGNUP_UI_BUILD = 'itsm-signup-v3';

/** The server's actual rule (`body('password').isLength({ min: 8 })`). */
const MIN_PASSWORD = 8;

/**
 * Password guidance — explicitly NOT policy.
 *
 * The API accepts any password of 8 characters or more. Showing four bars as
 * though all four were required would misstate the rule and block people on a
 * requirement that does not exist, so the meter advises and the hint below the
 * field states the real minimum.
 */
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: `${MIN_PASSWORD}+ characters`, pass: password.length >= MIN_PASSWORD },
    { label: 'an uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'a number', pass: /\d/.test(password) },
    { label: 'a symbol', pass: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  if (!password) return null;

  const tone =
    score <= 1 ? 'var(--argus-crimson)'
    : score <= 2 ? 'var(--argus-amber)'
    : score <= 3 ? 'var(--argus-signal)'
    : 'var(--argus-emerald)';
  const label = score <= 1 ? 'Weak' : score <= 2 ? 'Fair' : score <= 3 ? 'Good' : 'Strong';
  const missing = checks.filter((c) => !c.pass).map((c) => c.label);

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{ background: i <= score ? tone : 'var(--argus-border)' }}
          />
        ))}
      </div>
      <p className="font-mono text-[10px]" role="status">
        <span style={{ color: tone }}>{label}</span>
        <span className="text-dim">
          {missing.length ? ` · stronger with ${missing.join(', ')}` : ' · well above the minimum'}
        </span>
      </p>
    </div>
  );
}

/** Groups the form into named steps, the way a long enterprise form should read. */
function Fieldset({ step, legend, children }: { step: string; legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-3 flex items-baseline gap-2">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-dim">{step}</span>
        <span className="text-[12.5px] font-semibold text-ink">{legend}</span>
      </legend>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

/**
 * WeCrew ITSM sign-up — creates the trial organization and the first admin.
 *
 * Self-service signup is gated server-side (`config.selfServiceSignup`) and
 * answers 403 with a specific message when it is closed. That is a designed
 * state here, not an error: the page keeps the message and offers the pilot
 * route instead of showing a red box the visitor can do nothing about.
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
  const [closed, setClosed] = useState('');
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
    const org = companyName.trim();
    if (!firstName.trim() || !lastName.trim() || !cleanEmail || !password) {
      return fail('Fill in your name, work email and a password.');
    }
    if (!cleanEmail.includes('@')) return fail('Use your full work email address.');
    // Matches the server: companyName is optional, but 2–100 chars when given.
    if (org && (org.length < 2 || org.length > 100)) {
      return fail('Organisation name must be between 2 and 100 characters.');
    }
    if (password.length < MIN_PASSWORD) {
      return fail(`Password must be at least ${MIN_PASSWORD} characters.`);
    }
    if (password !== confirmPassword) return fail('The two passwords do not match.');

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
          ...(org ? { companyName: org } : {}),
        }),
      });
      const data = await res.json().catch(() => null);

      // Signup closed: keep the server's wording and route people to the pilot.
      if (res.status === 403) {
        setClosed(data?.error || 'Self-service signup is not open yet.');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Signup failed');

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
      fail(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell build={SIGNUP_UI_BUILD}>
      <AuthRail
        eyebrow={`${PILOT_DAYS}-day trial`}
        title="Run your own incidents through it before you decide."
        deck="Signing up creates your organisation, makes you its first administrator and opens the trial. No card, and nothing in your monitoring changes until you point a webhook at it."
        points={[
          { k: '01', t: 'Your organisation is created and isolated from every other tenant' },
          { k: '02', t: 'Connect one alert source with its webhook token — about a day of work' },
          { k: '03', t: 'Review SLA attainment and the audit trail, then decide' },
        ]}
        build={SIGNUP_UI_BUILD}
      />

      <AuthSurface
        shake={shake}
        width="max-w-[520px]"
        footer={
          <>
            <p className="text-[13px] text-muted">
              Already have an account?{' '}
              <Link to="/login" className="font-medium hover:underline" style={{ color: 'var(--argus-coral)' }}>
                Sign in
              </Link>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11.5px] text-dim">
              <Link to="/docs" className="inline-flex items-center gap-1.5 hover:text-muted">
                <BookOpen size={12} aria-hidden /> Read the docs first
              </Link>
              <Link to="/pricing" className="hover:text-muted">What happens after the trial</Link>
            </div>
          </>
        }
      >
        {closed ? (
          <div role="status">
            <h2 className="font-display text-[1.5rem] font-semibold tracking-[-0.03em] text-ink">
              Trials are opened by hand right now
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{closed}</p>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              Book a pilot slot and we will create the organisation with you on the call — you get the
              same {PILOT_DAYS}-day trial, running against your own alert sources.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/pilot"
                className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold text-white"
                style={{ background: 'var(--argus-coral)' }}
              >
                <CalendarClock size={14} aria-hidden />
                Book a pilot
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-[13px] font-medium text-ink"
                style={{ borderColor: 'var(--argus-border)' }}
              >
                Contact us
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h2 className="font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-ink">
              Start your trial
            </h2>
            <p className="mb-6 mt-1.5 text-[13px] leading-relaxed text-muted">
              This creates your organisation and makes you its administrator. You can invite the rest
              of the team once you are in.
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

            <form onSubmit={handleSubmit} className="space-y-6">
              <Fieldset step="01" legend="About you">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="signup-first" className="mb-1.5 block text-[12px] font-medium text-muted">
                      First name
                    </label>
                    <input
                      id="signup-first"
                      value={firstName}
                      onChange={(e) => { setFirstName(e.target.value); setError(''); }}
                      className="input-field py-2.5 text-[14px]"
                      autoComplete="given-name"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-last" className="mb-1.5 block text-[12px] font-medium text-muted">
                      Last name
                    </label>
                    <input
                      id="signup-last"
                      value={lastName}
                      onChange={(e) => { setLastName(e.target.value); setError(''); }}
                      className="input-field py-2.5 text-[14px]"
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="signup-email" className="mb-1.5 block text-[12px] font-medium text-muted">
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
                    aria-describedby="signup-email-hint"
                  />
                  <p id="signup-email-hint" className="mt-1.5 text-[11.5px] text-dim">
                    This is the address you will sign in with, and where alerts about your own account go.
                  </p>
                </div>
              </Fieldset>

              <Fieldset step="02" legend="Your organisation">
                <div>
                  <label htmlFor="signup-org" className="mb-1.5 block text-[12px] font-medium text-muted">
                    Organisation name <span className="font-normal text-dim">(optional)</span>
                  </label>
                  <input
                    id="signup-org"
                    value={companyName}
                    onChange={(e) => { setCompanyName(e.target.value); setError(''); }}
                    placeholder="Acme Managed Services"
                    className="input-field py-2.5 text-[14px]"
                    autoComplete="organization"
                    aria-describedby="signup-org-hint"
                  />
                  <p id="signup-org-hint" className="mt-1.5 text-[11.5px] leading-relaxed text-dim">
                    Names the tenant every incident, asset and audit record is scoped to. Leave it blank
                    and we use your name; an administrator can rename it later.
                  </p>
                </div>
              </Fieldset>

              <Fieldset step="03" legend="Set a password">
                <div>
                  <label htmlFor="signup-password" className="mb-1.5 block text-[12px] font-medium text-muted">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      className="input-field py-2.5 pr-10 text-[14px]"
                      autoComplete="new-password"
                      aria-describedby="signup-password-hint"
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
                  <p id="signup-password-hint" className="mt-1.5 text-[11.5px] text-dim">
                    Minimum {MIN_PASSWORD} characters. The meter above is advice, not a requirement.
                  </p>
                </div>
                <div>
                  <label htmlFor="signup-confirm" className="mb-1.5 block text-[12px] font-medium text-muted">
                    Confirm password
                  </label>
                  <input
                    id="signup-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    className="input-field py-2.5 text-[14px]"
                    autoComplete="new-password"
                  />
                </div>
              </Fieldset>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-md py-3 text-[13px] font-semibold text-white transition-colors disabled:opacity-60"
                style={{ background: 'var(--argus-coral)' }}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span className="sr-only">Creating your organisation</span>
                  </>
                ) : (
                  <>
                    Create organisation and start trial
                    <ArrowRight size={14} />
                  </>
                )}
              </button>

              <p className="text-[11.5px] leading-relaxed text-dim">
                No payment details are taken for the trial. Your data stays in the deployment you sign
                in to, and you can export or delete it at any point — see the{' '}
                <Link to="/security" className="underline hover:text-muted">security posture</Link>.
              </p>
            </form>
          </>
        )}
      </AuthSurface>
    </AuthShell>
  );
}
