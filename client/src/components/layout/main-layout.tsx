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
      <main className="h-[calc(100svh-4.5rem)] overflow-y-auto w-full max-w-[1880px] mx-auto px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 xl:px-12 2xl:px-16">
        {children}
      </main>

      {showFikriLauncher && (
        <button
          className="fixed z-[150] flex flex-col items-center gap-1 transition-transform duration-150 hover:-translate-y-1 active:translate-y-1"
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))", left: "1.25rem" }}
          data-testid="button-fikri-fab"
          onClick={() => setOpen(true)}
        >
          <img
            src={fikriImage}
            alt="فكري"
            className="h-14 w-14 rounded-[1.4rem] border-4 border-foreground object-cover shadow-brutal sm:h-16 sm:w-16"
            draggable={false}
          />
          <span className="rounded-full border-4 border-foreground bg-card px-2 py-0.5 text-[10px] font-black text-foreground shadow-brutal-sm sm:text-xs">فكري 2</span>
        </button>
      )}
    </div>
  );
}
