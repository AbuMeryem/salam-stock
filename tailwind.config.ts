import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "var(--bg-cream)",
        "card-bg": "var(--bg-card)",
        primary: {
          DEFAULT: "var(--primary-green)",
          hover: "var(--primary-green-hover)",
          dark: "var(--primary-green-dark)",
        },
        gold: {
          DEFAULT: "var(--accent-gold)",
          bright: "var(--accent-gold-bright)",
          soft: "var(--accent-gold-soft)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          ondark: "var(--text-on-dark)",
          ondarkmuted: "var(--text-on-dark-muted)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
        },
        success: {
          DEFAULT: "var(--success)",
          soft: "var(--success-soft)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          soft: "var(--warning-soft)",
        },
        line: {
          light: "var(--border-light)",
          medium: "var(--border-medium)",
        },
        rule: "var(--border-light)",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 2px 12px rgba(14,59,46,0.06)",
        "card-lg": "0 8px 32px rgba(14,59,46,0.12)",
        "card-hover": "0 4px 20px rgba(14,59,46,0.1)",
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "slide-up": "slideUp 280ms cubic-bezier(0.22,0.61,0.36,1)",
        "scale-in": "scaleIn 200ms ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
