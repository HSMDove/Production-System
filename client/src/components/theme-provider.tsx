import { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "default" | "tech-field" | "tech-voice";
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
  theme: "default",
  colorMode: "dark",
  setTheme: () => null,
  setColorMode: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "default",
  defaultColorMode = "dark",
  storageKey = "nasaq-accent",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<AppTheme>(
    () => {
      const stored =
        localStorage.getItem(storageKey) ||
        localStorage.getItem("nasaq-accent") ||
        localStorage.getItem("tech-voice-theme") ||
        "";
      const validThemes: AppTheme[] = ["default", "tech-field", "tech-voice"];
      if (stored === "default-dark") return "default";
      return validThemes.includes(stored as AppTheme) ? (stored as AppTheme) : defaultTheme;
    },
  );
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
      localStorage.setItem(storageKey, nextTheme);
      setTheme(nextTheme);
    },
    setColorMode: (mode: ColorMode) => {
      localStorage.setItem("nasaq-color-mode", mode);
      setColorMode(mode);
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
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
