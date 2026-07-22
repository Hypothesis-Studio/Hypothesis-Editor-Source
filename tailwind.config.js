/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        editor: {
          bg: 'var(--editor-bg)',
          fg: 'var(--editor-fg)',
          line: 'var(--editor-line-highlight)',
          selection: 'var(--editor-selection)',
          comment: 'var(--editor-comment)',
          keyword: 'var(--editor-keyword)',
          string: 'var(--editor-string)',
          number: 'var(--editor-number)',
          function: 'var(--editor-function)',
          variable: 'var(--editor-variable)',
          type: 'var(--editor-type)',
        },
        sidebar: {
          bg: 'var(--sidebar-bg)',
          fg: 'var(--sidebar-fg)',
          border: 'var(--sidebar-border)',
          hover: 'var(--sidebar-hover)',
          active: 'var(--sidebar-active)',
        },
        titlebar: {
          bg: 'var(--titlebar-bg)',
          fg: 'var(--titlebar-fg)',
        },
        statusbar: {
          bg: 'var(--statusbar-bg)',
          fg: 'var(--statusbar-fg)',
        },
        tab: {
          bg: 'var(--tab-bg)',
          fg: 'var(--tab-fg)',
          active: 'var(--tab-active)',
          border: 'var(--tab-border)',
        },
        terminal: {
          bg: 'var(--terminal-bg)',
          fg: 'var(--terminal-fg)',
        },
        accent: {
          primary: 'var(--accent-primary)',
          secondary: 'var(--accent-secondary)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-in-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
