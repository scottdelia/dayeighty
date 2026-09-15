import type { Config } from 'tailwindcss';

/* ===========================================================================
   TOKENS

   Paper, not panel. A production runs on printed call sheets, a stripboard on
   the wall, and colored revision pages, so the interface borrows from print:
   a warm ground, black ink, a serif for anything that has to be read aloud,
   and color reserved for two jobs only.

   1. Verdicts. `block`, `review`, `open`, `clear` are the four tiers every
      engine in this app emits. They are never used decoratively.

   2. The stripboard. Yellow for day exterior, green for night exterior, white
      for day interior, blue for night interior. That is the industry's own
      convention, unchanged since the days of cardboard strips, and anyone who
      has stood in a production office will read it without a legend.
   =========================================================================== */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F5F2EC',
        surface: '#FFFFFF',
        sunken: '#EFEBE3',
        line: '#E4DFD5',
        'line-strong': '#CFC8BB',

        ink: '#151517',
        body: '#3F3F46',
        muted: '#77777F',
        faint: '#A8A8B0',

        accent: {
          DEFAULT: '#0F4C5C',
          ink: '#0B3A47',
          soft: '#E4EEF0',
          edge: '#B7D1D7',
        },

        block: { DEFAULT: '#B42318', wash: '#FEF3F2', edge: '#FDA29B', deep: '#912018' },
        review: { DEFAULT: '#B54708', wash: '#FFFAEB', edge: '#FEC84B', deep: '#93370D' },
        open: { DEFAULT: '#475467', wash: '#F2F4F7', edge: '#D0D5DD', deep: '#344054' },
        clear: { DEFAULT: '#067647', wash: '#ECFDF3', edge: '#6CE9A6', deep: '#05603A' },

        strip: {
          dayext: '#F7E37A',
          nightext: '#A5D8B0',
          dayint: '#FFFFFF',
          nightint: '#A9C4EA',
          lost: '#F4A69C',
        },
      },

      fontFamily: {
        display: ['"Fraunces Variable"', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'Consolas', 'Menlo', 'monospace'],
      },

      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },

      boxShadow: {
        card: '0 1px 2px rgba(21, 21, 23, 0.04), 0 1px 3px rgba(21, 21, 23, 0.05)',
        lift: '0 12px 32px -16px rgba(21, 21, 23, 0.22), 0 2px 6px -2px rgba(21, 21, 23, 0.06)',
        ring: '0 0 0 3px rgba(15, 76, 92, 0.16)',
      },

      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },

      letterSpacing: {
        eyebrow: '0.06em',
      },

      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        rise: 'rise 0.32s cubic-bezier(0.2, 0.7, 0.2, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
