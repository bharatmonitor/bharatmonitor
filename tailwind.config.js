/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#07090f',
          1: '#0d1018',
          2: '#121620',
          3: '#181d28',
          4: '#1e2535',
        },
        border: {
          0: 'rgba(255,255,255,0.035)',
          1: 'rgba(255,255,255,0.08)',
          2: 'rgba(255,255,255,0.13)',
          3: 'rgba(255,255,255,0.18)',
        },
        text: {
          0: '#edf0f8',
          1: '#9aa3b8',
          2: '#545f78',
          3: '#2e3650',
        },
        red: {
          DEFAULT: '#f03e3e',
          bg: 'rgba(240,62,62,0.08)',
          border: 'rgba(240,62,62,0.17)',
        },
        yellow: {
          DEFAULT: '#f5a623',
          bg: 'rgba(245,166,35,0.08)',
          border: 'rgba(245,166,35,0.17)',
        },
        blue: {
          DEFAULT: '#3d8ef0',
          bg: 'rgba(61,142,240,0.08)',
          border: 'rgba(61,142,240,0.17)',
        },
        silver: {
          DEFAULT: '#8892a4',
          bg: 'rgba(136,146,164,0.08)',
          border: 'rgba(136,146,164,0.17)',
        },
        green: { DEFAULT: '#22d3a0' },
        accent: { DEFAULT: '#7c6dfa', dark: '#5a4fd4' },
        tw: '#1d9bf0',
        yt: '#ff2020',
        ig: '#e1306c',
        fb: '#1877f2',
        wa: '#25d366',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        '2xs': '0.65rem',
        xs: '0.75rem',
      },
    },
  },
  plugins: [],
}
