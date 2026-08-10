import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════════════════════════
   WeCrew — Enterprise ITSM Platform
   Aesthetic: Clean Professional — Stripe × Atlassian
   Light whites, warm grays, crisp typography, institutional trust
   Self-contained CSS · No Tailwind (app config overrides standard palettes)

   ★ PLATFORM CONFIG — Change these values when deploying for a different platform
   ═══════════════════════════════════════════════════════════════════════════════ */

const PLATFORM = {
  name: 'WeCrew',
  version: 'v2.0',
  tagline: 'Enterprise ITSM Platform',
  company: 'FinSpot Technology Solutions Private Limited',
  companyShort: 'FinSpot Technology',
  website: 'https://finspot.in',
  supportEmail: 'support@finspot.in',
  parentBrand: 'FinSpot',

  hero: {
    title1: 'WeCrew',
    title2: '',
    description: 'Unified incident management, AI-powered triage, auto-remediation, and infrastructure monitoring for India\'s leading financial institutions.',
    badge: 'Platform Status: All Systems Operational',
  },

  kpis: [
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '<2min', label: 'Mean MTTR' },
    { value: '13+', label: 'Organizations' },
  ],

  stats: [
    { v: 99.9, s: '%', l: 'Platform Uptime' },
    { v: 2, p: '<', s: 'min', l: 'Avg MTTR' },
    { v: 13, s: '+', l: 'Organizations' },
    { v: 10000, s: '+', l: 'Alerts Processed' },
    { v: 5000, s: '+', l: 'Incidents Resolved' },
    { v: 98.5, s: '%', l: 'SLA Compliance' },
  ],

  cta: {
    title: 'Ready to transform your IT operations?',
    description: 'Join 13+ financial institutions that trust WeCrew for mission-critical infrastructure management.',
  },

  clients: [
    { n: 'IndMoney', i: 'IM', c: '#4338CA', s: 'Wealth Tech', city: 'Bangalore' },
    { n: 'FinSpot', i: 'FS', c: '#0891B2', s: 'FinTech Infra', city: 'Mumbai' },
    { n: 'PL India', i: 'PL', c: '#7C3AED', s: 'Stock Broking', city: 'Mumbai' },
    { n: 'Neo', i: 'NE', c: '#059669', s: 'Digital Banking', city: 'Mumbai' },
    { n: 'FlatTrade', i: 'FT', c: '#DC2626', s: 'Discount Trading', city: 'Chennai' },
    { n: 'Way2Wealth', i: 'W2', c: '#D97706', s: 'Wealth Mgmt', city: 'Bangalore' },
    { n: 'Lemonn', i: 'LM', c: '#CA8A04', s: 'FinTech Lending', city: 'Mumbai' },
    { n: 'Mirae Asset', i: 'MA', c: '#1D4ED8', s: 'Asset Mgmt', city: 'Mumbai' },
    { n: 'SMIFS', i: 'SM', c: '#6D28D9', s: 'Financial Services', city: 'Kolkata' },
    { n: 'IndMoney IFSC', i: 'IF', c: '#4F46E5', s: 'GIFT City Unit', city: 'Gujarat' },
    { n: 'IndMoney DR', i: 'DR', c: '#6366F1', s: 'Disaster Recovery', city: 'Mumbai' },
    { n: 'FinSpot Mumbai', i: 'FM', c: '#0E7490', s: 'Production Site', city: 'Mumbai' },
    { n: 'PL Prod', i: 'PP', c: '#8B5CF6', s: 'Production Env', city: 'Mumbai' },
  ],

  clientsLabel: 'Trusted by India\'s leading financial institutions',
  footerDescription: 'Enterprise IT Service Management platform. AI-powered incident management, monitoring, and auto-remediation.',
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700&family=IBM+Plex+Mono:wght@400;500&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --white:#FFFFFF;--bg:#FAFAF9;--bg-alt:#F5F5F4;--bg-warm:#F1F0EE;
  --border:#E7E5E4;--border-light:#F0EFED;--border-hover:#D6D3D1;
  --ink:#0F172A;--ink2:#1E293B;--text:#334155;--text-secondary:#64748B;
  --text-muted:#94A3B8;--text-dim:#CBD5E1;
  --brand:#4338CA;--brand-light:#6366F1;--brand-bg:#EEF2FF;--brand-deep:#312E81;
  --green:#059669;--green-bg:#ECFDF5;
  --amber:#D97706;--amber-bg:#FFFBEB;
  --red:#DC2626;--red-bg:#FEF2F2;
  --cyan:#0891B2;--cyan-bg:#ECFEFF;
  --violet:#7C3AED;--violet-bg:#F5F3FF;
  --r:8px;--r-sm:6px;--r-lg:12px;--r-xl:16px;
  --sh:0 1px 3px rgba(0,0,0,.04),0 1px 2px rgba(0,0,0,.03);
  --sh-md:0 4px 6px -1px rgba(0,0,0,.06),0 2px 4px -2px rgba(0,0,0,.04);
  --sh-lg:0 10px 25px -5px rgba(0,0,0,.07),0 8px 10px -6px rgba(0,0,0,.03);
  --sh-xl:0 20px 50px -12px rgba(0,0,0,.12);
  --mw:1120px;
  --font-display:'Syne',system-ui,sans-serif;
  --font-body:'IBM Plex Sans',system-ui,sans-serif;
  --font-mono:'IBM Plex Mono',monospace;
}

