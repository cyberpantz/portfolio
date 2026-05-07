/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0a0a0a',
          surface: '#111111',
          surface2: '#181818',
        },
        rule: {
          DEFAULT: '#1f1f1f',
          strong: '#2a2a2a',
        },
        fg: {
          DEFAULT: '#e2e2e2',
          sub: '#999999',
          muted: '#808080',
        },
        exp: {
          bright: 'rgba(255,255,255,0.80)',
          base:   'rgba(255,255,255,0.60)',
          muted:  'rgba(255,255,255,0.45)',
          dim:    'rgba(255,255,255,0.30)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent) / 0.1)',
          ring: 'rgb(var(--accent) / 0.3)',
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-up':   'fadeUp 0.7s cubic-bezier(0.4,0,0.2,1) both',
        'fade-up-2': 'fadeUp 0.7s 0.1s cubic-bezier(0.4,0,0.2,1) both',
        'fade-up-3': 'fadeUp 0.7s 0.2s cubic-bezier(0.4,0,0.2,1) both',
        blink:       'blink 1.1s step-end infinite',
        'gallery-in': 'galleryIn 0.15s ease-out both',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0' },
        },
        galleryIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
