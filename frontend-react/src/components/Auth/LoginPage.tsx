import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Eye, EyeOff, Shield, Zap, ArrowRight, Activity,
  Server, Bell, Brain, Lock, ChevronRight,
  CheckCircle2, Globe, Layers, BarChart3,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

// ══════════════════════════════════════════════════════════════
// Feature bullet for left panel
// ══════════════════════════════════════════════════════════════

function Feature({ icon: Icon, title, desc, color }: {
  icon: React.ElementType; title: string; desc: string; color: string;
}) {
  return (
    <div className="flex items-start gap-3 group">
      <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${color} transition-transform group-hover:scale-110`}>
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-white/90">{title}</p>
        <p className="text-[11px] text-white/40 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Stat pill for left panel
// ══════════════════════════════════════════════════════════════

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
      <p className="text-lg font-display font-bold text-white tracking-tight">{value}</p>
      <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Login Page — Premium SaaS Split Layout
// ══════════════════════════════════════════════════════════════

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
    if (!email || !password) { setError('Enter your email and password to continue'); setShake(true); setTimeout(() => setShake(false), 500); return; }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ══════════════════════════════════════════════════════════
          LEFT PANEL — Dark branded showcase
          ══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[56%] relative bg-[#0B1120] overflow-hidden flex-col">
        {/* Dot grid texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        {/* Ambient glows */}
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/[0.08] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] bg-violet-500/[0.06] rounded-full blur-[100px]" />
        <div className="absolute top-[40%] left-[30%] w-[200px] h-[200px] bg-emerald-500/[0.04] rounded-full blur-[80px]" />

        {/* Content */}
        <div className="relative flex-1 flex flex-col justify-between px-10 xl:px-14 py-10">

          {/* Top — Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Eye size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <span className="font-display font-bold text-[17px] text-white tracking-tight">WeCrew</span>
            </div>
          </div>

          {/* Center — Hero + Features */}
          <div className="space-y-8 max-w-md">
            <div>
              <h2 className="font-display text-[32px] xl:text-[36px] font-bold text-white leading-[1.15] tracking-tight">
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-300 bg-clip-text text-transparent">
                  WeCrew
                </span>
              </h2>
              <p className="text-[14px] text-white/40 mt-3 leading-relaxed max-w-sm">
                Monitor, detect, and resolve infrastructure incidents with AI-powered automation across your entire fleet.
              </p>
            </div>

            {/* Feature bullets */}
            <div className="space-y-4">
              <Feature icon={Activity} title="Real-Time Monitoring" desc="Prometheus, Grafana, SNMP, Windows — all in one pane of glass" color="bg-indigo-500/20" />
              <Feature icon={Brain} title="AI-Powered RCA" desc="Automated root cause analysis with remediation playbooks" color="bg-violet-500/20" />
              <Feature icon={Globe} title="Multi-Tenant Architecture" desc="13+ client organizations with isolated monitoring" color="bg-emerald-500/20" />
              <Feature icon={Bell} title="Intelligent Alerting" desc="PagerDuty, Slack, SMS, Voice — bidirectional sync" color="bg-amber-500/20" />
            </div>
          </div>

          {/* Bottom — Stats + Trust */}
          <div className="space-y-5">
            <div className="grid grid-cols-4 gap-3">
              <StatPill value="13+" label="Clients" />
              <StatPill value="99.9%" label="Uptime" />
              <StatPill value="< 5m" label="P1 Response" />
              <StatPill value="24/7" label="Monitoring" />
            </div>

            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-[10px] text-white/25 font-mono">
                <Lock size={9} /> SOC 2 Type II
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-1.5 text-[10px] text-white/25 font-mono">
                <Shield size={9} /> ISO 27001
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-1.5 text-[10px] text-white/25 font-mono">
                <CheckCircle2 size={9} /> ITIL v4 Certified
              </div>
            </div>

            <p className="text-[10px] text-white/15 font-mono">
              WeCrew
            </p>
          </div>
        </div>

        {/* Diagonal accent stripe */}
        <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-indigo-500/0 via-indigo-500/40 to-violet-500/0" />
      </div>

      {/* ══════════════════════════════════════════════════════════
          RIGHT PANEL — Clean white form
          ══════════════════════════════════════════════════════════ */}
      <div className="auth-light-panel flex-1 flex items-center justify-center bg-[#F8FAFC] relative px-6 py-10">
        {/* Subtle background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.03)_0%,_transparent_60%)]" />

        <div className={`relative w-full max-w-[380px] ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>

          {/* Mobile logo (hidden on lg+) */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Eye size={20} className="text-white" strokeWidth={2.5} />
              </div>
            </div>
            <h1 className="font-display text-2xl font-bold text-stone-900 tracking-tight">WeCrew</h1>
            <p className="text-xs text-stone-400 mt-0.5">Enterprise ITSM Platform</p>
          </div>

          {/* Form header */}
          <div className="mb-7">
            <h2 className="font-display text-[22px] font-bold text-stone-900 tracking-tight">Welcome back</h2>
            <p className="text-[13px] text-stone-400 mt-1">Sign in to your account to continue</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-50 border border-red-200">
              <div className="shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                <span className="block w-1.5 h-1.5 rounded-full bg-red-500" />
              </div>
              <p className="text-[12px] text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          {/* SSO Button */}
          <button className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 transition-all text-[13px] font-medium text-stone-700 shadow-sm mb-5 group">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Zap size={11} className="text-white" />
            </div>
            Sign in with Keycloak SSO
            <ChevronRight size={13} className="text-stone-300 group-hover:text-stone-500 group-hover:translate-x-0.5 transition-all ml-auto" />
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-[10px] font-mono text-stone-300 uppercase tracking-wider">or continue with email</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="rajkumar@wecrew.in"
                className="w-full px-3.5 py-2.5 text-[13px] text-stone-900 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-stone-400"
                autoFocus
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Password</label>
                <button type="button" className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 text-[13px] text-stone-900 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-stone-400 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-4 h-4 rounded border border-stone-300 bg-white peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all flex items-center justify-center">
                  {rememberMe && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </div>
              </div>
              <span className="text-[12px] text-stone-500 group-hover:text-stone-700 transition-colors">Keep me signed in for 30 days</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#0F172A] text-white font-semibold rounded-xl hover:bg-[#1E293B] active:scale-[0.99] disabled:opacity-60 transition-all flex items-center justify-center gap-2 text-[13px] shadow-lg shadow-stone-900/10 mt-1"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight size={14} className="opacity-60" />
                </>
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-7 pt-5 border-t border-stone-100 text-center space-y-3">
            <p className="text-[13px] text-stone-500">
              Don't have an account?{' '}
              <Link to="/signup" className="text-indigo-500 hover:text-indigo-700 font-semibold transition-colors">
                Sign up free
              </Link>
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1 text-[10px] text-stone-300 font-mono">
                <Lock size={8} /> 256-bit TLS
              </span>
              <span className="text-stone-200">|</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-stone-300 font-mono">
                <Shield size={8} /> RBAC
              </span>
              <span className="text-stone-200">|</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-stone-300 font-mono">
                <Zap size={8} /> OIDC SSO
              </span>
            </div>
          </div>

          {/* Version footer */}
          <p className="text-center text-[10px] text-stone-300 mt-6 font-mono">
            WeCrew &middot; No.55B, First Main, Electronic City Phase – 1, Bengaluru – 560 100 &middot; 9176772077
          </p>
        </div>
      </div>

      {/* Shake animation keyframes */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
