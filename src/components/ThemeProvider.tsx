import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "system";
export type AccentColor = "blue" | "emerald" | "purple" | "rose" | "amber" | "cyan" | "slate" | "custom";

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

export function hexToHsl(hex: string): { hsl: string; glow: string; color: string } {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return { hsl: "217.2 91.2% 59.8%", glow: "rgba(37,99,235,0.35)", color: "#2563eb" };

  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = h / 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);
  const rawR = parseInt(c.substring(0, 2), 16);
  const rawG = parseInt(c.substring(2, 4), 16);
  const rawB = parseInt(c.substring(4, 6), 16);

  return {
    hsl: `${hDeg} ${sPct}% ${lPct}%`,
    glow: `rgba(${rawR}, ${rawG}, ${rawB}, 0.35)`,
    color: `#${c}`
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return { r: 37, g: 99, b: 235 };
  return {
    r: parseInt(c.substring(0, 2), 16) || 0,
    g: parseInt(c.substring(2, 4), 16) || 0,
    b: parseInt(c.substring(4, 6), 16) || 0
  };
}

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
  customColor: string;
  setCustomColor: (color: string) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  accent: "blue",
  setAccent: () => null,
  customColor: "#2563eb",
  setCustomColor: () => null,
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
  const [customColor, setCustomColor] = useState<string>(
    () => localStorage.getItem("prescripto-custom-color") || "#2563eb"
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

    let activeColor = "#2563eb";
    let activeHsl = "217.2 91.2% 59.8%";
    let activeGlow = "rgba(37,99,235,0.35)";

    if (accent === "custom" && customColor) {
      const computed = hexToHsl(customColor);
      activeColor = computed.color;
      activeHsl = computed.hsl;
      activeGlow = computed.glow;
    } else {
      const activeOption = ACCENT_OPTIONS.find((a) => a.id === accent) || ACCENT_OPTIONS[0];
      activeColor = activeOption.color;
      activeHsl = activeOption.hsl;
      activeGlow = activeOption.glow;
    }

    root.style.setProperty("--primary", activeHsl);
    root.style.setProperty("--ring", activeHsl);
    root.style.setProperty("--primary-hex", activeColor);
    root.style.setProperty("--accent-glow", activeGlow);
    document.body?.style.setProperty("--primary-hex", activeColor);
    document.body?.style.setProperty("--accent-glow", activeGlow);
  }, [accent, customColor, theme]);

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
    customColor,
    setCustomColor: (color: string) => {
      localStorage.setItem("prescripto-custom-color", color);
      setCustomColor(color);
      localStorage.setItem(accentStorageKey, "custom");
      setAccent("custom");
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
