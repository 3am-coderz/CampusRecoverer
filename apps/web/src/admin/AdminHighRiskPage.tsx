import React, { useEffect, useState } from 'react';
import { itemsService } from '../services/itemsService';
import { ItemPublic } from '../kernel/types';
import { Table, Column } from '../components/Table';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../utils/date';
import { formatCategory } from '../utils/formatters';
import { ShieldAlert, Lock, CheckCircle2, AlertOctagon, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminHighRiskPage: React.FC = () => {
  const [items, setItems] = useState<ItemPublic[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHighRiskItems = async () => {
    setLoading(true);
    try {
      const data = await itemsService.getItems({ limit: 100 });
      setItems(data.filter((i) => i.risk_level === 'HIGH'));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHighRiskItems();
  }, []);

  const columns: Column<ItemPublic>[] = [
    {
      header: 'High-Risk Asset',
      accessor: (row) => (
        <div className="max-w-xs text-xs">
          <p className="font-bold text-slate-900 truncate">{row.public_description}</p>
          <span className="text-[10px] text-slate-400 font-mono">ID: {row.id.slice(0, 8)}...</span>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: (row) => <span className="text-xs font-semibold">{formatCategory(row.category)}</span>,
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Found Details',
      accessor: (row) => (
        <div className="text-xs">
          <p className="text-slate-800">{row.found_location_public}</p>
          <p className="text-slate-400 text-[11px]">{formatDate(row.found_date)}</p>
        </div>
      ),
    },
    {
      header: 'Custody Protocol',
      accessor: (row) => (
        <div className="space-y-1 text-[11px]">
          <div className="flex items-center gap-1 text-red-700 font-semibold">
            <Lock className="w-3 h-3" />
            <span>Vault Storage Required</span>
          </div>
          <div className="flex items-center gap-1 text-slate-600">
            <AlertOctagon className="w-3 h-3 text-amber-500" />
            <span>Govt/Campus Photo ID Mandatory</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Quick Action',
      accessor: (row) => (
        <Link
          to={`/admin/desk?claimId=&itemId=${row.id}`}
          className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition"
        >
          Desk Action &rarr;
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600" />
            High-Risk Asset Protocols
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Laptops, mobile devices, wallets, identification, keys, and financial assets requiring strict custody verification.
          </p>
        </div>
        <button
          onClick={fetchHighRiskItems}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Protocol Banner */}
      <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl space-y-2 text-xs text-red-900">
        <h4 className="font-bold text-sm text-red-950 flex items-center gap-1.5">
          <AlertOctagon className="w-4 h-4 text-red-600" /> Mandatory High-Risk Handling Invariants:
        </h4>
        <ul className="list-disc list-inside space-y-1 text-red-800">
          <li><strong>Vault Isolation:</strong> High-risk assets must be immediately locked inside the central security vault.</li>
          <li><strong>Mandatory Photo ID:</strong> Physical handover cannot be finalized without officer inspection of claimant government or student photo ID.</li>
          <li><strong>No Finder Title:</strong> Finders cannot claim ownership or title on high-risk devices containing private student data.</li>
        </ul>
      </div>

      <Table columns={columns} data={items} keyExtractor={(i) => i.id} />
    </div>
  );
};
