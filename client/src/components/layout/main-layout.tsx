import { Header } from "./header";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="nb-app-shell flex min-h-screen flex-col">
      <div className="nb-orb nb-orb-primary" aria-hidden="true" />
      <div className="nb-orb nb-orb-secondary" aria-hidden="true" />
      <Header />
      <main className="relative z-[1] flex-1 overflow-visible bg-transparent">
        <div className="page-frame bg-transparent py-4 sm:py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
