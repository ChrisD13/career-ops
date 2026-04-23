/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        'ctp-base':    'rgb(var(--ctp-base) / <alpha-value>)',
        'ctp-surface': 'rgb(var(--ctp-surface) / <alpha-value>)',
        'ctp-overlay': 'rgb(var(--ctp-overlay) / <alpha-value>)',
        'ctp-text':    'rgb(var(--ctp-text) / <alpha-value>)',
        'ctp-subtext': 'rgb(var(--ctp-subtext) / <alpha-value>)',
        'ctp-blue':    'rgb(var(--ctp-blue) / <alpha-value>)',
        'ctp-green':   'rgb(var(--ctp-green) / <alpha-value>)',
        'ctp-yellow':  'rgb(var(--ctp-yellow) / <alpha-value>)',
        'ctp-red':     'rgb(var(--ctp-red) / <alpha-value>)',
        'ctp-peach':   'rgb(var(--ctp-peach) / <alpha-value>)',
        'ctp-mauve':   'rgb(var(--ctp-mauve) / <alpha-value>)',
        'ctp-sky':     'rgb(var(--ctp-sky) / <alpha-value>)',
        'ctp-teal':    'rgb(var(--ctp-teal) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        // UI-SPEC typography scale
        'label':   ['11px', { lineHeight: '1.4', fontWeight: '600' }],
        'body':    ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'heading': ['16px', { lineHeight: '1.3', fontWeight: '600' }],
        'display': ['20px', { lineHeight: '1.2', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
}
