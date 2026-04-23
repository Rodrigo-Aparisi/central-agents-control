import { Layout } from '@/components/layout/layout';
import type { QueryClient } from '@tanstack/react-query';
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { Toaster } from 'sonner';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
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
  return (
    <>
      <Layout>
        <Outlet />
      </Layout>
      <Toaster position="bottom-right" theme="system" closeButton richColors />
    </>
  );
}
