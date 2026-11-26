import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./ui/pages/pr-list/pr-list.page').then((m) => m.PrListPage) },
  {
    path: 'repos/:owner/:repo/pull/:number',
    loadComponent: () => import('./ui/pages/pr-detail/pr-detail.page').then((m) => m.PrDetailPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () => import('./ui/pages/pr-detail/tabs/overview/pr-overview.tab').then((m) => m.PrOverviewTab),
      },
      {
        path: 'files',
        loadComponent: () => import('./ui/pages/pr-detail/tabs/files/pr-files.tab').then((m) => m.PrFilesTab),
      },
      {
        path: 'pipeline',
        loadComponent: () => import('./ui/pages/pr-detail/tabs/pipeline/pr-pipeline.tab').then((m) => m.PrPipelineTab),
      },
      ...(['story', 'commits'] as const).map((path) => ({
        path,
        loadComponent: () => import('./ui/pages/pr-detail/tabs/coming-soon/coming-soon.tab').then((m) => m.ComingSoonTab),
        data: { tab: path },
      })),
    ],
  },
  { path: '**', redirectTo: '' },
];
