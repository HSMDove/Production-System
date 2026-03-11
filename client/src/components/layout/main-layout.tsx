import { useLocation } from "wouter";
import { Bot } from "lucide-react";
import { Header } from "./header";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { useFikriOverlay } from "@/contexts/fikri-overlay-context";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [location] = useLocation();
  const { setOpen } = useFikriOverlay();
  const showFikriLauncher = location !== "/settings";

  return (
    <div className="min-h-screen overflow-hidden">
      <Header />
      <main className="h-[calc(100svh-3.5rem)] sm:h-[calc(100svh-4rem)] overflow-y-auto w-full max-w-[1800px] mx-auto px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 xl:px-12 2xl:px-16">
        {children}
      </main>

      {showFikriLauncher && (
        <button
          className="fixed z-[150] flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm font-bold border-[3px] border-foreground/80 shadow-[0_4px_0_0_hsl(var(--foreground)/0.7)] active:translate-y-[3px] active:shadow-[0_1px_0_0_hsl(var(--foreground)/0.7)] transition-all duration-100"
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))", left: "1.25rem" }}
          data-testid="button-fikri-fab"
          onClick={() => setOpen(true)}
        >
          <Bot className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{t("fikri.name")}</span>
        </button>
      )}
    </div>
  );
}
