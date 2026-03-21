import { Check, Palette, Sun, Moon } from "lucide-react";
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          data-testid="button-theme-toggle"
          title="إعدادات المظهر"
          className="min-w-[3rem] gap-2 px-3"
        >
          {colorMode === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          <Palette className="h-4 w-4" />
          <span
            className="h-4 w-4 rounded-full border-[2px] border-border"
            style={{ backgroundColor: activeTheme.color }}
          />
          <span className="hidden sm:inline">{activeTheme.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px] p-2">
        <DropdownMenuLabel>الوضع</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => setColorMode("dark")}
          data-testid="menu-item-color-mode-dark"
          className="items-center gap-3 rounded-2xl px-3 py-3"
        >
          <Moon className="h-4 w-4" />
          <span className="flex-1 font-black">ليلي</span>
          {colorMode === "dark" && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setColorMode("light")}
          data-testid="menu-item-color-mode-light"
          className="items-center gap-3 rounded-2xl px-3 py-3"
        >
          <Sun className="h-4 w-4" />
          <span className="flex-1 font-black">نهاري</span>
          {colorMode === "light" && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>المظاهر</DropdownMenuLabel>
        {themeOptions.map((item) => (
          <DropdownMenuItem
            key={item.value}
            onClick={() => setTheme(item.value as AppTheme)}
            data-testid={`menu-item-${item.value}`}
            className="items-start gap-3 rounded-2xl px-3 py-3"
          >
            <span
              className="mt-1 inline-block h-4 w-4 rounded-full border-[2px] border-border"
              style={{ backgroundColor: item.color }}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-black">{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </span>
            {theme === item.value && <Check className="mr-auto mt-0.5 h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
