import { Layout } from '@/components/layout/layout';
import { guardAuth } from '@/hooks/useAuthGuard';
import type { QueryClient } from '@tanstack/react-query';
import { Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router';
import { Toaster } from 'sonner';

export interface RouterContext {
  queryClient: QueryClient;
}

const NO_LAYOUT_PATHS = ['/login'];

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }) => {
    // Public paths skip auth check
    if (NO_LAYOUT_PATHS.includes(location.pathname)) return;
    await guardAuth(location.pathname);
  },
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2">
      <p className="text-lg font-medium">Ruta no encontrada</p>
      <a href="/projects" className="text-sm text-primary underline-offset-4 hover:underline">
        Volver al listado
      </a>
    </div>
  ),
});

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = NO_LAYOUT_PATHS.includes(pathname);

  if (isPublic) {
    return (
      <>
        <Outlet />
        <Toaster position="bottom-right" theme="system" closeButton richColors />
      </>
    );
  }

  return (
    <>
      <Layout>
        <Outlet />
      </Layout>
      <Toaster position="bottom-right" theme="system" closeButton richColors />
    </>
  );
}
