import { createDevApp } from '@backstage/dev-utils';
import { prMetricsPlugin, PrMetricsPage } from '../src/plugin';

createDevApp()
  .registerPlugin(prMetricsPlugin)
  .addPage({
    element: <PrMetricsPage />,
    title: 'Root Page',
    path: '/pr-metrics',
  })
  .render();
