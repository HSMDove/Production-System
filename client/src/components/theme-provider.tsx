import { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "hayawi" | "ibdai" | "classic";
export type ColorMode = "light" | "dark";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: AppTheme;
  defaultColorMode?: ColorMode;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: AppTheme;
  colorMode: ColorMode;
  setTheme: (theme: AppTheme) => void;
  setColorMode: (mode: ColorMode) => void;
};

const initialState: ThemeProviderState = {
  theme: "hayawi",
  colorMode: "dark",
  setTheme: () => null,
  setColorMode: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function normalizeStoredTheme(value: string | null, fallback: AppTheme): AppTheme {
  switch (value) {
    case "default-dark":
    case "default":
    case "tech-field":
      return "hayawi";
    case "tech-voice":
      return "ibdai";
    case "hayawi":
    case "ibdai":
    case "classic":
      return value;
    default:
      return fallback;
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "hayawi",
  defaultColorMode = "dark",
  storageKey: _storageKey,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<AppTheme>(() => {
    const stored = localStorage.getItem("nasaq-accent") || localStorage.getItem("tech-voice-theme");
    return normalizeStoredTheme(stored, defaultTheme);
  });
  const [colorMode, setColorMode] = useState<ColorMode>(
    () => (localStorage.getItem("nasaq-color-mode") as ColorMode) || defaultColorMode,
  );

  useEffect(() => {
    const root = window.document.documentElement;
    if (colorMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.setAttribute("data-app-theme", theme);
  }, [theme, colorMode]);

  const value = {
    theme,
    colorMode,
    setTheme: (nextTheme: AppTheme) => {
      localStorage.setItem("nasaq-accent", nextTheme);
      setTheme(nextTheme);
    },
    setColorMode: (mode: ColorMode) => {
      localStorage.setItem("nasaq-color-mode", mode);
      setColorMode(mode);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
