import React, { useEffect, useState } from 'react';
import { claimsService } from '../services/claimsService';
import { workflowService } from '../services/workflowService';
import { itemsService } from '../services/itemsService';
import { Claim, ItemPublic } from '../kernel/types';
import { Table, Column } from '../components/Table';
import { StatusBadge } from '../components/StatusBadge';
import { ScoreGuidanceBanner } from '../components/ScoreGuidanceBanner';
import { Modal } from '../components/Modal';
import { formatDate } from '../utils/date';
import {
  FileCheck,
  CheckCircle,
  XCircle,
  Columns,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';

export const AdminClaimsPage: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, ItemPublic>>({});
  const [loading, setLoading] = useState(true);

  // Modals state
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [competingClaims, setCompetingClaims] = useState<Claim[]>([]);
  const [targetItem, setTargetItem] = useState<ItemPublic | null>(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchClaimsAndItems = async () => {
    setLoading(true);
    try {
      const [allClaims, allItems] = await Promise.all([
        claimsService.getClaims({}),
        itemsService.getItems({ limit: 100 }),
      ]);
      setClaims(allClaims);
      const map: Record<string, ItemPublic> = {};
      allItems.forEach((it) => {
        map[it.id] = it;
      });
      setItemsMap(map);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaimsAndItems();
  }, []);

  const handleApprove = async (claim: Claim) => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await workflowService.approveClaim(claim.id);
      setStatusMessage(`Claim ${claim.id.slice(0, 8)} approved. Collection pass issued to claimant.`);
      fetchClaimsAndItems();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReject = (claim: Claim) => {
    setSelectedClaim(claim);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedClaim) return;
    setActionLoading(true);
    try {
      await workflowService.rejectClaim(selectedClaim.id, rejectReason || 'Did not meet verification criteria');
      setRejectModalOpen(false);
      fetchClaimsAndItems();
    } catch (err: any) {
      alert(err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompareClaimsForItem = (itemId: string) => {
    const matchedClaims = claims.filter((c) => c.item_id === itemId);
    const item = itemsMap[itemId] || null;
    setCompetingClaims(matchedClaims);
    setTargetItem(item);
    setCompareModalOpen(true);
  };

  // Detect items with multi high confidence claims
  const itemClaimsGroup: Record<string, Claim[]> = {};
  claims.forEach((c) => {
    if (!itemClaimsGroup[c.item_id]) itemClaimsGroup[c.item_id] = [];
    itemClaimsGroup[c.item_id].push(c);
  });

  const conflictItemIds = Object.keys(itemClaimsGroup).filter((itemId) => {
    const list = itemClaimsGroup[itemId];
    const highConfCount = list.filter(
      (c) => c.confidence_label === 'HIGH' || (c.final_score && c.final_score >= 80),
    ).length;
    return highConfCount > 1;
  });

  const columns: Column<Claim>[] = [
    {
      header: 'Claim ID / Date',
      accessor: (row) => (
        <div className="text-xs">
          <p className="font-mono font-bold text-slate-800">{row.id.slice(0, 8)}...</p>
          <span className="text-slate-400 text-[11px]">{formatDate(row.created_at)}</span>
        </div>
      ),
    },
    {
      header: 'Item',
      accessor: (row) => {
        const item = itemsMap[row.item_id];
        return (
          <div className="max-w-xs text-xs">
            <p className="font-medium text-slate-900 truncate">
              {item ? item.public_description : row.item_id}
            </p>
            <span className="text-[10px] text-slate-400 font-mono">
              Status: {item?.status || 'Unknown'}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Confidence Score',
      accessor: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-800 text-xs">
              {Math.round(row.final_score || 0)} / 100
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                row.confidence_label === 'HIGH'
                  ? 'bg-emerald-100 text-emerald-800'
                  : row.confidence_label === 'MEDIUM'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {row.confidence_label}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block">
            Struct: {Math.round(row.structured_score || 0)} | Sem: {Math.round(row.semantic_score || 0)}
          </span>
        </div>
      ),
    },
    {
      header: 'Claim Status',
      accessor: (row) => <StatusBadge status={row.status} type="claim" />,
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleCompareClaimsForItem(row.item_id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition"
            title="Side-by-side compare"
          >
            <Columns className="w-3.5 h-3.5" />
            Compare
          </button>

          {row.status !== 'APPROVED' && row.status !== 'COLLECTED' && (
            <button
              onClick={() => handleApprove(row)}
              disabled={actionLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Approve
            </button>
          )}

          {row.status !== 'REJECTED' && row.status !== 'COLLECTED' && (
            <button
              onClick={() => handleOpenReject(row)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-xs font-medium transition"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Claim Review & Resolution Queue</h1>
          <p className="text-xs text-slate-500 mt-1">
            Evaluate ownership claims, inspect algorithmic confidence, and resolve competing claims.
          </p>
        </div>
        <button
          onClick={fetchClaimsAndItems}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <ScoreGuidanceBanner />

      {conflictItemIds.length > 0 && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-2 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <span>Multi-Claim Conflict Detected on {conflictItemIds.length} Item(s)</span>
          </div>
          <p>
            The following items have multiple claims that have achieved high confidence scores:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {conflictItemIds.map((itemId) => (
              <button
                key={itemId}
                onClick={() => handleCompareClaimsForItem(itemId)}
                className="px-3 py-1 bg-amber-200 text-amber-900 font-semibold rounded-lg hover:bg-amber-300 transition flex items-center gap-1.5"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Compare Claims for: {itemsMap[itemId]?.public_description || itemId}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold">
          {statusMessage}
        </div>
      )}

      <Table columns={columns} data={claims} keyExtractor={(c) => c.id} />

      {/* Side-by-Side Comparison Modal */}
      <Modal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        title="Side-by-Side Claim Conflict Resolution"
        description={`Evaluating competing claims for: ${targetItem?.public_description || 'Item'}`}
        maxWidth="2xl"
      >
        <div className="space-y-6">
          <ScoreGuidanceBanner isMultiConflict={competingClaims.length > 1} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
            {competingClaims.map((c, idx) => (
              <div
                key={c.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-slate-800">Claimant #{idx + 1}</span>
                  <StatusBadge status={c.status} type="claim" />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Confidence</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-blue-600">
                      {Math.round(c.final_score || 0)} / 100
                    </span>
                    <span className="font-semibold text-slate-600 uppercase text-[10px] bg-white px-2 py-0.5 rounded border">
                      {c.confidence_label}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Description</span>
                  <p className="text-slate-800 bg-white p-2 rounded border">{c.description}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Claimed Attributes</span>
                  <pre className="text-[10px] font-mono bg-white p-2 rounded border overflow-x-auto text-slate-700">
                    {JSON.stringify(c.claimed_attributes, null, 2)}
                  </pre>
                </div>

                <div className="space-y-1 text-[11px] text-slate-500">
                  <p>Lost Date: {formatDate(c.lost_date)}</p>
                  <p>Lost Location: {c.lost_location}</p>
                </div>

                <div className="pt-2 border-t flex justify-end gap-2">
                  <button
                    onClick={() => {
                      handleApprove(c);
                      setCompareModalOpen(false);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition"
                  >
                    Select & Approve
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setCompareModalOpen(false)}
              className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Ownership Claim"
        description="Provide justification for claim rejection."
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Reason for Rejection</label>
            <textarea
              rows={3}
              placeholder="e.g. Serial numbers do not match; answers to challenge questions incorrect"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setRejectModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReject}
              disabled={actionLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
