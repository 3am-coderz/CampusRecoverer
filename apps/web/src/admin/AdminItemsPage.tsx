import React, { useEffect, useState } from 'react';
import { itemsService } from '../services/itemsService';
import { handoverService } from '../services/handoverService';
import { workflowService } from '../services/workflowService';
import { ItemDetail, ItemPublic } from '../kernel/types';
import { Table, Column } from '../components/Table';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { formatDate } from '../utils/date';
import { formatCategory } from '../utils/formatters';
import { Eye, CheckCircle2, PackageCheck, RefreshCw, Search } from 'lucide-react';

export const AdminItemsPage: React.FC = () => {
  const [items, setItems] = useState<ItemPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ItemDetail | null>(null);
  const [hiddenModalOpen, setHiddenModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await itemsService.getItems({ limit: 100 });
      setItems(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleOpenHidden = async (item: ItemPublic) => {
    try {
      const detail = await itemsService.getItem(item.id);
      setSelectedItem(detail);
      setHiddenModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load item details');
    }
  };

  const handleOpenReceive = (item: ItemPublic) => {
    setSelectedItem(item as ItemDetail);
    setReceiveNotes('');
    setActionError(null);
    setActionSuccess(null);
    setReceiveModalOpen(true);
  };

  const handleConfirmReceive = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await handoverService.receiveItem(selectedItem.id, receiveNotes);
      setActionSuccess('Item received at security desk and transitioned to OPEN_FOR_CLAIMS.');
      setTimeout(() => {
        setReceiveModalOpen(false);
        fetchItems();
      }, 1200);
    } catch (err: any) {
      setActionError(err.message || 'Failed to receive item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyCustody = async (item: ItemPublic) => {
    try {
      await workflowService.addCustodyEvent(
        item.id,
        'PHYSICAL_CUSTODY_VERIFIED',
        'Physical custody confirmed in secure campus storage vault.',
      );
      fetchItems();
    } catch (err: any) {
      alert(err.message || 'Failed to record custody verification');
    }
  };

  const columns: Column<ItemPublic>[] = [
    {
      header: 'Item',
      accessor: (row) => (
        <div className="max-w-xs">
          <p className="font-semibold text-slate-900 truncate">{row.public_description}</p>
          <span className="text-[10px] text-slate-400 font-mono">{row.id.slice(0, 8)}...</span>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: (row) => <span className="font-medium text-xs">{formatCategory(row.category)}</span>,
    },
    {
      header: 'Risk Level',
      accessor: (row) => <StatusBadge risk={row.risk_level} />,
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Found Location & Date',
      accessor: (row) => (
        <div className="text-xs">
          <p className="text-slate-800">{row.found_location_public}</p>
          <p className="text-slate-400 text-[11px]">{formatDate(row.found_date)}</p>
        </div>
      ),
    },
    {
      header: 'Security Desk Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          {row.status === 'PENDING_HANDOVER' && (
            <button
              onClick={() => handleOpenReceive(row)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs transition"
              title="Receive from finder at desk"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              Receive at Desk
            </button>
          )}

          <button
            onClick={() => handleOpenHidden(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition"
            title="View concealed attributes"
          >
            <Eye className="w-3.5 h-3.5" />
            Hidden Info
          </button>

          <button
            onClick={() => handleVerifyCustody(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium transition"
            title="Log physical custody check"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verify
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Item Inventory & Custody Desk</h1>
          <p className="text-xs text-slate-500 mt-1">
            Accept physical items from finders, inspect concealed proofs, and log chain-of-custody.
          </p>
        </div>
        <button
          onClick={fetchItems}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <Table columns={columns} data={items} keyExtractor={(item) => item.id} />

      {/* Receive Item at Desk Modal */}
      <Modal
        isOpen={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        title="Receive Item from Finder at Security Desk"
        description="Verify physical condition before releasing into open claims inventory."
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
            <span className="font-bold text-slate-700">Item:</span>
            <p className="text-slate-900">{selectedItem?.public_description}</p>
          </div>

          {actionError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg font-medium">
              {actionError}
            </div>
          )}

          {actionSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-lg font-medium">
              {actionSuccess}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Security / Vault Notes</label>
            <textarea
              rows={3}
              placeholder="e.g. Received intact, placed in Vault Shelf B-12"
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={() => setReceiveModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReceive}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              {actionLoading ? 'Processing...' : 'Confirm Receipt & Open for Claims'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Hidden Info Modal */}
      <Modal
        isOpen={hiddenModalOpen}
        onClose={() => setHiddenModalOpen(false)}
        title="Restricted Identifying Information"
        description="Concealed traits used for zero-knowledge claimant challenge questions."
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border space-y-1">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
              Public Description
            </span>
            <p className="font-medium text-slate-800">{selectedItem?.public_description}</p>
          </div>

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1">
            <span className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">
              Hidden Description (Private)
            </span>
            <p className="font-mono text-slate-900 bg-white p-2 rounded border border-amber-200 mt-1">
              {selectedItem?.hidden_description || 'None provided'}
            </p>
          </div>

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1">
            <span className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">
              Hidden Attributes / Serials (Private)
            </span>
            <pre className="font-mono text-slate-900 bg-white p-2 rounded border border-amber-200 mt-1 text-[11px] overflow-x-auto">
              {selectedItem?.hidden_attributes
                ? JSON.stringify(selectedItem.hidden_attributes, null, 2)
                : 'No private attributes recorded'}
            </pre>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setHiddenModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
