import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, PlusCircle, FileText, ShieldCheck, CheckCircle2, Lock, ArrowRight, Shield } from 'lucide-react';
import { useAuth } from '../kernel/auth-context';
import { itemsService } from '../services/itemsService';
import { ItemPublic } from '../kernel/types';
import { ItemCard } from '../components/ItemCard';

export const DashboardPage: React.FC = () => {
  const { user, isAuthenticated, hasRole } = useAuth();
  const [recentItems, setRecentItems] = useState<ItemPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const items = await itemsService.getItems({ limit: 4 });
        setRecentItems(items);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 opacity-10 pointer-events-none">
          <Shield className="w-96 h-96" />
        </div>

        <div className="max-w-2xl relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Zero-Knowledge Privacy Guaranteed</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Campus Recoverer
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Recover lost possessions securely without public surveillance. Identifying details,
            contents, and serial numbers remain strictly encrypted and are never exposed publicly.
          </p>

          <div className="pt-4 flex flex-wrap gap-3">
            <Link
              to="/items"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-md transition"
            >
              <Search className="w-4 h-4" />
              Browse Open Items
            </Link>

            <Link
              to="/report-found"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-sm font-semibold backdrop-blur-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              Report Found Item
            </Link>

            {hasRole('SECURITY', 'ADMIN') && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold shadow-md transition"
              >
                <ShieldCheck className="w-4 h-4" />
                Security Station
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Fast Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            1
          </div>
          <h3 className="font-semibold text-slate-900 text-base">Lost Something?</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Search our privacy-preserving directory of campus items or submit a lost item report to get notified of matches.
          </p>
          <Link
            to="/report-lost"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            File Lost Item Report <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            2
          </div>
          <h3 className="font-semibold text-slate-900 text-base">Found an Item?</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Publish public broad details, while keeping private serials and unique traits safely hidden for claim verification.
          </p>
          <Link
            to="/report-found"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Report Found Asset <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            3
          </div>
          <h3 className="font-semibold text-slate-900 text-base">Handover Desk</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Approved claimants receive a tamper-proof HMAC-SHA256 QR code & single-use 6-digit OTP for contactless desk release.
          </p>
          <Link
            to={isAuthenticated ? '/my-claims' : '/login'}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700"
          >
            View Active Claims <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Recently Found Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Recently Found On Campus</h2>
            <p className="text-xs text-slate-500">Only public, non-identifying features are displayed</p>
          </div>
          <Link
            to="/items"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View all items <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border p-5 space-y-3 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-6 bg-slate-200 rounded"></div>
                <div className="h-4 bg-slate-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : recentItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            No items currently recorded.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
