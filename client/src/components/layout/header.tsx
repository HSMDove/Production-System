import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Settings, Lightbulb, FolderOpen, CalendarDays, BarChart3, TrendingUp, Menu, Bot, Shield, Sparkles, Wand2 } from "lucide-react";
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
    <header className="sticky top-0 z-50 w-full border-b-4 border-foreground bg-background/95 backdrop-blur-sm" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="container py-3">
        <div className="flex items-center justify-between gap-3 rounded-[1.75rem] border-4 border-foreground bg-card px-3 py-3 shadow-brutal sm:px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="group flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] border-4 border-foreground bg-primary text-lg font-black text-primary-foreground shadow-brutal-sm">ن</span>
              <div>
                <span className="block text-2xl font-black tracking-tight sm:text-3xl" data-testid="text-logo">نَسَق</span>
                <span className="hidden text-xs font-black text-muted-foreground sm:block">CONTENT OPS · NEO BRUTAL</span>
              </div>
            </Link>
            <div className="hidden rounded-full border-4 border-foreground bg-secondary px-3 py-1 text-xs font-black shadow-brutal-sm lg:inline-flex lg:items-center lg:gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              واجهة أكثر جرأة
            </div>
          </div>

          <nav className="hidden flex-wrap items-center gap-2 md:flex">
          {navItems.map((item) => {
            if (item.href === "/model") {
              if (location === "/settings") return null;
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  size="default"
                  className="gap-2 rounded-2xl px-4 py-2.5 text-sm font-black"
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
                  className="gap-2 rounded-2xl px-4 py-2.5 text-sm font-black"
                  data-testid={item.testId}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              </Link>
            );
          })}

          <Link href="/settings">
            <Button variant={location === "/settings" ? "secondary" : "ghost"} size="icon" className="rounded-2xl" data-testid="link-settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          {isAdmin && (
            <Link href="/admin/login">
              <Button variant="ghost" size="icon" data-testid="link-admin" title="لوحة التحكم">
                <Shield className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <div className="hidden items-center gap-2 lg:flex">
            {location !== "/settings" && (
              <Button variant="default" className="rounded-2xl bg-nb-green text-foreground" onClick={() => setOpen(true)}>
                <Wand2 className="h-4 w-4" /> افتح فكري
              </Button>
            )}
            <ThemeToggle />
          </div>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <div className="hidden sm:block"><ThemeToggle /></div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-2xl" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] border-l-4 border-foreground bg-card sm:w-[340px]">
              <SheetHeader>
                <SheetTitle className="text-right text-2xl font-black">القائمة الجريئة</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-2">
                {navItems.map((item) => {
                  if (item.href === "/model") {
                    if (location === "/settings") return null;
                    return (
                      <Button
                        key={item.href}
                        variant="ghost"
                        className="w-full justify-start gap-3 rounded-2xl px-4 py-3 text-base font-black"
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
                        className="w-full justify-start gap-3 rounded-2xl px-4 py-3 text-base font-black"
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
                    className="w-full justify-start gap-3 rounded-2xl px-4 py-3 text-base font-black"
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
                      variant="ghost"
                      className="w-full justify-start gap-3 rounded-2xl px-4 py-3 text-base font-black"
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid="mobile-link-admin"
                    >
                      <Shield className="h-5 w-5" />
                      <span className="text-base">لوحة التحكم</span>
                    </Button>
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
        </div>
      </div>
    </header>
  );
}
