import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Centered card on the light auth desk — the same surface as the sign-in
 * form, for the smaller account flows (forgot / reset password).
 */
export function AuthCard({ title, deck, children }: { title: string; deck?: ReactNode; children: ReactNode }) {
  return (
    <div className="auth-light-panel min-h-screen min-h-[100dvh] flex items-center justify-center px-5 sm:px-8 py-10">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="flex items-center gap-2.5 mb-8" aria-label="WeCrew home">
          <span
            className="w-9 h-9 rounded-sm flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--argus-coral)', color: '#fff' }}
          >
            WC
          </span>
          <span>
            <span className="block font-semibold text-ink text-sm">WeCrew</span>
            <span className="block text-[11px] font-mono text-muted uppercase tracking-wider">ITSM</span>
          </span>
        </Link>
        <div
          className="rounded-lg border px-6 py-7 sm:px-8 sm:py-8"
          style={{
            background: 'var(--argus-surface)',
            borderColor: 'var(--argus-border)',
            boxShadow: '0 1px 0 rgba(14,17,22,0.04), 0 18px 40px rgba(14,17,22,0.06)',
          }}
        >
          <h1 className="font-display text-[1.65rem] font-semibold text-ink tracking-[-0.03em]">{title}</h1>
          {deck && <p className="text-[13px] text-muted mt-1.5 mb-6">{deck}</p>}
          {children}
        </div>
        <p className="mt-5 text-center text-[13px] text-muted">
          <Link to="/login" className="font-medium hover:underline" style={{ color: 'var(--argus-coral)' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export function AuthNotice({ tone, children }: { tone: 'error' | 'ok'; children: ReactNode }) {
  const color = tone === 'error' ? 'var(--argus-crimson)' : 'var(--argus-green, #0f7a55)';
  const Icon = tone === 'error' ? AlertTriangle : CheckCircle2;
  return (
    <div
      className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-md border"
      style={{ borderColor: `color-mix(in srgb, ${color} 28%, transparent)`, background: `color-mix(in srgb, ${color} 8%, transparent)` }}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon size={15} className="shrink-0 mt-0.5" style={{ color }} />
      <p className="text-[12px]" style={{ color }}>{children}</p>
    </div>
  );
}
