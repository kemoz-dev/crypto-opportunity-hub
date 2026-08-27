import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";
type ThemeMode = Theme | "system";

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem("theme");
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function getSystemTheme(defaultTheme: Theme): Theme {
  if (typeof window === "undefined") return defaultTheme;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : defaultTheme;
}

export function ThemeProvider({ children, defaultTheme = "light", switchable = true }: ThemeProviderProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialThemeMode());
  const [systemTheme, setSystemTheme] = useState<Theme>(() => getSystemTheme(defaultTheme));
  const theme = themeMode === "system" ? systemTheme : themeMode;

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!media) return;
    const onChange = () => setSystemTheme(media.matches ? "light" : defaultTheme);
    onChange();
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [defaultTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    if (switchable) window.localStorage.setItem("theme", themeMode);
  }, [theme, themeMode, switchable]);

  const value = useMemo<ThemeContextType>(() => ({
    theme,
    themeMode,
    setTheme: setThemeMode,
    toggleTheme: () => setThemeMode(previous => previous === "dark" ? "light" : "dark"),
    switchable,
  }), [theme, themeMode, switchable]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
