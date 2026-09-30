/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontFamily: {
      sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
    },
    extend: {
      colors: {
        clinical: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
        },
        surface: {
          light: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
        },
        cta: {
          DEFAULT: '#F97316',
          hover: '#EA580C',
        },
        triage: {
          p1: '#DC2626',
          'p1-bg': '#FEF2F2',
          p2: '#D97706',
          'p2-bg': '#FFFBEB',
          p3: '#16A34A',
          'p3-bg': '#F0FDF4',
          info: '#2563EB',
          'info-bg': '#EFF6FF',
        },
      },
      borderRadius: {
        clinical: '12px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        elevated: '0 4px 20px -4px rgba(0, 0, 0, 0.08)',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'laser-scan': {
          '0%': { top: '4%' },
          '50%': { top: '92%' },
          '100%': { top: '4%' },
        },
        // Used when the login screen swaps the role / khoa picker in.
        'fade-rise': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
        'laser-scan': 'laser-scan 1.6s ease-in-out infinite',
        'fade-rise': 'fade-rise 260ms ease-out both',
      },
    },
  },
  plugins: [],
}
