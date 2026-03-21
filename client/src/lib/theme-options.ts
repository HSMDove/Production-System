import type { AppTheme } from "@/components/theme-provider";

export type ThemeOption = {
  value: AppTheme;
  label: string;
  color: string;
  description: string;
};

export const themeOptions: ThemeOption[] = [
  {
    value: "default",
    label: "وهج",
    color: "#f7cb46",
    description: "ذهبي صريح بإحساس جريء ودافئ",
  },
  {
    value: "tech-field",
    label: "نبض",
    color: "#fe90e8",
    description: "وردي كهربائي بطاقة لافتة وصادمة",
  },
  {
    value: "tech-voice",
    label: "أثير",
    color: "#35d9ff",
    description: "سماوي رقمي بحدة حديثة وواضحة",
  },
];

export function getThemeOption(theme: AppTheme): ThemeOption {
  return themeOptions.find((item) => item.value === theme) ?? themeOptions[0];
}
