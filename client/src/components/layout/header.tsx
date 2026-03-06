import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Settings, Lightbulb, FolderOpen, Sparkles, CalendarDays, BarChart3, TrendingUp, Menu, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { t } from "@/i18n";
import { useFikriOverlay } from "@/contexts/fikri-overlay-context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/", icon: FolderOpen, label: t("nav.folders"), testId: "link-dashboard" },
  { href: "/ideas", icon: Lightbulb, label: t("nav.ideas"), testId: "link-ideas" },
  { href: "/calendar", icon: CalendarDays, label: t("nav.calendar"), testId: "link-calendar" },
  { href: "/analytics", icon: BarChart3, label: t("nav.analytics"), testId: "link-analytics" },
  { href: "/trends", icon: TrendingUp, label: t("nav.trends"), testId: "link-trends" },
  { href: "/model", icon: Bot, label: t("nav.fikri"), testId: "link-model" },
];

export function Header() {
  const [location] = useLocation();
  const { setOpen } = useFikriOverlay();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);

    // Defensive cleanup for mobile Sheet/Dialog side-effects that can linger
    // on some route transitions in mobile browsers.
    document.body.style.removeProperty("pointer-events");
    document.body.style.removeProperty("overflow");
    document.body.removeAttribute("data-scroll-locked");
    document.body.removeAttribute("data-aria-hidden");
  }, [location]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:px-4 md:px-8">
        <Link href="/" className="flex items-center group">
          <span className="text-2xl font-black sm:text-3xl tracking-tighter bg-gradient-to-l from-primary to-primary/60 bg-clip-text text-transparent px-1" data-testid="text-logo">نَسَق</span>
        </Link>

        <nav className="hidden flex-wrap items-center gap-1 md:flex">
          {navItems.map((item) => {
            if (item.href === "/model") {
              if (location === "/settings") return null;
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  size="default"
                  className="gap-2"
                  data-testid={item.testId}
                  onClick={() => setOpen(true)}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={location === item.href ? "secondary" : "ghost"}
                  size="default"
                  className="gap-2"
                  data-testid={item.testId}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              </Link>
            );
          })}

          <Link href="/settings">
            <Button variant={location === "/settings" ? "secondary" : "ghost"} size="icon" data-testid="link-settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle className="text-right">القائمة</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-2">
                {navItems.map((item) => {
                  if (item.href === "/model") {
                    if (location === "/settings") return null;
                    return (
                      <Button
                        key={item.href}
                        variant="ghost"
                        className="w-full justify-start gap-3"
                        onClick={() => {
                          setOpen(true);
                          setMobileMenuOpen(false);
                        }}
                        data-testid={`mobile-${item.testId}`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="text-base">{item.label}</span>
                      </Button>
                    );
                  }

                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={location === item.href ? "secondary" : "ghost"}
                        className="w-full justify-start gap-3"
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid={`mobile-${item.testId}`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="text-base">{item.label}</span>
                      </Button>
                    </Link>
                  );
                })}
                <Link href="/settings">
                  <Button
                    variant={location === "/settings" ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-settings"
                  >
                    <Settings className="h-5 w-5" />
                    <span className="text-base">{t("nav.settings")}</span>
                  </Button>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