/* ── Base ── */
.lp{font-family:var(--font-body);background:var(--white);color:var(--text);
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  font-size:14px;line-height:1.6;overflow-x:hidden}
.lp a{text-decoration:none;color:inherit;transition:color .15s}
.mx{max-width:var(--mw);margin:0 auto;padding:0 24px}

/* ── Typography ── */
.t1{font-family:var(--font-display);font-size:clamp(30px,4.2vw,52px);font-weight:800;
  line-height:1.08;letter-spacing:-.035em;color:var(--ink)}
.t2{font-family:var(--font-display);font-size:clamp(22px,2.8vw,32px);font-weight:700;
  line-height:1.15;letter-spacing:-.02em;color:var(--ink)}
.t3{font-family:var(--font-display);font-size:15px;font-weight:700;line-height:1.3;color:var(--ink)}
.t4{font-family:var(--font-display);font-size:13px;font-weight:600;line-height:1.35;color:var(--ink)}
.over{font-family:var(--font-mono);font-size:11px;font-weight:500;letter-spacing:.08em;
  text-transform:uppercase;color:var(--brand)}
.body{font-size:15px;line-height:1.7;color:var(--text-secondary)}
.body-s{font-size:13px;line-height:1.6;color:var(--text-secondary)}

/* ── Nav ── */
.nav{position:fixed;top:0;left:0;right:0;z-index:100;
  background:rgba(255,255,255,.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border-bottom:1px solid transparent;transition:all .25s}
.nav.scrolled{border-bottom-color:var(--border);box-shadow:var(--sh)}
.nav-in{max-width:var(--mw);margin:0 auto;padding:0 24px;
  display:flex;align-items:center;justify-content:space-between;height:56px}
.nav-logo{display:flex;align-items:center;gap:8px;cursor:pointer}
.nav-logo-mark{width:28px;height:28px;border-radius:7px;background:var(--brand);
  display:flex;align-items:center;justify-content:center}
.nav-logo-mark svg{width:15px;height:15px;color:#fff}
.nav-logo-text{font-family:var(--font-display);font-weight:800;font-size:18px;
  color:var(--ink);letter-spacing:-.03em}
.nav-links{display:flex;align-items:center;gap:4px}
.nav-lk{font-size:13px;font-weight:500;color:var(--text-secondary);cursor:pointer;
  background:none;border:none;padding:6px 12px;border-radius:var(--r-sm);
  transition:all .15s;font-family:var(--font-body)}
.nav-lk:hover{color:var(--ink);background:var(--bg-alt)}
.nav-r{display:flex;align-items:center;gap:8px}
.nav-sign{font-size:13px;font-weight:500;color:var(--text-secondary);cursor:pointer;
  background:none;border:none;padding:6px 14px;border-radius:var(--r-sm);
  transition:all .15s;font-family:var(--font-body)}
.nav-sign:hover{color:var(--ink)}
.nav-ham{display:none;background:none;border:none;padding:6px;cursor:pointer;color:var(--ink)}
.nav-ham svg{width:20px;height:20px}

/* ── Buttons ── */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;
  font-family:var(--font-body);font-size:13px;font-weight:600;
  border:none;cursor:pointer;border-radius:var(--r);padding:9px 18px;transition:all .2s;
  white-space:nowrap}
.btn-p{background:var(--brand);color:#fff;box-shadow:0 1px 2px rgba(67,56,202,.15)}
.btn-p:hover{background:var(--brand-deep);box-shadow:0 3px 10px rgba(67,56,202,.18);transform:translateY(-1px)}
.btn-s{background:var(--white);color:var(--ink);border:1px solid var(--border)}
.btn-s:hover{border-color:var(--border-hover);background:var(--bg);box-shadow:var(--sh)}
.btn-w{background:var(--white);color:var(--ink)}
.btn-w:hover{background:var(--bg);transform:translateY(-1px);box-shadow:var(--sh-lg)}
.btn-ghost{background:transparent;color:var(--text-secondary)}
.btn-ghost:hover{color:var(--ink);background:var(--bg-alt)}
.btn-lg{padding:11px 24px;font-size:14px;border-radius:var(--r)}

/* ── Section ── */
.sec{padding:72px 0;position:relative}
.sec-alt{padding:72px 0;background:var(--bg)}
.sec-hd{text-align:center;max-width:540px;margin:0 auto 44px}
.sec-hd .over{display:inline-flex;align-items:center;gap:6px;margin-bottom:12px;
  padding:4px 12px;background:var(--brand-bg);border:1px solid rgba(99,102,241,.1);
  border-radius:99px;font-size:10.5px}
.sec-hd .t2{margin-bottom:8px}

/* ── Hero ── */
.hero{padding:110px 0 72px;position:relative;background:var(--white)}
.hero::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;
  background:radial-gradient(ellipse 70% 50% at 50% 0%,rgba(67,56,202,.03),transparent);pointer-events:none}
.hero-content{position:relative;z-index:1;text-align:center;max-width:700px;margin:0 auto}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:var(--bg);
  border:1px solid var(--border);color:var(--text-secondary);font-size:12px;font-weight:500;
  padding:5px 14px;border-radius:99px;margin-bottom:24px;font-family:var(--font-mono)}
