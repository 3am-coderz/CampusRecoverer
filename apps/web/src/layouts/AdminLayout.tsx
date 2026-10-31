import React from 'react';
import { Outlet, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../kernel/auth-context';
import { Sidebar } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';
import { ShieldCheck, AlertOctagon } from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, isAuthenticated, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Verifying security clearances...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRole('SECURITY', 'ADMIN')) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 bg-red-100 text-red-700 rounded-full mb-4">
            <AlertOctagon className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Restricted Security Portal</h2>
          <p className="mt-2 text-sm text-slate-600 max-w-md">
            Your account ({user?.email}) does not possess the requisite security or admin credentials.
          </p>
          <Link
            to="/"
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold hover:bg-blue-700 transition"
          >
            Return to Student Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 p-6 md:p-8 max-w-[1400px] overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
