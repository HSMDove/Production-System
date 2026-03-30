import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Settings, Lightbulb, FolderOpen, CalendarDays, BarChart3, TrendingUp, Menu, Bot, Shield, Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { t } from "@/i18n";
import { useFikriOverlay } from "@/contexts/fikri-overlay-context";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface ReleaseNote {
  id: string;
  version: string;
  title: string;
  body: string;
  emoji: string | null;
  publishedAt: string | null;
}

const navItems = [
  { href: "/", icon: FolderOpen, label: t("nav.folders"), testId: "link-dashboard" },
  { href: "/ideas", icon: Lightbulb, label: t("nav.ideas"), testId: "link-ideas" },
  { href: "/calendar", icon: CalendarDays, label: t("nav.calendar"), testId: "link-calendar" },
  { href: "/analytics", icon: BarChart3, label: t("nav.analytics"), testId: "link-analytics" },
  { href: "/trends", icon: TrendingUp, label: t("nav.trends"), testId: "link-trends" },
  { href: "/model", icon: Bot, label: t("nav.fikri"), testId: "link-model" },
];

const SEEN_NOTES_KEY = "nasaq_seen_release_notes";

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_NOTES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markAllSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_NOTES_KEY, JSON.stringify(ids));
  } catch {}
}

function ReleaseNotesDropdown() {
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(getSeenIds);

  const { data: notes = [] } = useQuery<ReleaseNote[]>({
    queryKey: ["/api/release-notes"],
    queryFn: () => apiRequest("GET", "/api/release-notes").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const unseenCount = notes.filter((n) => !seenIds.has(n.id)).length;

  function handleOpen() {
    setOpen(true);
    if (notes.length > 0) {
      const allIds = notes.map((n) => n.id);
      markAllSeen(allIds);
      setSeenIds(new Set(allIds));
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        className="relative"
        onClick={handleOpen}
        data-testid="button-release-notes-bell"
        aria-label="ملاحظات الإصدار"
      >
        <Bell className="h-4 w-4" />
        {unseenCount > 0 && (
          <span className="notif-bell-badge" data-testid="badge-unseen-count">
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[40]"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown panel */}
          <div
            dir="rtl"
            className="absolute left-0 top-full mt-2 z-[50] w-[340px] sm:w-[380px] rounded-[20px] border border-white/20 liquid-glass shadow-2xl overflow-hidden"
            data-testid="release-notes-dropdown"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/15">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="font-black text-sm">ملاحظات الإصدار</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 hover:bg-white/10 transition-colors"
                data-testid="button-close-release-notes"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto divide-y divide-white/10">
              {notes.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-bold text-foreground/50">لا توجد تحديثات حالياً</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="px-4 py-3 hover:bg-white/8 transition-colors"
                    data-testid={`release-note-item-${note.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl leading-none mt-0.5 shrink-0">{note.emoji || "🚀"}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="font-black text-sm">{note.title}</span>
                          <span className="text-[10px] font-mono text-foreground/50 border border-border rounded px-1">v{note.version}</span>
                        </div>
                        <p className="text-xs text-foreground/65 leading-relaxed whitespace-pre-wrap line-clamp-3">{note.body}</p>
                        {note.publishedAt && (
                          <p className="text-[10px] text-foreground/40 mt-1">
                            {new Date(note.publishedAt).toLocaleDateString("ar-SA")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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
                <ReleaseNotesDropdown />
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
          <ReleaseNotesDropdown />
          <ThemeToggle />
        </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
