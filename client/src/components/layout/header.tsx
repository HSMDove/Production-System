import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Settings, Lightbulb, FolderOpen, Sparkles, CalendarDays, BarChart3, TrendingUp, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/", icon: FolderOpen, label: "المجلدات", testId: "link-dashboard" },
  { href: "/ideas", icon: Lightbulb, label: "الأفكار", testId: "link-ideas" },
  { href: "/calendar", icon: CalendarDays, label: "التقويم", testId: "link-calendar" },
  { href: "/analytics", icon: BarChart3, label: "التحليلات", testId: "link-analytics" },
  { href: "/trends", icon: TrendingUp, label: "الاتجاهات", testId: "link-trends" },
];

export function Header() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 sm:h-16 items-center justify-between gap-2 px-3 sm:px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <span className="text-lg sm:text-xl font-bold" data-testid="text-logo">نظام حسام للإنتاج</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 flex-wrap">
          {navItems.map((item) => (
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
          ))}
          <Link href="/settings">
            <Button
              variant={location === "/settings" ? "secondary" : "ghost"}
              size="icon"
              data-testid="link-settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <ThemeToggle />
        </nav>

        {/* Mobile Navigation */}
        <div className="flex md:hidden items-center gap-1">
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
              <nav className="flex flex-col gap-2 mt-6">
                {navItems.map((item) => (
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
                ))}
                <Link href="/settings">
                  <Button
                    variant={location === "/settings" ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-settings"
                  >
                    <Settings className="h-5 w-5" />
                    <span className="text-base">الإعدادات</span>
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
