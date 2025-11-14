import { createRouteRef, createSubRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'pr-metrics',
});

export const repositoryPullRequestsRouteRef = createSubRouteRef({
  id: 'pr-metrics/repository-prs',
  parent: rootRouteRef,
  path: '/repository/:owner/:repo',
});
