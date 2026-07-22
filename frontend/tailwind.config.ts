import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS v4 Configuration
 * 
 * Note: In Tailwind v4, the primary configuration is done via CSS using @theme directive
 * in app/globals.css. This file serves as documentation and provides IDE support.
 * 
 * The actual theme configuration (colors, spacing, animations) is defined in:
 * - app/globals.css (@theme block)
 * 
 * See: https://tailwindcss.com/docs/v4-beta
 */
const config: Config = {
  // Content paths for class scanning
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './store/**/*.{js,ts,jsx,tsx,mdx}',
    './data/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  // Dark mode configuration
  // Using class-based dark mode strategy (matching @custom-variant in globals.css)
  darkMode: 'class',

  theme: {
    extend: {
      // Font families (matching globals.css @theme)
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
        serif: ['var(--font-instrument-serif)', 'serif'],
      },

      // Colors (matching globals.css @theme)
      // These are defined in CSS for v4, but listed here for IDE autocomplete
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          hover: 'var(--accent-hover)',
          bg: 'var(--accent-bg)',
          text: 'var(--accent-text)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: {
          DEFAULT: 'hsl(var(--border))',
          strong: 'var(--border-strong)',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        canvas: 'hsl(var(--canvas-bg))',
        grid: 'hsl(var(--grid-color))',
        
        // Surface colors
        'surface-page': 'var(--surface-page)',
        'surface-panel': 'var(--surface-panel)',
        'surface-card': 'var(--surface-card)',
        
        // Text colors
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        
        // Legacy/custom colors
        lc: '#010102',
        ls1: '#0f1011',
        ls2: '#141516',
        ls3: '#18191a',
        lp: '#1E90FF',
        lph: '#4dabf7',
        li: '#f7f8f8',
        lim: '#d0d6e0',
        lis: '#8a8f98',
        lit: '#62666d',
        lh: '#23252a',
        lhs: '#34343a',
        lg: '#27a644',
        lr: '#eb534b',
      },

      // Border radius (matching globals.css)
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      // Animations (matching globals.css @keyframes)
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        typewriter: {
          '0%, 100%': { width: '0' },
          '10%, 90%': { width: '100%' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        gradient: 'gradient 8s linear infinite',
        marquee: 'marquee 40s linear infinite',
        typewriter: 'typewriter 8s steps(40) infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },

  plugins: [],
};

export default config;
