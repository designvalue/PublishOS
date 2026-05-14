import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      letterSpacing: {
        tight: "-0.005em",
        tighter: "-0.012em",
        tightest: "-0.022em",
      },
      borderRadius: {
        sm: "5px",
        DEFAULT: "7px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "14px",
      },
      keyframes: {
        viewIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        ddIn: {
          from: { opacity: "0", transform: "translateY(-4px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulse: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.85)" },
        },
      },
      animation: {
        viewIn: "viewIn .28s cubic-bezier(.2,.8,.2,1)",
        ddIn: "ddIn .14s cubic-bezier(.2,.8,.2,1)",
        pulse: "pulse 2.4s ease-in-out infinite",
      },
    },
  },
};

export default config;
