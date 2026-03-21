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

const themeItems: Array<{ value: AppTheme; label: string; color: string; accent: string }> = [
  { value: "hayawi", label: "حيوي", color: "#D9FF6B", accent: "#FFD54F" },
  { value: "ibdai", label: "إبداعي", color: "#FFA8E8", accent: "#B7A2FF" },
  { value: "classic", label: "كلاسيكي", color: "#F4E4B8", accent: "#8FD5FF" },
];

export function ThemeToggle() {
  const { theme, colorMode, setTheme, setColorMode } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setColorMode(colorMode === "dark" ? "light" : "dark")}
        data-testid="button-color-mode-toggle"
        title={colorMode === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
        className="rounded-2xl"
      >
        {colorMode === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" data-testid="button-theme-toggle" title="تغيير السمة" className="rounded-2xl">
            <Palette className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuLabel>الثيمات الجديدة</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {themeItems.map((item) => (
            <DropdownMenuItem
              key={item.value}
              onClick={() => setTheme(item.value)}
              data-testid={`menu-item-${item.value}`}
              className="gap-3"
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-4 w-4 rounded-full border-[2.5px] border-black"
                  style={{ backgroundColor: item.color }}
                />
                <span
                  className="inline-block h-4 w-4 rounded-full border-[2.5px] border-black"
                  style={{ backgroundColor: item.accent }}
                />
              </span>
              <span className="font-extrabold">{item.label}</span>
              {theme === item.value && <span className="mr-auto text-xs font-black">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
