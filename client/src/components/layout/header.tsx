import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Settings, Lightbulb, FolderOpen, CalendarDays, BarChart3, TrendingUp, Menu, Bot, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { t } from "@/i18n";
import { useFikriOverlay } from "@/contexts/fikri-overlay-context";
import { useAuth } from "@/hooks/use-auth";
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
  const { isAdmin } = useAuth();
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
    <header className="sticky top-0 z-50 w-full px-3 pb-2 pt-3 sm:px-4 md:px-8" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
      <div className="container !px-0">
        <div className="nb-header-shell">
          <div className="nb-header-stripes" aria-hidden="true" />
          <div className="relative flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-5">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <Link href="/" className="group flex min-w-0 items-center gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-3xl font-black leading-none tracking-[-0.08em] sm:text-4xl" data-testid="text-logo">
                    نَسَق
                  </span>
                  <p className="mt-2 text-xs font-extrabold text-foreground/70 sm:text-sm">
                    أخبار. تحليل. فكرة. إنتاج.
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2 lg:hidden">
                <ThemeToggle />
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" data-testid="button-mobile-menu">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[310px] sm:w-[340px]">
                    <SheetHeader>
                      <SheetTitle className="text-right text-2xl font-black">التنقل</SheetTitle>
                    </SheetHeader>
                    <div className="mt-5 rounded-[22px] border-[3px] border-border bg-card p-3 shadow-[6px_6px_0_0_rgba(0,0,0,0.88)]">
                      <nav className="flex flex-col gap-2">
                        {navItems.map((item) => {
                          if (item.href === "/model") {
                            if (location === "/settings") return null;
                            return (
                              <Button
                                key={item.href}
                                variant="outline"
                                className="w-full justify-start gap-3 fikri-nav-btn"
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
                                variant={location === item.href ? "default" : "outline"}
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
                            variant={location === "/settings" ? "default" : "outline"}
                            className="w-full justify-start gap-3"
                            onClick={() => setMobileMenuOpen(false)}
                            data-testid="mobile-link-settings"
                          >
                            <Settings className="h-5 w-5" />
                            <span className="text-base">{t("nav.settings")}</span>
                          </Button>
                        </Link>
                        {isAdmin && (
                          <Link href="/admin/login">
                            <Button
                              variant="outline"
                              className="w-full justify-start gap-3"
                              onClick={() => setMobileMenuOpen(false)}
                              data-testid="mobile-link-admin"
                            >
                              <Shield className="h-5 w-5" />
                              <span className="text-base">لوحة التحكم</span>
                            </Button>
                          </Link>
                        )}
                      </nav>
                    </div>
                  </SheetContent>
                </Sheet>
                </div>
            </div>

            <nav className="hidden flex-wrap items-center gap-2.5 lg:flex">
          {navItems.map((item) => {
            if (item.href === "/model") {
              if (location === "/settings") return null;
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  size="sm"
                  className="gap-2 fikri-nav-btn"
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
                  variant={location === item.href ? "default" : "outline"}
                  size="sm"
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
            <Button variant={location === "/settings" ? "default" : "outline"} size="icon" data-testid="link-settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          {isAdmin && (
            <Link href="/admin/login">
              <Button variant="outline" size="icon" data-testid="link-admin" title="لوحة التحكم">
                <Shield className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <ThemeToggle />
        </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