.hero-badge-dot{width:6px;height:6px;border-radius:50%;background:var(--green);
  box-shadow:0 0 6px rgba(5,150,105,.4);animation:pulse-dot 2s ease-in-out infinite}
@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.4}}
.hero .t1{margin-bottom:18px}
.hero .t1 .brand-text{color:var(--brand)}
.hero-desc{font-size:17px;line-height:1.7;color:var(--text-secondary);max-width:520px;margin:0 auto 28px}
.hero-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:44px}
.hero-kpi{display:flex;gap:0;justify-content:center;border:1px solid var(--border);
  border-radius:var(--r-lg);overflow:hidden;max-width:520px;margin:0 auto;background:var(--white)}
.hero-kpi-item{flex:1;text-align:center;padding:16px 20px;position:relative}
.hero-kpi-item:not(:last-child)::after{content:'';position:absolute;right:0;top:20%;bottom:20%;
  width:1px;background:var(--border)}
.hero-kv{font-family:var(--font-display);font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-.02em}
.hero-kl{font-size:10.5px;color:var(--text-muted);margin-top:2px;font-family:var(--font-mono);
  text-transform:uppercase;letter-spacing:.04em}

/* ── Product Mockup ── */
.mock-wrap{position:relative;max-width:880px;margin:0 auto;padding:0 24px;margin-top:48px}
.mock{background:var(--white);border:1px solid var(--border);border-radius:var(--r-lg);
  overflow:hidden;box-shadow:var(--sh-xl)}
.mock-bar{display:flex;align-items:center;gap:6px;padding:10px 14px;background:var(--bg);
  border-bottom:1px solid var(--border)}
.mock-dot{width:8px;height:8px;border-radius:50%}
.mock-url{flex:1;margin-left:10px;height:22px;background:var(--white);border-radius:4px;
  border:1px solid var(--border);padding:0 10px;font-size:10px;color:var(--text-muted);
  font-family:var(--font-mono);display:flex;align-items:center}
.mock-body{padding:14px;background:var(--bg);min-height:260px}
.mk-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.mk-title{font-family:var(--font-display);font-size:12px;font-weight:700;color:var(--ink)}
.mk-badges{display:flex;gap:4px}
.mk-bg{padding:2px 7px;border-radius:4px;font-size:8px;font-weight:600;font-family:var(--font-mono)}
.mk-bg-g{background:var(--green-bg);color:var(--green)}
.mk-bg-b{background:var(--brand-bg);color:var(--brand)}
.mk-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}
.mk-card{background:var(--white);border:1px solid var(--border);border-radius:var(--r-sm);padding:8px 9px}
.mk-cl{font-size:8px;color:var(--text-muted);margin-bottom:2px;text-transform:uppercase;
  letter-spacing:.04em;font-family:var(--font-mono)}
.mk-cv{font-family:var(--font-display);font-size:14px;font-weight:800;color:var(--ink)}
.mk-cs{font-size:7.5px;color:var(--green);font-family:var(--font-mono)}
.mk-chart{background:var(--white);border:1px solid var(--border);border-radius:var(--r-sm);padding:9px;margin-bottom:10px}
.mk-ctl{font-size:8px;font-weight:600;color:var(--text-muted);margin-bottom:6px;
  text-transform:uppercase;font-family:var(--font-mono);letter-spacing:.04em}
.mk-bars{display:flex;align-items:flex-end;gap:3px;height:44px}
.mk-b{flex:1;border-radius:2px 2px 0 0}
.mk-tbl{background:var(--white);border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden}
.mk-th{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:5px 9px;
  background:var(--bg);border-bottom:1px solid var(--border)}
.mk-th span{font-size:7.5px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
  font-family:var(--font-mono);letter-spacing:.04em}
.mk-tr{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:5px 9px;
  border-bottom:1px solid var(--border-light);align-items:center}
.mk-tr:last-child{border:none}
.mk-tr span{font-size:8.5px;color:var(--text-secondary);font-family:var(--font-mono)}
.mk-tr span:first-child{font-weight:600;color:var(--ink)}
.pill{padding:2px 6px;border-radius:3px;font-size:7.5px;font-weight:600;display:inline-block;font-family:var(--font-mono)}
.pill-r{background:var(--red-bg);color:var(--red)}.pill-y{background:var(--amber-bg);color:var(--amber)}
.pill-g{background:var(--green-bg);color:var(--green)}.pill-b{background:var(--brand-bg);color:var(--brand)}
.mock-fade{position:absolute;bottom:0;left:0;right:0;height:60px;
  background:linear-gradient(transparent,var(--white));pointer-events:none;z-index:2}

