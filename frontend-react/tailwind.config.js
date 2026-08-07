/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Argus dark control-plane palette
        void: '#060A14',
        obsidian: '#0B1424',
        slate: '#0F1B2D',
        gunmetal: '#152238',
        steel: '#1C2E4A',
        graphite: '#2A4060',
        // Text hierarchy
        ink: '#E8F1FA',
        muted: '#8AABC4',
        dim: '#5A7D99',
        // Brand + semantic
        signal: {
          DEFAULT: '#6366F1',
          bright: '#818CF8',
          dim: 'rgba(99,102,241,0.14)',
        },
        cyan: {
          DEFAULT: '#22D3EE',
          dim: 'rgba(34,211,238,0.12)',
        },
        emerald: {
          DEFAULT: '#10B981',
          dim: 'rgba(16,185,129,0.12)',
        },
        amber: {
          DEFAULT: '#F59E0B',
          dim: 'rgba(245,158,11,0.12)',
        },
        crimson: {
          DEFAULT: '#F43F5E',
          dim: 'rgba(244,63,94,0.12)',
        },
        violet: {
          DEFAULT: '#A78BFA',
          dim: 'rgba(167,139,250,0.12)',
        },
        // legacy aliases used across pages
        'signal-dim': 'rgba(99,102,241,0.14)',
        'emerald-dim': 'rgba(16,185,129,0.12)',
        'amber-dim': 'rgba(245,158,11,0.12)',
        'crimson-dim': 'rgba(244,63,94,0.12)',
        'violet-dim': 'rgba(167,139,250,0.12)',
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        card: '0 0 0 1px rgba(99,179,255,0.06), 0 8px 24px -12px rgba(0,0,0,0.55)',
        'card-hover': '0 0 0 1px rgba(99,102,241,0.25), 0 12px 32px -12px rgba(0,0,0,0.65)',
        glow: '0 0 24px -6px rgba(99,102,241,0.35)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: 0 },
          '100%': { transform: 'translateX(0)', opacity: 1 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(to right, rgba(99,179,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,179,255,0.04) 1px, transparent 1px)',
        'radial-brand':
          'radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.18) 0%, transparent 50%)',
      },
    },
  },
  plugins: [],
};
