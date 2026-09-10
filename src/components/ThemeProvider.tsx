import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "system";
export type AccentColor = "blue" | "emerald" | "purple" | "rose" | "amber" | "cyan" | "slate";

export interface AccentOption {
  id: AccentColor;
  name: string;
  color: string;
  hsl: string;
  glow: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: "blue", name: "Blue", color: "#2563eb", hsl: "217.2 91.2% 59.8%", glow: "rgba(37,99,235,0.35)" },
  { id: "emerald", name: "Emerald", color: "#10b981", hsl: "160 84% 39%", glow: "rgba(16,185,129,0.35)" },
  { id: "purple", name: "Purple", color: "#8b5cf6", hsl: "258 90% 66%", glow: "rgba(139,92,246,0.35)" },
  { id: "rose", name: "Rose", color: "#f43f5e", hsl: "350 89% 60%", glow: "rgba(244,63,94,0.35)" },
  { id: "amber", name: "Amber", color: "#f59e0b", hsl: "38 92% 50%", glow: "rgba(245,158,11,0.35)" },
  { id: "cyan", name: "Cyan", color: "#06b6d4", hsl: "189 94% 43%", glow: "rgba(6,182,212,0.35)" },
  { id: "slate", name: "Slate", color: "#64748b", hsl: "215 16% 47%", glow: "rgba(100,116,139,0.35)" },
];

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  accent: "blue",
  setAccent: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultAccent = "blue",
  storageKey = "vite-ui-theme",
  accentStorageKey = "prescripto-accent-theme",
  ...props
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultAccent?: AccentColor;
  storageKey?: string;
  accentStorageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );
  const [accent, setAccent] = useState<AccentColor>(
    () => (localStorage.getItem(accentStorageKey) as AccentColor) || defaultAccent
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute("data-accent", accent);

    const activeOption = ACCENT_OPTIONS.find((a) => a.id === accent) || ACCENT_OPTIONS[0];
    root.style.setProperty("--primary", activeOption.hsl);
    root.style.setProperty("--ring", activeOption.hsl);
    root.style.setProperty("--primary-hex", activeOption.color);
    root.style.setProperty("--accent-glow", activeOption.glow);
    document.body?.style.setProperty("--primary-hex", activeOption.color);
    document.body?.style.setProperty("--accent-glow", activeOption.glow);
  }, [accent, theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
    accent,
    setAccent: (accent: AccentColor) => {
      localStorage.setItem(accentStorageKey, accent);
      setAccent(accent);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
