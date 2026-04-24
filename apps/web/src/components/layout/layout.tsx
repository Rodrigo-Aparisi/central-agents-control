import { TooltipProvider } from '@/components/ui/tooltip';
import { useRunNotifications } from '@/hooks/useRunNotifications';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { humanizeError } from '@/lib/errors';
import { useAuthStore } from '@/stores/auth';
import { Link, useNavigate } from '@tanstack/react-router';
import { BarChart3, ClipboardList, FolderKanban, LogOut, Play, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ActiveRunsBadge } from './active-runs-badge';
import { HealthBadge } from './health-badge';
import { ThemeToggle } from './theme-toggle';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  useRunNotifications();
  useTokenRefresh();

  const isAdmin = useAuthStore((s) => s.isAdmin());
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.auth.logout();
    } catch (err) {
      toast.error(humanizeError(err));
    } finally {
      useAuthStore.getState().clearAuth();
      await navigate({ to: '/login' });
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-card/60 md:flex md:flex-col">
          <div className="flex h-14 items-center gap-2 border-b border-border px-4">
            <div className="size-6 rounded-md bg-primary/20 ring-1 ring-primary/40" />
            <span className="font-semibold tracking-tight">CAC</span>
          </div>
          <nav
            className="flex flex-1 flex-col gap-0.5 p-2 text-sm"
            aria-label="Navegación principal"
          >
            <NavItem to="/projects" icon={<FolderKanban className="size-4" />} label="Proyectos" />
            <NavItem to="/runs" icon={<Play className="size-4" />} label="Runs recientes" />
            <NavItem to="/dashboard" icon={<BarChart3 className="size-4" />} label="Dashboard" />

            {isAdmin && (
              <>
                <div className="mx-3 my-1.5 border-t border-border" />
                <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Administración
                </p>
                <NavItem to="/admin/users" icon={<Users className="size-4" />} label="Usuarios" />
                <NavItem
                  to="/admin/audit"
                  icon={<ClipboardList className="size-4" />}
                  label="Auditoría"
                />
              </>
            )}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <HealthBadge />
              <ActiveRunsBadge />
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                )}
              >
                <LogOut className="size-4" />
              </button>
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
