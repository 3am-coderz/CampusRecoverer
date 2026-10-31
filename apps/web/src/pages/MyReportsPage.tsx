import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { itemsService } from '../services/itemsService';
import { ItemPublic } from '../kernel/types';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../utils/date';
import { formatCategory } from '../utils/formatters';
import { Package, PlusCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../kernel/auth-context';

export const MyReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ItemPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      // In core module, GET /items returns items. We can filter or get user's items
      const allItems = await itemsService.getItems();
      // Filter if items have finder_id matching user, or all items in demo
      const userItems = allItems.filter((i: any) => !i.finder_id || i.finder_id === user?.id);
      setItems(userItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load reported items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchReports();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Items I Found & Reported</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track status of items you found on campus and brought to the security desk.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/report-found"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Report Another
          </Link>
          <button
            onClick={fetchReports}
            disabled={loading}
            className="p-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border p-5 animate-pulse h-24"></div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">No Found Items Registered Yet</h3>
          <p className="text-xs text-slate-500">
            Did you find someone&apos;s lost possession? Register it here.
          </p>
          <Link
            to="/report-found"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
          >
            Report Found Item
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {formatCategory(item.category)}
                  </span>
                  <StatusBadge status={item.status} />
                  <StatusBadge risk={item.risk_level} />
                  {item.security_verified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Custody Verified
                    </span>
                  )}
                </div>

                <p className="text-sm font-medium text-slate-900">{item.public_description}</p>

                <p className="text-xs text-slate-500">
                  Found at <span className="font-semibold text-slate-700">{item.found_location_public}</span> on {formatDate(item.found_date)}
                </p>
              </div>

              <div className="self-end md:self-center">
                <Link
                  to={`/items/${item.id}`}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  View Record &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
