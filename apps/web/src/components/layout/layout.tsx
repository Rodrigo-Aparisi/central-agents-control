import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { Link } from '@tanstack/react-router';
import { FolderKanban, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { HealthBadge } from './health-badge';
import { ThemeToggle } from './theme-toggle';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-card/60 md:flex md:flex-col">
          <div className="flex h-14 items-center gap-2 border-b border-border px-4">
            <div className="size-6 rounded-md bg-primary/20 ring-1 ring-primary/40" />
            <span className="font-semibold tracking-tight">CAC</span>
          </div>
          <nav className="flex flex-col gap-0.5 p-2 text-sm">
            <NavItem to="/projects" icon={<FolderKanban className="size-4" />} label="Proyectos" />
            <NavItem to="/runs" icon={<Play className="size-4" />} label="Runs recientes" />
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <HealthBadge />
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
            </div>
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
      )}
      activeProps={{ className: 'bg-accent text-accent-foreground' }}
    >
      {icon}
      {label}
    </Link>
  );
}
