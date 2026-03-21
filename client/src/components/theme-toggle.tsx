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

const themeItems: Array<{ value: AppTheme; label: string; color: string }> = [
  { value: "default", label: "ذهبي صاخب", color: "#F7CB46" },
  { value: "tech-field", label: "لكمة وردية", color: "#FE90E8" },
  { value: "tech-voice", label: "سماوي رقمي", color: "#C0F7FE" },
];

export function ThemeToggle() {
  const { theme, colorMode, setTheme, setColorMode } = useTheme();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setColorMode(colorMode === "dark" ? "light" : "dark")}
        data-testid="button-color-mode-toggle"
        title={colorMode === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
      >
        {colorMode === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" data-testid="button-theme-toggle" title="تغيير السمة">
            <Palette className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>السمات</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {themeItems.map((item) => (
            <DropdownMenuItem
              key={item.value}
              onClick={() => setTheme(item.value)}
              data-testid={`menu-item-${item.value}`}
              className="gap-2"
            >
              <span
                className="inline-block h-4 w-4 rounded-full border-2 border-foreground/30"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
              {theme === item.value && <span className="mr-auto text-xs">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
