import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-green': 'var(--color-primary-green)',
        'amber-warning': 'var(--color-amber-warning)',
        'error-red': 'var(--color-error-red)',
        'neutral-light': 'var(--color-neutral-light)',
        'neutral-dark': 'var(--color-neutral-dark)',
      },
      minHeight: {
        touch: '44px',
      },
      fontSize: {
        'checkin-large': '18px',
      },
    },
  },
  plugins: [],
}

export default config
