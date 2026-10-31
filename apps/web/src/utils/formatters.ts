import { ItemStatus, ClaimStatus, RiskLevel } from '../kernel/types';

export const CATEGORIES = [
  'ELECTRONICS',
  'DOCUMENTS',
  'ACCESSORIES',
  'BAGS',
  'CLOTHING',
  'KEYS',
  'BOOKS',
  'OTHER',
] as const;

export function formatCategory(cat: string): string {
  if (!cat) return 'Uncategorized';
  return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function formatRiskBadge(level: RiskLevel): { label: string; className: string } {
  switch (level) {
    case 'HIGH':
      return {
        label: 'High Risk',
        className: 'bg-red-100 text-red-800 border-red-200',
      };
    case 'MEDIUM':
      return {
        label: 'Medium Risk',
        className: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    case 'LOW':
    default:
      return {
        label: 'Standard',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
  }
}

export function formatItemStatus(status: ItemStatus): { label: string; className: string } {
  switch (status) {
    case 'PENDING_HANDOVER':
      return { label: 'Pending Handover to Desk', className: 'bg-orange-100 text-orange-800 border-orange-200' };
    case 'WAITING_PERIOD':
      return { label: 'Waiting Period (Finder Handover)', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    case 'OPEN_FOR_CLAIMS':
      return { label: 'Open for Claims', className: 'bg-blue-100 text-blue-800 border-blue-200' };
    case 'UNDER_REVIEW':
      return { label: 'Under Review', className: 'bg-purple-100 text-purple-800 border-purple-200' };
    case 'APPROVED_AWAITING_COLLECTION':
      return { label: 'Approved & Awaiting Collection', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
    case 'COLLECTED':
      return { label: 'Collected / Recovered', className: 'bg-green-100 text-green-800 border-green-200' };
    case 'STORED_LONG_TERM':
      return { label: 'Stored Long-Term', className: 'bg-slate-100 text-slate-800 border-slate-200' };
    case 'EXPIRED':
      return { label: 'Expired', className: 'bg-gray-100 text-gray-800 border-gray-200' };
    case 'DONATED':
      return { label: 'Donated', className: 'bg-teal-100 text-teal-800 border-teal-200' };
    case 'DISPOSED':
      return { label: 'Disposed', className: 'bg-rose-100 text-rose-800 border-rose-200' };
    default:
      return { label: status, className: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

export function formatClaimStatus(status: ClaimStatus): { label: string; className: string } {
  switch (status) {
    case 'SUBMITTED':
      return { label: 'Submitted', className: 'bg-blue-100 text-blue-800 border-blue-200' };
    case 'SCORED':
      return { label: 'Scored', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' };
    case 'MANUAL_REVIEW':
      return { label: 'Requires Manual Review', className: 'bg-amber-100 text-amber-800 border-amber-200' };
    case 'APPROVED':
      return { label: 'Approved', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    case 'REJECTED':
      return { label: 'Rejected', className: 'bg-red-100 text-red-800 border-red-200' };
    case 'WITHDRAWN':
      return { label: 'Withdrawn', className: 'bg-gray-100 text-gray-800 border-gray-200' };
    case 'COLLECTED':
      return { label: 'Collected', className: 'bg-green-100 text-green-800 border-green-200' };
    default:
      return { label: status, className: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}
