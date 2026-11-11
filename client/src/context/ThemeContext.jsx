import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Black or white, for the whole app.
 *
 * The theme is a `data-theme` attribute on <html>; tokens.css does the rest.
 * A small script in index.html sets it before the first paint, so a reload
 * never flashes the wrong theme. This provider takes over from there.
 *
 * The choice is remembered in localStorage. Someone who has never chosen
 * gets their device's setting.
 */

const STORAGE_KEY = "kindred-theme";

const ThemeContext = createContext(null);

function initialTheme() {
  const set = document.documentElement.dataset.theme;
  return set === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.bsTheme = theme; // Bootstrap's own components follow too
    // The browser bar matches the page, read from the token rather than repeated here.
    const ink = getComputedStyle(root).getPropertyValue("--ink").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", ink);
  }, [theme]);

  // Saved only when someone actually chooses, so the device's setting is
  // never frozen in as if it were a choice.
  const choose = useCallback((next) => {
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the theme still works, it just is not remembered.
    }
  }, []);

  const toggle = useCallback(() => choose(theme === "dark" ? "light" : "dark"), [choose, theme]);

  const value = useMemo(() => ({ theme, setTheme: choose, toggle }), [theme, choose, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
