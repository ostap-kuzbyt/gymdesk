import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { nextPreference } from "@/lib/theme";

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

export function ThemeToggle() {
  const { preference, cycle } = useTheme();
  const Icon = ICONS[preference];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      aria-label={`Theme: ${preference}. Switch to ${nextPreference(preference)}`}
      title={`Theme: ${preference}`}
    >
      <Icon />
    </Button>
  );
}
