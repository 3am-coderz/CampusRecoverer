import React from 'react';
import { RouteObject, createBrowserRouter, RouterProvider } from 'react-router-dom';
import { userRoutes } from '../routes/routes';
import { adminRoutes } from '../admin/routes';

export const allRoutes: RouteObject[] = [
  ...userRoutes,
  ...adminRoutes,
  {
    path: '*',
    element: (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <h1 className="text-4xl font-bold text-slate-800">404</h1>
        <p className="text-slate-600 mt-2">The requested page does not exist.</p>
        <a href="/" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
          Return to Home
        </a>
      </div>
    ),
  },
];

export const router = createBrowserRouter(allRoutes);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};
