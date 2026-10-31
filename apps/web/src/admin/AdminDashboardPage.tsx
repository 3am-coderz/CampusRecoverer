import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { itemsService } from '../services/itemsService';
import { claimsService } from '../services/claimsService';
import { ItemPublic, Claim } from '../kernel/types';
import {
  Package,
  FileCheck,
  ShieldAlert,
  Clock,
  QrCode,
  History,
  ArrowRight,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [items, setItems] = useState<ItemPublic[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsData, claimsData] = await Promise.all([
        itemsService.getItems({ limit: 100 }),
        claimsService.getClaims({}),
      ]);
      setItems(itemsData);
      setClaims(claimsData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pendingHandover = items.filter((i) => i.status === 'PENDING_HANDOVER').length;
  const awaitingCollection = items.filter((i) => i.status === 'APPROVED_AWAITING_COLLECTION').length;
  const highRiskItems = items.filter((i) => i.risk_level === 'HIGH').length;
  const activeClaims = claims.filter((c) => c.status === 'SUBMITTED' || c.status === 'MANUAL_REVIEW').length;
  const expiredItems = items.filter((i) => i.status === 'EXPIRED').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Security Desk Command Console</h1>
          <p className="text-xs text-slate-500 mt-1">
            Custody management, claim verification desk, and tamper-evident audit control
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Receipt</span>
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-3xl font-extrabold text-orange-600">{pendingHandover}</p>
          <p className="text-[11px] text-slate-400">Items awaiting finder drop-off</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Awaiting Pickup</span>
            <Package className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-3xl font-extrabold text-indigo-600">{awaitingCollection}</p>
          <p className="text-[11px] text-slate-400">QR collection passes issued</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Claims</span>
            <FileCheck className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-extrabold text-blue-600">{activeClaims}</p>
          <p className="text-[11px] text-slate-400">Awaiting review or scoring</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">High Risk Assets</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-3xl font-extrabold text-red-600">{highRiskItems}</p>
          <p className="text-[11px] text-slate-400">Photo ID verification required</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Expired Items</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-3xl font-extrabold text-slate-600">{expiredItems}</p>
          <p className="text-[11px] text-slate-400">Eligible for donation/disposal</p>
        </div>
      </div>

      {/* Quick Launchpad */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/admin/desk"
          className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-6 rounded-2xl shadow-md hover:shadow-lg transition space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <ArrowRight className="w-5 h-5 text-blue-300 group-hover:translate-x-1 transition" />
          </div>
          <h3 className="font-bold text-lg">Handover & Release Desk</h3>
          <p className="text-xs text-blue-200 leading-relaxed">
            Scan claimant QR codes, verify 6-digit release OTPs, and conduct photo ID checks for asset handover.
          </p>
        </Link>

        <Link
          to="/admin/claims"
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 transition space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <FileCheck className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition" />
          </div>
          <h3 className="font-bold text-lg text-slate-900">Claim Review Queue</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Compare competing claims side-by-side, inspect confidence scores, and resolve multi-claim conflicts.
          </p>
        </Link>

        <Link
          to="/admin/audit"
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-purple-400 transition space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
              <History className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition" />
          </div>
          <h3 className="font-bold text-lg text-slate-900">Tamper-Evident Audit</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Verify cryptographic hash-chain integrity across every custody transition and status change.
          </p>
        </Link>
      </div>
    </div>
  );
};
