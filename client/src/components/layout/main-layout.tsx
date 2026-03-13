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
    <div className="min-h-screen overflow-hidden">
      <Header />
      <main className="h-[calc(100svh-3.5rem)] sm:h-[calc(100svh-4rem)] overflow-y-auto w-full max-w-[1800px] mx-auto px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 xl:px-12 2xl:px-16">
        {children}
      </main>

      {showFikriLauncher && (
        <button
          className="fixed z-[150] flex flex-col items-center gap-0.5 transition-transform duration-150 hover:scale-110 active:scale-95"
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))", left: "1.25rem" }}
          data-testid="button-fikri-fab"
          onClick={() => setOpen(true)}
        >
          <img
            src={fikriImage}
            alt="فكري"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover drop-shadow-lg"
            draggable={false}
          />
          <span className="text-[10px] sm:text-xs font-bold text-foreground drop-shadow-sm">فكري 2</span>
        </button>
      )}
    </div>
  );
}
