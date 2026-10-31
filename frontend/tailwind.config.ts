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
        background: "#080c14",
        surface: "#0e1524",
        "surface-raised": "#151f33",
        "surface-card": "#18243b",
        border: "#202e48",
        "border-light": "#2a3c5d",
        brand: {
          cyan: "#06b6d4",
          blue: "#3b82f6",
          navy: "#0a1120",
        },
        tier: {
          approve: "#10b981",
          stepup: "#f59e0b",
          review: "#8b5cf6",
          decline: "#ef4444",
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
};
export default config;
