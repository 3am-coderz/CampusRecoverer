import React from 'react';
import { RouteObject } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AdminItemsPage } from './AdminItemsPage';
import { AdminClaimsPage } from './AdminClaimsPage';
import { AdminHighRiskPage } from './AdminHighRiskPage';
import { AdminHandoverDeskPage } from './AdminHandoverDeskPage';
import { AdminAuditPage } from './AdminAuditPage';

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <AdminDashboardPage />,
      },
      {
        path: 'items',
        element: <AdminItemsPage />,
      },
      {
        path: 'claims',
        element: <AdminClaimsPage />,
      },
      {
        path: 'high-risk',
        element: <AdminHighRiskPage />,
      },
      {
        path: 'desk',
        element: <AdminHandoverDeskPage />,
      },
      {
        path: 'audit',
        element: <AdminAuditPage />,
      },
    ],
  },
];
