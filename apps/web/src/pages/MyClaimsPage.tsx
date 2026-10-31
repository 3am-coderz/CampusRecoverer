import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { claimsService } from '../services/claimsService';
import { Claim } from '../kernel/types';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../utils/date';
import { Shield, QrCode, ArrowRight, RefreshCw, FileText } from 'lucide-react';
import { useAuth } from '../kernel/auth-context';

export const MyClaimsPage: React.FC = () => {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await claimsService.getClaims({ claimant_id: user?.id });
      setClaims(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchClaims();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Ownership Claims</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track verification progress, challenge question scoring, and collection authorization.
          </p>
        </div>
        <button
          onClick={fetchClaims}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
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
      ) : claims.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">No Claims Submitted Yet</h3>
          <p className="text-xs text-slate-500">
            If you lost an item, browse our directory or file a report.
          </p>
          <Link
            to="/items"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
          >
            Browse Campus Items &rarr;
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={claim.status} type="claim" />
                  <span className="text-xs text-slate-400 font-mono">
                    Claim ID: {claim.id.slice(0, 8)}...
                  </span>
                  <span className="text-xs text-slate-400">&bull;</span>
                  <span className="text-xs text-slate-500">Submitted {formatDate(claim.created_at)}</span>
                </div>

                <p className="text-sm font-medium text-slate-800 line-clamp-2">{claim.description}</p>

                <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                  <div>
                    <span className="text-slate-400">Claim Confidence: </span>
                    <span className="font-bold text-slate-700">
                      {claim.confidence_label ? `${claim.confidence_label} (${Math.round(claim.final_score || 0)}/100)` : 'Pending Scoring'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Lost Date: </span>
                    <span>{formatDate(claim.lost_date)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                {(claim.status === 'APPROVED' || (claim.status as any) === 'APPROVED_AWAITING_COLLECTION') ? (
                  <Link
                    to={`/collection/${claim.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    <QrCode className="w-4 h-4" />
                    Collection Pass & OTP
                  </Link>
                ) : (
                  <Link
                    to={`/items/${claim.item_id}`}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                  >
                    View Item &rarr;
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
