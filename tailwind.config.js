/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif"
        ]
      },
      colors: {
        // Violet. brand-700 is the primary (buttons, active chips) and
        // brand-800 the header bar; brand-50 is the tinted page background.
        brand: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95"
        }
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 64 / 0.04), 0 1px 3px 0 rgb(16 24 64 / 0.06)"
      }
    }
  },
  plugins: []
}
