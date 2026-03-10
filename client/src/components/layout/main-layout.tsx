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
    <div className="min-h-screen bg-background overflow-hidden">
      <Header />
      <main className="h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] overflow-y-auto w-full max-w-[1800px] mx-auto px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 xl:px-12 2xl:px-16">
        {children}
      </main>

      {showFikriLauncher && (
        <Button
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[80] rounded-full px-5 py-6 shadow-2xl backdrop-blur-md"
          data-testid="button-fikri-fab"
          onClick={() => setOpen(true)}
        >
          <Bot className="h-4 w-4 ml-2" />
          {t("fikri.name")}
        </Button>
      )}
    </div>
  );
}
