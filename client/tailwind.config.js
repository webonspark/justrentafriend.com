/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],

  /**
   * Preflight OFF.
   *
   * Tailwind's reset and Bootstrap's reset both want to be the one that
   * normalises the page, and running both means Bootstrap's buttons, modals
   * and form controls lose their styling. React Bootstrap supplies the
   * components here, so Bootstrap's reset wins and Tailwind contributes
   * utilities only.
   *
   * The small amount of resetting still wanted lives in src/styles/base.css.
   */
  corePlugins: { preflight: false },

  theme: {
    extend: {
      colors: {
        /* Every colour is a variable from tokens.css, so the same class
           paints correctly in the black theme and the white one. */
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          raised: "var(--ink-raised)",
          high: "var(--ink-high)",
          line: "var(--ink-line)",
        },
        rose: {
          DEFAULT: "var(--rose)",
          deep: "var(--rose-deep)",
          soft: "var(--rose-soft)",
          line: "var(--rose-line)",
        },
        pink: {
          DEFAULT: "var(--pink)",
          deep: "var(--pink-deep)",
          soft: "var(--pink-soft)",
          line: "var(--pink-line)",
        },
        blush: "var(--blush)",
        paper: "var(--paper)",
        muted: "var(--muted)",
        faint: "var(--faint)",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
        panel: "24px",
      },
      boxShadow: {
        lift: "var(--shadow-lift)",
        glow: "var(--shadow-glow)",
      },
      maxWidth: { prose: "68ch" },
      keyframes: {
        rise: { from: { opacity: 0, transform: "translateY(14px)" }, to: { opacity: 1, transform: "none" } },
      },
      animation: { rise: "rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both" },
    },
  },
  plugins: [],
};
