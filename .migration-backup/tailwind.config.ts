import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2D7D6F',
        accent: '#4CAF7D',
        sidebar: '#1A4D44',
        background: '#F7FAF9',
      },
    },
  },
  plugins: [],
}

export default config
