import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ArrowLeft } from 'lucide-react';

// ══════════════════════════════════════════════════════════════
// Centered card shell for the public auth flows (forgot / reset
// password). Matches the LoginPage form panel.
// ══════════════════════════════════════════════════════════════

export const authInputClass =
  'w-full px-3.5 py-2.5 text-[13px] text-stone-900 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-stone-400';

export const authLabelClass =
  'block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5';

export function AuthCard({ title, subtitle, children }: {
  title: string; subtitle: string; children: ReactNode;
}) {
  return (
    <div className="auth-light-panel min-h-screen flex items-center justify-center bg-[#F8FAFC] relative px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.03)_0%,_transparent_60%)]" />

      <div className="relative w-full max-w-[380px]">
        <div className="text-center mb-8">
          <div className="inline-flex w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 items-center justify-center shadow-lg shadow-indigo-500/20 mb-3">
            <Eye size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <p className="font-display text-lg font-bold text-stone-900 tracking-tight">WeCrew</p>
        </div>

        <div className="mb-7">
          <h1 className="font-display text-[22px] font-bold text-stone-900 tracking-tight">{title}</h1>
          <p className="text-[13px] text-stone-400 mt-1">{subtitle}</p>
        </div>

        {children}

        <div className="mt-7 pt-5 border-t border-stone-100 text-center">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-[13px] text-indigo-500 hover:text-indigo-700 font-semibold transition-colors">
            <ArrowLeft size={13} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <div role="alert" className="mb-5 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-50 border border-red-200">
      <div className="shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
        <span className="block w-1.5 h-1.5 rounded-full bg-red-500" />
      </div>
      <p className="text-[12px] text-red-700 leading-relaxed">{message}</p>
    </div>
  );
}

export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
      <div className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
        <span className="block w-1.5 h-1.5 rounded-full bg-[#059669]" />
      </div>
      <p className="text-[12px] text-emerald-800 leading-relaxed">{children}</p>
    </div>
  );
}

export function AuthSubmit({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-2.5 bg-[#0F172A] text-white font-semibold rounded-xl hover:bg-[#1E293B] active:scale-[0.99] disabled:opacity-60 transition-all flex items-center justify-center gap-2 text-[13px] shadow-lg shadow-stone-900/10"
    >
      {loading
        ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        : children}
    </button>
  );
}
