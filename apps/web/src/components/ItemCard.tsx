import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ItemPublic } from '../kernel/types';
import { StatusBadge } from './StatusBadge';
import { formatCategory } from '../utils/formatters';
import { formatDate } from '../utils/date';

interface ItemCardProps {
  item: ItemPublic;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between group">
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
            {formatCategory(item.category)}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {item.risk_level === 'HIGH' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                <ShieldAlert className="w-3 h-3" />
                High Risk
              </span>
            )}
            <StatusBadge status={item.status} />
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition line-clamp-2 text-base">
            {item.public_description}
          </h3>
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{item.found_location_public}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>Found {formatDate(item.found_date)}</span>
          </div>
          {item.security_verified && (
            <div className="flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Custody Verified by Security Desk</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400 font-mono">ID: {item.id.slice(0, 8)}...</span>
        <Link
          to={`/items/${item.id}`}
          className="inline-flex items-center px-3.5 py-1.5 bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 rounded-md text-xs font-semibold text-slate-700 shadow-sm transition"
        >
          View Details &rarr;
        </Link>
      </div>
    </div>
  );
};
