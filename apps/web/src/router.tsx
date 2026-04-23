import { createRouter } from '@tanstack/react-router';
import { queryClient } from './lib/query';
import { Route as rootRoute } from './routes/__root';
import { Route as indexRoute } from './routes/index';
import { Route as projectDetailRoute } from './routes/projects/$id';
import { Route as projectRunNewRoute } from './routes/projects/$id/runs.new';
import { Route as projectsIndexRoute } from './routes/projects/index';
import { Route as runDetailRoute } from './routes/runs/$id';
import { Route as runsIndexRoute } from './routes/runs/index';

const routeTree = rootRoute.addChildren([
  indexRoute,
  projectsIndexRoute,
  projectDetailRoute,
  projectRunNewRoute,
  runsIndexRoute,
  runDetailRoute,
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
