import { Link, useLocation } from "wouter";
import { Settings, Lightbulb, FolderOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold" data-testid="text-logo">Tech Voice</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/">
            <Button
              variant={location === "/" ? "secondary" : "ghost"}
              size="default"
              className="gap-2"
              data-testid="link-dashboard"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">المجلدات</span>
            </Button>
          </Link>
          <Link href="/ideas">
            <Button
              variant={location === "/ideas" ? "secondary" : "ghost"}
              size="default"
              className="gap-2"
              data-testid="link-ideas"
            >
              <Lightbulb className="h-4 w-4" />
              <span className="hidden sm:inline">الأفكار</span>
            </Button>
          </Link>
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
      </div>
    </header>
  );
}
