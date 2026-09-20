import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';

/*
  Shared chrome for the full-page auth flows (sign in, sign up).

  Both pages used to carry their own copy of the split layout, the brand lockup
  and the card surface, which is how they drifted apart in the first place —
  SignupPage was still on the legacy dark-only utilities while LoginPage had
  been migrated. One shell, two pages.

  The rail is a genuinely dark surface on a light workspace, so it must opt out
  of the compatibility shim at the end of index.css. See the "Cascade trap"
  section in CLAUDE.md: `.text-white` there carries four :not() clauses, so an
  override has to match its class count AND win on element count. Everything
  dark here is set with inline `style` or an explicit token for exactly that
  reason — do not "tidy" these into plain utility classes.
*/

const INK = '#0a0c10';

export interface RailPoint {
  k: string;
  t: string;
}

/** Page frame: dark rail beside a light desk, stacking to desk-only on mobile. */
export function AuthShell({ children, build }: { children: ReactNode; build?: string }) {
  return (
    <div
      className="flex min-h-screen min-h-[100dvh]"
      style={{ background: 'linear-gradient(165deg, #efeae0 0%, #f4f1ea 42%, #fffcf7 100%)' }}
      data-auth-build-root={build}
    >
      {children}
    </div>
  );
}

/** Brand lockup — the mark plus product name, used on the rail and on mobile. */
export function AuthLockup({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const onDark = tone === 'dark';
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-[13px] font-bold tracking-wide"
        style={{ background: 'var(--argus-coral)', color: '#fff' }}
        aria-hidden
      >
        WC
      </span>
      <span>
        <span
          className="block font-display text-[16px] font-semibold leading-none tracking-[-0.03em]"
          style={onDark ? { color: '#fff' } : undefined}
        >
          WeCrew
        </span>
        <span
          className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.14em]"
          style={{ color: onDark ? 'rgba(255,255,255,0.42)' : 'var(--argus-muted)' }}
        >
          ITSM
        </span>
      </span>
    </div>
  );
}

/**
 * Dark ops rail. Hidden below `lg` — on a phone the sign-in form is the whole
 * job, and a decorative panel above it just pushes the form off the fold.
 */
export function AuthRail({
  eyebrow,
  title,
  deck,
  points,
  build,
}: {
  eyebrow: string;
  title: string;
  deck: string;
  points: readonly RailPoint[];
  build?: string;
}) {
  return (
    <aside
      data-auth-rail
      className="relative hidden flex-col justify-between overflow-hidden lg:flex lg:w-[46%] xl:w-[44%]"
      style={{ background: INK, color: '#fff' }}
    >
      <span
        aria-hidden
        className="absolute bottom-0 left-0 top-0 w-[5px]"
        style={{ background: 'var(--argus-coral)' }}
      />
      <span
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/4 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
        style={{ background: 'color-mix(in srgb, var(--argus-coral) 35%, transparent)' }}
      />

      <div className="relative flex h-full flex-col px-12 pb-8 pt-12 xl:px-16">
        <Link to="/" aria-label="WeCrew ITSM home">
          <AuthLockup tone="dark" />
        </Link>

        <div className="flex flex-1 flex-col justify-center py-16">
          <p
            className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em]"
            style={{ color: 'var(--argus-coral)' }}
          >
            {eyebrow}
          </p>
          <h1
            data-auth-headline
            className="max-w-md font-display text-[2.3rem] font-semibold leading-[1.1] tracking-[-0.04em] xl:text-[2.7rem]"
            style={{ color: '#fff' }}
          >
            {title}
          </h1>
          <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
            {deck}
          </p>

          <ol className="mt-11 grid max-w-sm gap-3">
            {points.map((row) => (
              <li
                key={row.k}
                className="flex items-start gap-3 pt-3 text-[13px] leading-relaxed"
                style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.74)' }}
              >
                <span className="font-mono text-[11px] leading-5" style={{ color: 'var(--argus-coral)' }}>
                  {row.k}
                </span>
                <span>{row.t}</span>
              </li>
            ))}
          </ol>
        </div>

        {build && (
          // Release marker for deploy checks. Kept out of the accessibility tree
          // and out of the visual design — it is an operator detail, not copy.
          <p data-auth-build hidden>{build}</p>
        )}
      </div>
    </aside>
  );
}

/** The light card the form sits on, plus the mobile lockup above it. */
export function AuthSurface({
  children,
  footer,
  shake,
  width = 'max-w-[420px]',
}: {
  children: ReactNode;
  /** Sits under the card, inside the desk column — not beside the rail. */
  footer?: ReactNode;
  shake?: boolean;
  width?: string;
}) {
  return (
    <main className="auth-light-panel flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
      <div className={clsx('w-full', width, shake && 'animate-[shake_0.4s_ease-in-out]')}>
        <Link to="/" className="mb-8 inline-flex lg:hidden" aria-label="WeCrew ITSM home">
          <AuthLockup />
        </Link>

        <div
          className="rounded-lg border px-6 py-7 sm:px-8 sm:py-8"
          style={{
            background: 'var(--argus-surface)',
            borderColor: 'var(--argus-border)',
            boxShadow: '0 1px 0 rgba(14,17,22,0.04), 0 18px 40px rgba(14,17,22,0.06)',
          }}
        >
          {children}
        </div>

        {footer && <div className="mt-5 space-y-2.5 text-center">{footer}</div>}

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-3px); }
            40%, 80% { transform: translateX(3px); }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes shake { 0%, 100% { transform: none; } }
          }
        `}</style>
      </div>
    </main>
  );
}
