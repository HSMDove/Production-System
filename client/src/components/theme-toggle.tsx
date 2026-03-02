import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type AppTheme } from "@/components/theme-provider";

const themeItems: Array<{ value: AppTheme; label: string }> = [
  { value: "default-dark", label: "السمة الداكنة" },
  { value: "tech-field", label: "تيك فيلد" },
  { value: "tech-voice", label: "تيك فويس" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const activeLabel = themeItems.find((item) => item.value === theme)?.label ?? "السمة الداكنة";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-theme-toggle" title={activeLabel}>
          <Palette className="h-5 w-5" />
          <span className="sr-only">تغيير السمة</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {themeItems.map((item) => (
          <DropdownMenuItem key={item.value} onClick={() => setTheme(item.value)} data-testid={`menu-item-${item.value}`}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
