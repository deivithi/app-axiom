import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      /* =====================================================
         TYPOGRAPHY
         ===================================================== */
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        'orbitron': ['Orbitron', 'sans-serif'],
        'mono': ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },

      /* =====================================================
         SHADOWS (Dark-first optimized)
         ===================================================== */
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.4)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
        'glow': '0 0 30px hsl(var(--primary) / 0.3)',
        'glow-sm': '0 0 15px hsl(var(--primary) / 0.3)',
        'glow-lg': '0 0 50px hsl(var(--primary) / 0.4)',
        'glow-success': '0 0 30px hsl(var(--success) / 0.3)',
        'glow-warning': '0 0 30px hsl(var(--warning) / 0.3)',
        'glow-error': '0 0 30px hsl(var(--error) / 0.3)',
      },

      /* =====================================================
         MOTION TOKENS
         ===================================================== */
      transitionTimingFunction: {
        'smooth': 'var(--ease-smooth)',
        'spring': 'var(--ease-spring)',
        'expo': 'var(--ease-expo)',
        // Legacy aliases
        'quart': 'cubic-bezier(0.76, 0, 0.24, 1)',
      },
      transitionDuration: {
        'instant': 'var(--duration-instant)',
        'fast': 'var(--duration-fast)',
        'base': 'var(--duration-base)',
        'slow': 'var(--duration-slow)',
        'slower': 'var(--duration-slower)',
      },

      /* =====================================================
         Z-INDEX SCALE
         ===================================================== */
      zIndex: {
        'dropdown': '1000',
        'sticky': '1100',
        'modal-backdrop': '1200',
        'modal': '1300',
        'popover': '1400',
        'toast': '1500',
      },

      /* =====================================================
         SPACING SCALE (8pt grid aliases)
         ===================================================== */
      spacing: {
        'gutter': 'var(--space-4)',      // 16px - default gutter
        'section': 'var(--space-8)',     // 32px - section spacing
        'page': 'var(--space-16)',       // 64px - page margins
      },

      /* =====================================================
         COLOR SYSTEM
         ===================================================== */
      colors: {
        // Semantic colors with subtle variants
        success: {
          DEFAULT: 'hsl(var(--success))',
          subtle: 'hsl(var(--success-subtle))',
          foreground: 'hsl(0 0% 100%)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          subtle: 'hsl(var(--warning-subtle))',
          foreground: 'hsl(0 0% 0%)',
        },
        error: {
          DEFAULT: 'hsl(var(--error))',
          subtle: 'hsl(var(--error-subtle))',
          foreground: 'hsl(0 0% 100%)',
        },
        info: {
          DEFAULT: 'hsl(217 91% 60%)',
          foreground: 'hsl(0 0% 100%)',
        },

        // Elevated backgrounds
        elevated: {
          DEFAULT: 'hsl(var(--card))',
          '2': 'hsl(var(--popover))',
          '3': 'hsl(var(--elevated-3))',
        },

        // Base tokens
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // Primary with states
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
          active: "hsl(var(--primary-active))",
          subtle: "hsl(var(--primary-subtle))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },

        // Glass tokens
        glass: {
          bg: 'hsl(var(--glass-bg))',
          border: 'hsl(var(--glass-border))',
        },
      },

      /* =====================================================
         BORDER COLOR HIERARCHY
         ===================================================== */
      borderColor: {
        subtle: 'hsl(var(--border-subtle))',
        medium: 'hsl(var(--border-medium))',
        strong: 'hsl(var(--border-strong))',
      },

      /* =====================================================
         BORDER RADIUS SCALE
         ===================================================== */
      borderRadius: {
        'none': 'var(--radius-none)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        'full': 'var(--radius-full)',
      },

      /* =====================================================
         ANIMATIONS
         ===================================================== */
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(8px)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-out-right": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(var(--primary) / 0.3)" },
          "50%": { boxShadow: "0 0 40px hsl(var(--primary) / 0.5)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in var(--duration-base) var(--ease-smooth)",
        "fade-out": "fade-out var(--duration-base) var(--ease-smooth)",
        "scale-in": "scale-in var(--duration-fast) var(--ease-spring)",
        "slide-in-right": "slide-in-right var(--duration-base) var(--ease-expo)",
        "slide-out-right": "slide-out-right var(--duration-base) var(--ease-expo)",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
