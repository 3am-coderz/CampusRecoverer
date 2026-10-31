import React, { useEffect, useState } from 'react';
import { auditService, VerifyChainResult } from '../services/auditService';
import { AuditLogEntry } from '../kernel/types';
import { Table, Column } from '../components/Table';
import { formatDate } from '../utils/date';
import { ShieldCheck, ShieldAlert, History, Filter, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

export const AdminAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerifyChainResult | null>(null);

  // Filters
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [itemId, setItemId] = useState('');
  const [claimId, setClaimId] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await auditService.getAuditLogs({
        actor_id: actorId.trim() || undefined,
        action: action.trim() || undefined,
        item_id: itemId.trim() || undefined,
        claim_id: claimId.trim() || undefined,
        limit: 100,
      });
      setLogs(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const result = await auditService.verifyAuditChain();
      setVerificationResult(result);
    } catch (err: any) {
      alert(err.message || 'Hash chain verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const columns: Column<AuditLogEntry>[] = [
    {
      header: 'Seq #',
      accessor: (row) => <span className="font-mono font-bold text-xs">{row.seq}</span>,
    },
    {
      header: 'Timestamp',
      accessor: (row) => <span className="text-xs text-slate-500">{formatDate(row.created_at)}</span>,
    },
    {
      header: 'Action',
      accessor: (row) => (
        <span className="font-mono font-semibold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800">
          {row.action}
        </span>
      ),
    },
    {
      header: 'Actor ID',
      accessor: (row) => (
        <span className="font-mono text-xs text-slate-600 truncate block max-w-[120px]">
          {row.actor_id}
        </span>
      ),
    },
    {
      header: 'Item / Claim Reference',
      accessor: (row) => (
        <div className="text-[11px] font-mono text-slate-500 space-y-0.5">
          {row.item_id && <div>Item: {row.item_id.slice(0, 8)}...</div>}
          {row.claim_id && <div>Claim: {row.claim_id.slice(0, 8)}...</div>}
          {!row.item_id && !row.claim_id && <span className="text-slate-400">System</span>}
        </div>
      ),
    },
    {
      header: 'Cryptographic Hash Link',
      accessor: (row) => (
        <div className="font-mono text-[10px] text-slate-400 max-w-[200px] truncate" title={`Prev: ${row.prev_hash}\nRow: ${row.row_hash}`}>
          <div>P: {row.prev_hash ? row.prev_hash.slice(0, 16) : '0000000000000000'}...</div>
          <div className="text-slate-700 font-semibold">R: {row.row_hash.slice(0, 16)}...</div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-purple-600" />
            Tamper-Evident Audit Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Append-only, SHA-256 chained record of every state transition, access, and handover event.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleVerifyChain}
            disabled={verifying}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            {verifying ? 'Verifying Hashes...' : 'Verify Hash Chain'}
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
            verificationResult.valid
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          {verificationResult.valid ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <div>
            <p className="font-bold text-sm">
              {verificationResult.valid
                ? 'Hash Chain Integrity Verified 100%'
                : 'CRITICAL WARNING: Tamper Detected in Audit Ledger'}
            </p>
            <p className="mt-0.5">
              {verificationResult.valid
                ? `Cryptographic links verified across all ${verificationResult.totalRows} log entries. No records were modified or deleted.`
                : `Verification broke at sequence #${verificationResult.brokenAtSeq}. Possible database row tampering or truncation detected.`}
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <input
          type="text"
          placeholder="Filter Action (e.g. CLAIM_APPROVED)"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="px-3 py-2 border rounded-md"
        />
        <input
          type="text"
          placeholder="Filter Actor ID"
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          className="px-3 py-2 border rounded-md"
        />
        <input
          type="text"
          placeholder="Filter Item ID"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className="px-3 py-2 border rounded-md"
        />
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-slate-800 text-white font-semibold rounded-md hover:bg-slate-700 transition"
        >
          Apply Filters
        </button>
      </div>

      <Table columns={columns} data={logs} keyExtractor={(l) => l.id} />
    </div>
  );
};