/* ── Clients ── */
.clients{padding:40px 0;background:var(--bg);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.clients-label{text-align:center;font-size:11px;font-weight:500;color:var(--text-muted);
  text-transform:uppercase;letter-spacing:.08em;margin-bottom:22px;font-family:var(--font-mono)}
.cl-scroll{overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;padding-bottom:4px}
.cl-scroll::-webkit-scrollbar{display:none}
.cl-track{display:flex;gap:8px;min-width:max-content;padding:0 24px;animation:scroll-cl 45s linear infinite}
@keyframes scroll-cl{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.cl-track:hover{animation-play-state:paused}
.cl-card{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--r);
  border:1px solid var(--border);background:var(--white);flex-shrink:0;min-width:165px;
  transition:all .2s;cursor:default}
.cl-card:hover{border-color:var(--border-hover);box-shadow:var(--sh)}
.cl-ini{width:32px;height:32px;border-radius:7px;display:flex;align-items:center;
  justify-content:center;font-family:var(--font-display);font-size:11px;font-weight:800;
  color:#fff;flex-shrink:0}
.cl-name{font-size:13px;font-weight:600;color:var(--ink);letter-spacing:-.01em;line-height:1.2}
.cl-sec{font-size:10px;color:var(--text-muted);margin-top:1px;font-family:var(--font-mono)}
.trust-row{display:flex;align-items:center;justify-content:center;gap:24px;margin-top:18px;flex-wrap:wrap}
.trust-b{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:500;
  color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.03em}
.trust-b svg{width:13px;height:13px;color:var(--text-muted);opacity:.6}

/* ── Features ── */
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.feat{background:var(--white);border:1px solid var(--border);border-radius:var(--r-lg);
  padding:26px 22px;transition:all .25s;position:relative}
.feat:hover{border-color:var(--border-hover);box-shadow:var(--sh-lg);transform:translateY(-2px)}
.feat-ico{width:38px;height:38px;border-radius:var(--r);display:flex;align-items:center;
  justify-content:center;margin-bottom:14px}
.feat-ico svg{width:18px;height:18px}
.feat-ico.amber{background:var(--amber-bg);color:var(--amber)}
.feat-ico.indigo{background:var(--brand-bg);color:var(--brand)}
.feat-ico.violet{background:var(--violet-bg);color:var(--violet)}
.feat-ico.red{background:var(--red-bg);color:var(--red)}
.feat-ico.cyan{background:var(--cyan-bg);color:var(--cyan)}
.feat-ico.green{background:var(--green-bg);color:var(--green)}
.feat .t3{margin-bottom:5px}

/* ── Pipeline ── */
.pipe{display:grid;grid-template-columns:repeat(4,1fr);gap:0;position:relative}
.pipe::before{content:'';position:absolute;top:24px;left:12.5%;right:12.5%;height:2px;
  background:var(--border)}
.pipe-step{text-align:center;position:relative;z-index:1;padding:0 14px}
.pipe-n{width:48px;height:48px;border-radius:50%;background:var(--white);
  border:2px solid var(--border);display:inline-flex;align-items:center;justify-content:center;
  font-family:var(--font-mono);font-size:15px;font-weight:600;color:var(--brand);
  margin-bottom:14px;transition:all .25s}
.pipe-step:hover .pipe-n{background:var(--brand);color:#fff;border-color:var(--brand);
  box-shadow:0 3px 12px rgba(67,56,202,.2)}
.pipe-step .t4{margin-bottom:4px}
.pipe-step .body-s{max-width:180px;margin:0 auto}

/* ── Stats ── */
.stats-box{display:grid;grid-template-columns:repeat(6,1fr);border:1px solid var(--border);
  border-radius:var(--r-lg);background:var(--white);overflow:hidden}
.stat{text-align:center;padding:24px 10px;position:relative;transition:background .2s}
.stat:hover{background:var(--bg)}
.stat:not(:last-child)::after{content:'';position:absolute;right:0;top:18%;bottom:18%;
  width:1px;background:var(--border)}
.stat-v{font-family:var(--font-display);font-size:26px;font-weight:800;color:var(--ink);letter-spacing:-.03em}
.stat-l{font-size:10.5px;color:var(--text-muted);margin-top:2px;font-family:var(--font-mono);
  text-transform:uppercase;letter-spacing:.03em}

/* ── Integrations ── */
.int-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;max-width:820px;margin:0 auto}
.int-card{background:var(--white);border:1px solid var(--border);border-radius:var(--r);
  padding:14px 12px;display:flex;align-items:center;gap:10px;transition:all .2s}
.int-card:hover{border-color:var(--border-hover);box-shadow:var(--sh-md);transform:translateY(-1px)}
.int-em{width:32px;height:32px;border-radius:var(--r-sm);display:flex;align-items:center;
  justify-content:center;font-size:17px;flex-shrink:0;background:var(--bg)}
.int-nm{font-size:13px;font-weight:600;color:var(--ink)}.int-tp{font-size:10px;
  color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.03em}

/* ── Pricing ── */
.price-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:920px;margin:0 auto}
.price{background:var(--white);border:1px solid var(--border);border-radius:var(--r-lg);
  padding:28px 24px;position:relative;transition:all .25s}
