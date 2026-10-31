import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  Shield,
  CheckCircle2,
  Lock,
  ArrowLeft,
  FileCheck2,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { itemsService } from '../services/itemsService';
import { workflowService, CustodyEvent } from '../services/workflowService';
import { ItemDetail } from '../kernel/types';
import { StatusBadge } from '../components/StatusBadge';
import { formatCategory } from '../utils/formatters';
import { formatDate } from '../utils/date';
import { useAuth } from '../kernel/auth-context';

export const ItemDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, hasRole } = useAuth();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [custodyHistory, setCustodyHistory] = useState<CustodyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadItem() {
      if (!id) return;
      try {
        const data = await itemsService.getItem(id);
        setItem(data);
        if (hasRole('SECURITY', 'ADMIN')) {
          try {
            const custody = await workflowService.getCustodyHistory(id);
            setCustodyHistory(custody);
          } catch {
            // ignore custody load failure
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load item details');
      } finally {
        setLoading(false);
      }
    }
    loadItem();
  }, [id, user]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center text-sm text-slate-500">
        Loading item information...
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-3xl mx-auto p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
        <p className="text-sm font-semibold text-red-700">{error || 'Item not found'}</p>
        <Link
          to="/items"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Listings
        </Link>
      </div>
    );
  }

  const isFinder = user && item.finder_id && user.id === item.finder_id;
  const isPrivileged = isFinder || hasRole('SECURITY', 'ADMIN');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/items"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Listings
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Header Bar */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                {formatCategory(item.category)}
              </span>
              <StatusBadge status={item.status} />
              <StatusBadge risk={item.risk_level} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{item.public_description}</h1>
          </div>

          {/* Action button */}
          {item.status === 'OPEN_FOR_CLAIMS' && (
            <Link
              to={`/claim/${item.id}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition flex-shrink-0"
            >
              <FileCheck2 className="w-4 h-4" />
              Claim This Item
            </Link>
          )}
        </div>

        {/* Public Attributes */}
        <div className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Found Location
              </span>
              <p className="text-sm font-semibold text-slate-800">{item.found_location_public}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Date & Time Found
              </span>
              <p className="text-sm font-semibold text-slate-800">{formatDate(item.found_date)}</p>
            </div>
          </div>

          {item.security_verified && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="text-xs text-emerald-900">
                <p className="font-bold">Custody Verified by Campus Security</p>
                <p className="text-emerald-700 mt-0.5">
                  This item was physically handed over and registered at the security desk.
                </p>
              </div>
            </div>
          )}

          {/* Privacy Note for Public Users */}
          {!isPrivileged && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
              <Lock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Zero-Knowledge Verification Active</p>
                <p>
                  To prevent fraudulent claims, distinctive markings, contents, and serial numbers are
                  stored securely in encrypted storage. You will be asked to verify these during the claim process.
                </p>
              </div>
            </div>
          )}

          {/* Privileged / Security / Finder Hidden Attributes View */}
          {isPrivileged && (
            <div className="p-5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wide">
                <Eye className="w-4 h-4 text-amber-600" />
                <span>Restricted Identifying Data ({isFinder ? 'Finder View' : 'Security Desk View'})</span>
              </div>
              <div className="space-y-2 text-xs">
                {item.hidden_description && (
                  <div>
                    <span className="text-slate-500 font-medium">Hidden Description:</span>
                    <p className="font-mono text-slate-800 bg-white p-2 rounded border border-amber-200 mt-1">
                      {item.hidden_description}
                    </p>
                  </div>
                )}
                {item.hidden_attributes && (
                  <div>
                    <span className="text-slate-500 font-medium">Hidden Attributes:</span>
                    <pre className="font-mono text-slate-800 bg-white p-2 rounded border border-amber-200 mt-1 text-[11px] overflow-x-auto">
                      {JSON.stringify(item.hidden_attributes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custody History for Security / Admin */}
          {hasRole('SECURITY', 'ADMIN') && custodyHistory.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-sm font-bold text-slate-800">Chain of Custody Events</h3>
              <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden text-xs">
                {custodyHistory.map((ev) => (
                  <div key={ev.id} className="p-3 bg-white flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-800 uppercase">{ev.action}</span>
                      {ev.notes && <p className="text-slate-500 text-[11px] mt-0.5">{ev.notes}</p>}
                    </div>
                    <span className="text-slate-400 text-[11px] font-mono">{formatDate(ev.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
