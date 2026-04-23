import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/ui';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const toggle = useUiStore((s) => s.toggleTheme);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
