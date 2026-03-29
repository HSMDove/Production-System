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
          className="fixed z-[30] flex flex-col items-center gap-2.5 transition-transform duration-200 hover:scale-110 active:scale-95"
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))", left: "1.25rem" }}
          data-testid="button-fikri-fab"
          onClick={() => setOpen(true)}
          aria-label="فتح فكري"
        >
          {/* Image with spinning iridescent ring */}
          <div className="relative">
            <div className="fikri-fab-halo" />
            <div className="fikri-fab-ring" />
            <img
              src={fikriImage}
              alt="فكري"
              className="relative z-10 h-14 w-14 sm:h-16 sm:w-16 rounded-[22px] object-cover fikri-fab-img"
              draggable={false}
            />
          </div>
          {/* Shimmer label badge */}
          <span className="fikri-fab-label rounded-full px-3 py-1 text-[10px] sm:text-xs relative z-10">
            فكري 2
          </span>
        </button>
      )}
    </div>
  );
}
