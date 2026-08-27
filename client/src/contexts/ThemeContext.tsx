import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

function getInitialTheme(defaultTheme: Theme): Theme {
  if (typeof window === "undefined") return defaultTheme;
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : defaultTheme;
}

export function ThemeProvider({ children, defaultTheme = "light", switchable = true }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme(defaultTheme));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    if (switchable) window.localStorage.setItem("theme", theme);
  }, [theme, switchable]);

  const value = useMemo<ThemeContextType>(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme(previous => previous === "light" ? "dark" : "light"),
    switchable,
  }), [theme, switchable]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
