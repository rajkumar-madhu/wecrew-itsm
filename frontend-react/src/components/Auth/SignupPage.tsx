import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Eye, EyeOff, Shield, Zap, ArrowRight,
  Server, Bell, Brain, Lock, ChevronRight,
  CheckCircle2, Globe, User, Mail, KeyRound,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

// ══════════════════════════════════════════════════════════════
// Feature bullet for left panel (shared with LoginPage design)
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
// Password strength indicator
// ══════════════════════════════════════════════════════════════

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /\d/.test(password) },
    { label: 'Special character', pass: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];
  const score = checks.filter(c => c.pass).length;
  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= score
                ? score <= 1 ? 'bg-red-400' : score <= 2 ? 'bg-amber-400' : score <= 3 ? 'bg-indigo-400' : 'bg-emerald-500'
                : 'bg-stone-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-[10px] font-mono ${
        score <= 1 ? 'text-red-500' : score <= 2 ? 'text-amber-500' : score <= 3 ? 'text-indigo-500' : 'text-emerald-600'
      }`}>
        {score <= 1 ? 'Weak' : score <= 2 ? 'Fair' : score <= 3 ? 'Good' : 'Strong'}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Signup Page — Premium SaaS Split Layout
// ══════════════════════════════════════════════════════════════

export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName || !lastName || !email || !password) {
      setError('All fields are required');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');

      // Auto-login: set tokens in auth store
      const { setUser, setTokens } = useAuthStore.getState();
      setTokens(data.data.accessToken, data.data.refreshToken);
      setUser(data.data.user);

      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
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
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative bg-[#0B1120] overflow-hidden flex-col">
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
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Eye size={18} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <span className="font-display font-bold text-[17px] text-white tracking-tight">WeCrew</span>
              </div>
            </Link>
          </div>

          {/* Center — Hero + Features */}
          <div className="space-y-8 max-w-md">
            <div>
              <h2 className="font-display text-[32px] xl:text-[36px] font-bold text-white leading-[1.15] tracking-tight">
                Start Monitoring
                <br />
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-300 bg-clip-text text-transparent">
                  Your Infrastructure
                </span>
              </h2>
              <p className="text-[14px] text-white/40 mt-3 leading-relaxed max-w-sm">
                Create your free account and experience AI-powered IT service management in minutes.
              </p>
            </div>

            {/* Feature bullets */}
            <div className="space-y-4">
              <Feature icon={Zap} title="Free to Start" desc="Full access to incident management, alerting, and basic monitoring" color="bg-indigo-500/20" />
              <Feature icon={Brain} title="AI-Powered Triage" desc="Automated incident classification and root cause analysis" color="bg-violet-500/20" />
              <Feature icon={Globe} title="Multi-Cloud Ready" desc="Monitor Kubernetes, VMs, databases, and applications in one pane" color="bg-emerald-500/20" />
              <Feature icon={Bell} title="Smart Notifications" desc="PagerDuty, Slack, SMS, and Voice — never miss a critical alert" color="bg-amber-500/20" />
            </div>
          </div>

          {/* Bottom — Trust badges */}
          <div className="space-y-4">
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
              FinSpot Technology Solutions Private Limited
            </p>
          </div>
        </div>

        {/* Diagonal accent stripe */}
        <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-indigo-500/0 via-violet-500/40 to-indigo-500/0" />
      </div>

      {/* ══════════════════════════════════════════════════════════
          RIGHT PANEL — Clean white signup form
          ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center bg-white relative px-6 py-10">
        {/* Subtle background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.03)_0%,_transparent_60%)]" />

        <div className={`relative w-full max-w-[400px] ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>

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
          <div className="mb-6">
            <h2 className="font-display text-[22px] font-bold text-stone-900 tracking-tight">Create your account</h2>
            <p className="text-[13px] text-stone-400 mt-1">Get started with WeCrew in under a minute</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-50 border border-red-200">
              <div className="shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                <span className="block w-1.5 h-1.5 rounded-full bg-red-500" />
              </div>
              <p className="text-[12px] text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          {/* SSO Button */}
          <button className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 transition-all text-[13px] font-medium text-stone-700 shadow-sm mb-4 group">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Zap size={11} className="text-white" />
            </div>
            Sign up with Keycloak SSO
            <ChevronRight size={13} className="text-stone-300 group-hover:text-stone-500 group-hover:translate-x-0.5 transition-all ml-auto" />
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-[10px] font-mono text-stone-300 uppercase tracking-wider">or sign up with email</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">First name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); setError(''); }}
                    placeholder="John"
                    className="w-full pl-9 pr-3 py-2.5 text-[13px] bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-stone-300"
                    autoFocus
                  />
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setError(''); }}
                  placeholder="Doe"
                  className="w-full px-3 py-2.5 text-[13px] bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-stone-300"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Email address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@company.com"
                  className="w-full pl-9 pr-3 py-2.5 text-[13px] bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-stone-300"
                  autoComplete="email"
                />
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Min. 8 characters"
                  className="w-full pl-9 pr-10 py-2.5 text-[13px] bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-stone-300"
                  autoComplete="new-password"
                />
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Confirm password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  placeholder="Re-enter your password"
                  className={`w-full pl-9 pr-3 py-2.5 text-[13px] bg-stone-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-stone-300 ${
                    confirmPassword && confirmPassword !== password ? 'border-red-300' : 'border-stone-200'
                  }`}
                  autoComplete="new-password"
                />
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="text-[10px] text-red-500 mt-1 font-mono">Passwords don't match</p>
              )}
            </div>

            {/* Terms */}
            <p className="text-[11px] text-stone-400 leading-relaxed">
              By creating an account, you agree to our{' '}
              <span className="text-indigo-500 hover:text-indigo-700 cursor-pointer font-medium">Terms of Service</span>
              {' '}and{' '}
              <span className="text-indigo-500 hover:text-indigo-700 cursor-pointer font-medium">Privacy Policy</span>
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#0F172A] text-white font-semibold rounded-xl hover:bg-[#1E293B] active:scale-[0.99] disabled:opacity-60 transition-all flex items-center justify-center gap-2 text-[13px] shadow-lg shadow-stone-900/10"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight size={14} className="opacity-60" />
                </>
              )}
            </button>
          </form>

          {/* Footer — login link */}
          <div className="mt-6 pt-5 border-t border-stone-100 text-center space-y-3">
            <p className="text-[13px] text-stone-500">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-500 hover:text-indigo-700 font-semibold transition-colors">
                Sign in
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
                <Server size={8} /> Enterprise
              </span>
            </div>
          </div>

          {/* Version footer */}
          <p className="text-center text-[10px] text-stone-300 mt-5 font-mono">
            WeCrew &middot; FinSpot Technology Solutions Private Limited &middot; No.55B, First Main, Electronic City Phase – 1, Bengaluru – 560 100 &middot; 9176772077
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
