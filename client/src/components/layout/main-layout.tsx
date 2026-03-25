import { useLocation } from "wouter";
import { Header } from "./header";
import { useFikriOverlay } from "@/contexts/fikri-overlay-context";
import fikriImage from "@assets/Image_1_(1)_1773361719505.png";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [location] = useLocation();
  const { setOpen } = useFikriOverlay();
  const showFikriLauncher = location !== "/settings";

  return (
    <div className="nb-app-shell flex min-h-screen flex-col">
      <div className="nb-orb nb-orb-primary" aria-hidden="true" />
      <div className="nb-orb nb-orb-secondary" aria-hidden="true" />
      <Header />
      <main className="relative z-[1] flex-1 overflow-visible bg-transparent">
        <div className={`page-frame bg-transparent py-4 sm:py-6 md:py-8 ${showFikriLauncher ? "pb-28 sm:pb-32" : ""}`}>
          {children}
        </div>
      </main>

      {showFikriLauncher && (
        <button
          className="fixed z-[30] flex flex-col items-center gap-2 transition-transform duration-150 hover:scale-105 active:scale-95"
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))", left: "1.25rem" }}
          data-testid="button-fikri-fab"
          onClick={() => setOpen(true)}
        >
          <img
            src={fikriImage}
            alt="فكري"
            className="h-14 w-14 rounded-[22px] border-[3px] border-border object-cover shadow-[6px_6px_0_0_rgba(0,0,0,0.88)] sm:h-16 sm:w-16"
            draggable={false}
          />
          <span className="rounded-full border-[3px] border-border bg-primary px-3 py-1 text-[10px] font-black text-primary-foreground shadow-[4px_4px_0_0_rgba(0,0,0,0.88)] sm:text-xs">
            فكري 2
          </span>
        </button>
      )}
    </div>
  );
}
