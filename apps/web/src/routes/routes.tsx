import React from 'react';
import { RouteObject } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { PublicListingPage } from '../pages/PublicListingPage';
import { ItemDetailsPage } from '../pages/ItemDetailsPage';
import { ReportFoundPage } from '../pages/ReportFoundPage';
import { ReportLostPage } from '../pages/ReportLostPage';
import { ClaimSubmissionPage } from '../pages/ClaimSubmissionPage';
import { MyClaimsPage } from '../pages/MyClaimsPage';
import { MyReportsPage } from '../pages/MyReportsPage';
import { ApprovedCollectionPage } from '../pages/ApprovedCollectionPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';

export const userRoutes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'items',
        element: <PublicListingPage />,
      },
      {
        path: 'items/:id',
        element: <ItemDetailsPage />,
      },
      {
        path: 'report-found',
        element: <ReportFoundPage />,
      },
      {
        path: 'report-lost',
        element: <ReportLostPage />,
      },
      {
        path: 'claim/:itemId',
        element: <ClaimSubmissionPage />,
      },
      {
        path: 'my-claims',
        element: <MyClaimsPage />,
      },
      {
        path: 'my-reports',
        element: <MyReportsPage />,
      },
      {
        path: 'collection/:claimId',
        element: <ApprovedCollectionPage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
    ],
  },
];