.price:hover{box-shadow:var(--sh-lg)}
.price.pop{border-color:var(--brand);box-shadow:var(--sh-lg)}
.price.pop::before{content:'Most Popular';position:absolute;top:-11px;left:50%;transform:translateX(-50%);
  background:var(--brand);color:#fff;font-size:10px;font-weight:600;padding:3px 14px;
  border-radius:99px;font-family:var(--font-mono);letter-spacing:.02em}
.price-name{font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--ink);margin-bottom:4px}
.price-desc{font-size:13px;color:var(--text-secondary);margin-bottom:18px;line-height:1.5}
.price-amt{display:flex;align-items:baseline;gap:2px;margin-bottom:3px}
.price-cur{font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--ink)}
.price-num{font-family:var(--font-display);font-size:36px;font-weight:800;color:var(--ink);
  letter-spacing:-.04em;line-height:1}
.price-per{font-size:11px;color:var(--text-muted);margin-bottom:20px;font-family:var(--font-mono)}
.price-list{list-style:none;margin-bottom:22px;display:flex;flex-direction:column;gap:7px}
.price-list li{display:flex;align-items:flex-start;gap:7px;font-size:13px;color:var(--text);line-height:1.4}
.price-list li svg{width:14px;height:14px;color:var(--green);flex-shrink:0;margin-top:2px}
.price-cta{width:100%}

/* ── CTA ── */
.cta-sec{padding:72px 0;background:var(--brand);position:relative;overflow:hidden}
.cta-sec::before{content:'';position:absolute;inset:0;
  background:radial-gradient(ellipse 50% 60% at 30% 50%,rgba(255,255,255,.06),transparent),
    radial-gradient(ellipse 50% 60% at 70% 50%,rgba(255,255,255,.04),transparent)}
