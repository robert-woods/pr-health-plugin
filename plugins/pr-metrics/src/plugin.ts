import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef, repositoryPullRequestsRouteRef } from './routes';

export const prMetricsPlugin = createPlugin({
  id: 'pr-metrics',
  routes: {
    root: rootRouteRef,
    repositoryPullRequests: repositoryPullRequestsRouteRef,
  },
});

export const PrMetricsPage = prMetricsPlugin.provide(
  createRoutableExtension({
    name: 'PrMetricsPage',
    component: () =>
      import('./components/PrMetricsPage').then(m => m.PrMetricsPage),
    mountPoint: rootRouteRef,
  }),
);
