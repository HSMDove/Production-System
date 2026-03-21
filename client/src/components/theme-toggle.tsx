import { Palette, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type AppTheme } from "@/components/theme-provider";
import { getThemeOption, themeOptions } from "@/lib/theme-options";

export function ThemeToggle() {
  const { theme, colorMode, setTheme, setColorMode } = useTheme();
  const activeTheme = getThemeOption(theme);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setColorMode(colorMode === "dark" ? "light" : "dark")}
        data-testid="button-color-mode-toggle"
        title={colorMode === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
        className="min-w-[3rem] px-3"
      >
        {colorMode === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        <span className="hidden sm:inline">{colorMode === "dark" ? "نهاري" : "ليلي"}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" data-testid="button-theme-toggle" title="تغيير السمة" className="gap-2 px-3">
            <Palette className="h-5 w-5" />
            <span
              className="h-4 w-4 rounded-full border-[2px] border-black/80"
              style={{ backgroundColor: activeTheme.color }}
            />
            <span className="hidden sm:inline">{activeTheme.label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px] p-2">
          <DropdownMenuLabel>المظاهر</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {themeOptions.map((item) => (
            <DropdownMenuItem
              key={item.value}
              onClick={() => setTheme(item.value as AppTheme)}
              data-testid={`menu-item-${item.value}`}
              className="items-start gap-3 rounded-2xl px-3 py-3"
            >
              <span
                className="mt-1 inline-block h-4 w-4 rounded-full border-[2px] border-black/80"
                style={{ backgroundColor: item.color }}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-black">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </span>
              {theme === item.value && <span className="mr-auto text-xs font-black">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
