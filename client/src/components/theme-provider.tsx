import { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "default-dark" | "tech-field" | "tech-voice";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: AppTheme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
};

const initialState: ThemeProviderState = {
  theme: "default-dark",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "default-dark",
  storageKey = "tech-voice-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<AppTheme>(
    () => (localStorage.getItem(storageKey) as AppTheme) || defaultTheme,
  );

  useEffect(() => {
    const root = window.document.documentElement;
    // Dark-mode oriented UI only
    root.classList.add("dark");
    root.setAttribute("data-app-theme", theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (nextTheme: AppTheme) => {
      localStorage.setItem(storageKey, nextTheme);
      setTheme(nextTheme);
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
