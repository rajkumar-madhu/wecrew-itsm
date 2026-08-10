/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        void: 'var(--argus-void)',
        obsidian: 'var(--argus-surface)',
        slate: 'var(--argus-elevated)',
        gunmetal: 'var(--argus-gunmetal)',
        steel: 'var(--argus-steel)',
        graphite: 'var(--argus-graphite)',
        ink: 'var(--argus-ink)',
        muted: 'var(--argus-muted)',
        dim: 'var(--argus-dim)',
        signal: {
          DEFAULT: 'var(--argus-signal)',
          bright: 'var(--argus-signal-bright)',
          dim: 'var(--argus-signal-dim)',
        },
        cyan: {
          DEFAULT: 'var(--argus-cyan)',
          dim: 'var(--argus-cyan-dim)',
        },
        emerald: {
          DEFAULT: 'var(--argus-emerald)',
          dim: 'var(--argus-emerald-dim)',
        },
        amber: {
          DEFAULT: 'var(--argus-amber)',
          dim: 'var(--argus-amber-dim)',
        },
        crimson: {
          DEFAULT: 'var(--argus-crimson)',
          dim: 'var(--argus-crimson-dim)',
        },
        violet: {
          DEFAULT: 'var(--argus-violet)',
          dim: 'var(--argus-violet-dim)',
        },
        coral: {
          DEFAULT: 'var(--argus-coral)',
          bright: 'var(--argus-coral-bright)',
          dim: 'var(--argus-coral-dim)',
        },
        'signal-dim': 'var(--argus-signal-dim)',
        'emerald-dim': 'var(--argus-emerald-dim)',
        'amber-dim': 'var(--argus-amber-dim)',
        'crimson-dim': 'var(--argus-crimson-dim)',
        'violet-dim': 'var(--argus-violet-dim)',
      },
      fontFamily: {
        display: ['Fraunces', '"IBM Plex Sans"', 'ui-serif', 'Georgia', 'serif'],
        body: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: 'var(--argus-shadow-card)',
        'card-hover': 'var(--argus-shadow-card-hover)',
        glow: 'var(--argus-shadow-glow)',
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-6px)', opacity: 0 },
          '100%': { transform: 'translateX(0)', opacity: 1 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