.cta-in{max-width:560px;margin:0 auto;padding:0 24px;text-align:center;position:relative;z-index:1}
.cta-in .t2{color:#fff;margin-bottom:10px}
.cta-in .body{color:rgba(255,255,255,.7);margin:0 auto 28px;max-width:440px}
.cta-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.btn-cta-w{background:#fff;color:var(--brand);font-family:var(--font-body);font-size:14px;
  font-weight:600;border:none;cursor:pointer;border-radius:var(--r);padding:11px 24px;
  transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.btn-cta-w:hover{background:var(--bg);transform:translateY(-1px);box-shadow:var(--sh-lg)}
.btn-cta-o{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25);
  font-family:var(--font-body);font-size:14px;font-weight:600;cursor:pointer;
  border-radius:var(--r);padding:11px 24px;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.btn-cta-o:hover{border-color:rgba(255,255,255,.5);background:rgba(255,255,255,.06)}

/* ── Footer ── */
.foot{background:var(--bg);border-top:1px solid var(--border);padding:44px 0 20px}
.foot-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:32px;margin-bottom:32px}
.foot-logo{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.foot-logo-mark{width:22px;height:22px;border-radius:5px;background:var(--brand);
  display:flex;align-items:center;justify-content:center}
.foot-logo-mark svg{width:12px;height:12px;color:#fff}
.foot-logo-text{font-family:var(--font-display);font-size:15px;font-weight:800;
  color:var(--ink);letter-spacing:-.02em}
.foot-tag{font-size:13px;color:var(--text-muted);line-height:1.6;max-width:260px}
.foot-ht{font-family:var(--font-mono);font-size:10.5px;font-weight:600;color:var(--text-secondary);
  text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px}
.foot-ul{list-style:none;display:flex;flex-direction:column;gap:7px}
.foot-ul li a{font-size:13px;color:var(--text-muted);transition:color .15s}
.foot-ul li a:hover{color:var(--ink)}
.foot-bot{border-top:1px solid var(--border);padding-top:18px;
  display:flex;justify-content:space-between;align-items:center}
.foot-cp{font-size:11px;color:var(--text-muted);font-family:var(--font-mono)}
.foot-leg{display:flex;gap:16px}
.foot-leg a{font-size:11px;color:var(--text-muted);font-family:var(--font-mono)}
.foot-leg a:hover{color:var(--text-secondary)}

/* ── Responsive ── */
@media(max-width:1024px){
  .hero{padding:96px 0 56px}
  .feat-grid{grid-template-columns:repeat(2,1fr)}
  .stats-box{grid-template-columns:repeat(3,1fr)}
  .stat:nth-child(3)::after{display:none}
  .pipe{grid-template-columns:repeat(2,1fr);gap:24px}.pipe::before{display:none}
  .int-grid{grid-template-columns:repeat(3,1fr)}
  .foot-grid{grid-template-columns:1fr 1fr;gap:24px}
  .mk-row{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:768px){
  .sec,.sec-alt{padding:52px 0}
  .hero{padding:80px 0 44px}
  .hero-kpi{flex-direction:column;max-width:240px;border-radius:var(--r)}
  .hero-kpi-item:not(:last-child)::after{display:none}
  .hero-kpi-item{border-bottom:1px solid var(--border);padding:12px 16px}
  .hero-kpi-item:last-child{border:none}
  .price-grid{grid-template-columns:1fr;max-width:360px}
  .stats-box{grid-template-columns:repeat(2,1fr)}
  .stat::after{display:none!important}
  .int-grid{grid-template-columns:repeat(2,1fr)}
  .foot-grid{grid-template-columns:1fr;gap:20px}
  .foot-bot{flex-direction:column;gap:10px;text-align:center}
  .nav-links{display:none}
  .nav-ham{display:block}
  .nav-links.open{display:flex;flex-direction:column;position:absolute;top:56px;left:0;right:0;
    background:var(--white);border-bottom:1px solid var(--border);padding:14px 24px;
    box-shadow:var(--sh-lg);gap:4px}
  .cl-track{animation-duration:30s}
}
@media(max-width:480px){
  .feat-grid{grid-template-columns:1fr}
  .pipe{grid-template-columns:1fr}
  .int-grid{grid-template-columns:1fr}
  .stats-box{grid-template-columns:1fr}
  .hero-btns{flex-direction:column;align-items:center}
  .mk-row{grid-template-columns:1fr 1fr}
}
`;

/* ── SVG Icons ── */
const EyeIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const Chk = () => <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l2.8 2.8L11 4"/></svg>;
const Arr = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12m-4-4l4 4-4 4"/></svg>;
const Shield = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const Lock = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
const Srv = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="0.5" fill="currentColor"/><circle cx="6" cy="18" r="0.5" fill="currentColor"/></svg>;
const Menu = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const XIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const DocIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;

/* Feature icons */
const IncIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const BrainIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/><path d="M9 21h6"/></svg>;
const MicIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>;
const ZapIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const BoxIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
const ActIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;

/* ── Data ── */
const FEATURES = [
  { Icon: IncIcon, c: 'amber', t: 'Incident Intelligence', d: 'Auto-classify, prioritize, and route incidents with AI-powered triage. Impact×Urgency matrix calculates priority automatically.' },
  { Icon: BrainIcon, c: 'indigo', t: 'AI Root Cause Analysis', d: 'Deep correlation engine maps alerts to underlying problems using 17+ knowledge base patterns and Prometheus enrichment.' },
  { Icon: ZapIcon, c: 'red', t: 'Auto-Remediation', d: '8 built-in remediation actions — disk cleanup, pod restart, service recovery, memory release — executed via SSH in seconds.' },
  { Icon: BoxIcon, c: 'cyan', t: 'K8s Orchestration', d: 'Full Kubernetes visibility via SSH-proxied kubectl. Monitor pods, deployments, services, and events across clusters.' },
  { Icon: ActIcon, c: 'green', t: 'Real-time Metrics', d: 'Live Prometheus queries and Grafana dashboards embedded. CPU, memory, disk, network, IOPS — unified view per asset.' },
  { Icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, c: 'violet', t: 'ITIL Compliance', d: 'Full ITIL v4 lifecycle — incidents, problems, changes, CMDB, SLA management, and knowledge base in one platform.' },
];

const STEPS = [
  { n: '01', t: 'Alert Detected', d: 'Prometheus, Grafana, or external webhook fires. Alert ingested and deduplicated.' },
  { n: '02', t: 'AI Triage', d: 'Auto-classify severity and category. Route to the right team. Enrich with live metrics.' },
  { n: '03', t: 'Auto-Heal', d: 'Proven remediation actions execute automatically via SSH with full audit trail.' },
  { n: '04', t: 'Verify & Close', d: 'Health checks confirm resolution. Auto-resolve if metrics normalize within SLA.' },
];

const STATS = PLATFORM.stats;

const INTEGRATIONS = [
  { n: 'Prometheus', t: 'Monitoring', e: '🔥' }, { n: 'Grafana', t: 'Dashboards', e: '📊' },
  { n: 'Kubernetes', t: 'Orchestration', e: '☸️' }, { n: 'PagerDuty', t: 'On-Call', e: '📟' },
  { n: 'Slack', t: 'Messaging', e: '💬' }, { n: 'ServiceNow', t: 'ITSM', e: '🎫' },
  { n: 'StackStorm', t: 'Automation', e: '⚡' }, { n: 'Loki', t: 'Logging', e: '📋' },
  { n: 'PostgreSQL', t: 'Database', e: '🐘' }, { n: 'Redis', t: 'Cache', e: '🔴' },
  { n: 'Ollama AI', t: 'LLM Engine', e: '🧠' }, { n: 'Apprise', t: 'Notifications', e: '🔔' },
];

const CLIENTS = PLATFORM.clients;


/* ── Animated counter ── */
function Counter({ end, suffix = '', prefix = '', visible }: { end: number; suffix?: string; prefix?: string; visible: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const dur = 2000, start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(eased * end);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [end, visible]);
  const display = end % 1 !== 0 ? v.toFixed(1) : Math.round(v).toLocaleString();
  return <>{prefix}{display}{suffix}</>;
}

/* ── Page ── */
export default function LandingPage() {
  const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statsVis, setStatsVis] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setStatsVis(true); obs.unobserve(el); }
    }, { threshold: 0.25 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const go = useCallback((id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div className="lp">

        {/* ═══ Nav ═══ */}
        <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
          <div className="nav-in">
            <div className="nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="nav-logo-mark"><EyeIcon /></div>
              <span className="nav-logo-text">{PLATFORM.name}</span>
            </div>
            <div className={`nav-links${menuOpen ? ' open' : ''}`}>
              <button className="nav-lk" onClick={() => go('features')}>Features</button>
              <button className="nav-lk" onClick={() => go('how')}>How It Works</button>
              <button className="nav-lk" onClick={() => go('integrations')}>Integrations</button>
              <button className="nav-lk" onClick={() => nav('/docs')}>API Docs</button>
            </div>
            <div className="nav-r">
              <button className="nav-sign" onClick={() => nav('/login')}>Sign In</button>
              <button className="btn btn-p" onClick={() => nav('/signup')}>Get Started</button>
              <button className="nav-ham" onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <XIcon /> : <Menu />}
              </button>
            </div>
          </div>
        </nav>

        {/* ═══ Hero ═══ */}
        <section className="hero">
          <div className="mx">
            <div className="hero-content">
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                {PLATFORM.hero.badge}
              </div>
              <h1 className="t1">
                {PLATFORM.hero.title1}<br />
                <span className="brand-text">{PLATFORM.hero.title2}</span>
              </h1>
              <p className="hero-desc">
                {PLATFORM.hero.description}
              </p>
              <div className="hero-btns">
                <button className="btn btn-p btn-lg" onClick={() => nav('/signup')}>Start Free Trial <Arr /></button>
                <button className="btn btn-s btn-lg" onClick={() => nav('/docs')}><DocIcon /> API Docs</button>
                <button className="btn btn-ghost btn-lg" onClick={() => go('how')}>See How It Works</button>
              </div>
              <div className="hero-kpi">
                {PLATFORM.kpis.map((kpi, i) => (
                  <div key={i} className="hero-kpi-item">
                    <div className="hero-kv">{kpi.value}</div>
                    <div className="hero-kl">{kpi.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Product Mockup */}
          <div className="mock-wrap" style={{ position: 'relative' }}>
            <div className="mock">
              <div className="mock-bar">
                <div className="mock-dot" style={{ background: '#EF4444' }} />
                <div className="mock-dot" style={{ background: '#F59E0B' }} />
                <div className="mock-dot" style={{ background: '#10B981' }} />
                <div className="mock-url">{window.location.host}/dashboard</div>
              </div>
              <div className="mock-body">
                <div className="mk-head">
                  <div className="mk-title">Mission Control</div>
                  <div className="mk-badges">
                    <span className="mk-bg mk-bg-g">LIVE</span>
                    <span className="mk-bg mk-bg-b">AI Active</span>
                  </div>
                </div>
                <div className="mk-row">
                  {[
                    { l: 'Open Incidents', v: '23', s: '-12% vs last week' },
                    { l: 'MTTR', v: '1.8m', s: 'below SLA target' },
                    { l: 'SLA Compliance', v: '99.2%', s: '+0.3% this month' },
                    { l: 'Auto-Resolved', v: '67%', s: 'by AI pipeline' },
                  ].map((c, i) => (
                    <div key={i} className="mk-card">
                      <div className="mk-cl">{c.l}</div>
                      <div className="mk-cv">{c.v}</div>
                      <div className="mk-cs">{c.s}</div>
                    </div>
                  ))}
                </div>
                <div className="mk-chart">
                  <div className="mk-ctl">Incident Volume (7d)</div>
                  <div className="mk-bars">
                    {[35, 52, 28, 64, 41, 38, 22].map((h, i) => (
                      <div key={i} className="mk-b" style={{
                        height: `${h}%`,
                        background: h > 50 ? 'rgba(217,119,6,.55)' : 'rgba(67,56,202,.5)',
                        opacity: .7 + i * .04,
                      }} />
                    ))}
                  </div>
                </div>
                <div className="mk-tbl">
                  <div className="mk-th"><span>Incident</span><span>Priority</span><span>Status</span><span>Team</span></div>
                  <div className="mk-tr"><span>INC0004521</span><span><span className="pill pill-r">P1</span></span><span><span className="pill pill-r">Active</span></span><span>NOC</span></div>
                  <div className="mk-tr"><span>INC0004520</span><span><span className="pill pill-y">P2</span></span><span><span className="pill pill-y">In Progress</span></span><span>DevOps</span></div>
                  <div className="mk-tr"><span>INC0004519</span><span><span className="pill pill-b">P3</span></span><span><span className="pill pill-g">Resolved</span></span><span>Infra</span></div>
                </div>
              </div>
            </div>
            <div className="mock-fade" />
          </div>
        </section>

        {/* ═══ Clients ═══ */}
        <section className="clients">
          <div className="mx">
            <div className="clients-label">{PLATFORM.clientsLabel}</div>
          </div>
          <div className="cl-scroll">
            <div className="cl-track">
              {[...CLIENTS, ...CLIENTS].map((c, i) => (
                <div key={i} className="cl-card">
                  <div className="cl-ini" style={{ background: c.c }}>{c.i}</div>
                  <div>
                    <div className="cl-name">{c.n}</div>
                    <div className="cl-sec">{c.s} · {c.city}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mx">
            <div className="trust-row">
              <div className="trust-b"><Shield /> SOC 2 Compliant</div>
              <div className="trust-b"><Lock /> ISO 27001</div>
              <div className="trust-b"><Srv /> 99.9% Uptime SLA</div>
              <div className="trust-b"><Shield /> RBAC + Multi-Tenant</div>
            </div>
          </div>
        </section>

        {/* ═══ Features ═══ */}
        <section className="sec" id="features">
          <div className="mx">
            <div className="sec-hd">
              <span className="over">Capabilities</span>
              <h2 className="t2">Everything you need to manage IT operations</h2>
              <p className="body">From alert detection to automated resolution — {PLATFORM.name} handles the full ITIL lifecycle.</p>
            </div>
            <div className="feat-grid">
              {FEATURES.map((f, i) => (
                <div key={i} className="feat">
                  <div className={`feat-ico ${f.c}`}><f.Icon /></div>
                  <h3 className="t3">{f.t}</h3>
                  <p className="body-s">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ How It Works ═══ */}
        <section className="sec-alt" id="how">
          <div className="mx">
            <div className="sec-hd">
              <span className="over">Pipeline</span>
              <h2 className="t2">From alert to resolution in minutes</h2>
              <p className="body">Our AI-powered pipeline detects, triages, remediates, and verifies — automatically.</p>
            </div>
            <div className="pipe">
              {STEPS.map((s, i) => (
                <div key={i} className="pipe-step">
                  <div className="pipe-n">{s.n}</div>
                  <h4 className="t4">{s.t}</h4>
                  <p className="body-s">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Stats ═══ */}
        <section className="sec" ref={statsRef}>
          <div className="mx">
            <div className="sec-hd">
              <span className="over">By the Numbers</span>
              <h2 className="t2">Proven at scale across production environments</h2>
            </div>
            <div className="stats-box">
              {STATS.map((s, i) => (
                <div key={i} className="stat">
                  <div className="stat-v">
                    <Counter end={s.v} suffix={s.s} prefix={s.p || ''} visible={statsVis} />
                  </div>
                  <div className="stat-l">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Integrations ═══ */}
        <section className="sec-alt" id="integrations">
          <div className="mx">
            <div className="sec-hd">
              <span className="over">Ecosystem</span>
              <h2 className="t2">Works with your existing stack</h2>
              <p className="body">Native integrations with monitoring, alerting, orchestration, and communication platforms.</p>
            </div>
            <div className="int-grid">
              {INTEGRATIONS.map((ig, i) => (
                <div key={i} className="int-card">
                  <div className="int-em">{ig.e}</div>
                  <div><div className="int-nm">{ig.n}</div><div className="int-tp">{ig.t}</div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="cta-sec">
          <div className="cta-in">
            <h2 className="t2">{PLATFORM.cta.title}</h2>
            <p className="body">{PLATFORM.cta.description}</p>
            <div className="cta-btns">
              <button className="btn-cta-w" onClick={() => nav('/signup')}>Start Free Trial <Arr /></button>
              <button className="btn-cta-o" onClick={() => nav('/docs')}>API Documentation</button>
            </div>
          </div>
        </section>

        {/* ═══ Footer ═══ */}
        <footer className="foot">
          <div className="mx">
            <div className="foot-grid">
              <div>
                <div className="foot-logo">
                  <div className="foot-logo-mark"><EyeIcon /></div>
                  <span className="foot-logo-text">{PLATFORM.name}</span>
                </div>
                <p className="foot-tag">{PLATFORM.footerDescription}</p>
              </div>
              <div>
                <div className="foot-ht">Product</div>
                <ul className="foot-ul">
                  <li><a href="#features" onClick={e => { e.preventDefault(); go('features'); }}>Features</a></li>
                  <li><a href="#integrations" onClick={e => { e.preventDefault(); go('integrations'); }}>Integrations</a></li>
                  <li><a href="#how" onClick={e => { e.preventDefault(); go('how'); }}>How It Works</a></li>
                </ul>
              </div>
              <div>
                <div className="foot-ht">Platform</div>
                <ul className="foot-ul">
                  <li><a href="/signup">Sign Up</a></li>
                  <li><a href="/login">Sign In</a></li>
                  <li><a href="/docs">API Docs</a></li>
                  <li><a href="#features" onClick={e => { e.preventDefault(); go('features'); }}>Incident Management</a></li>
                  <li><a href="#features" onClick={e => { e.preventDefault(); go('features'); }}>Auto-Remediation</a></li>
                </ul>
              </div>
              <div>
                <div className="foot-ht">Company</div>
                <ul className="foot-ul">
                  <li><a href={PLATFORM.website} target="_blank" rel="noopener noreferrer">{PLATFORM.companyShort}</a></li>
                  <li><a href={PLATFORM.website} target="_blank" rel="noopener noreferrer">{PLATFORM.parentBrand}</a></li>
                  <li><a href={`mailto:${PLATFORM.supportEmail}`}>Contact</a></li>
                </ul>
              </div>
            </div>
            <div className="foot-bot">
              <div className="foot-cp">&copy; {new Date().getFullYear()} {PLATFORM.company}. All rights reserved.</div>
              <div className="foot-leg">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
