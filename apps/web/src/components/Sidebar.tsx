import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, FileCheck, ShieldAlert, History, QrCode } from 'lucide-react';
import { cn } from '../utils/cn';

const ADMIN_LINKS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/items', label: 'Item Inventory', icon: Package },
  { to: '/admin/claims', label: 'Claim Queue & Review', icon: FileCheck },
  { to: '/admin/high-risk', label: 'High Risk Protocols', icon: ShieldAlert },
  { to: '/admin/desk', label: 'Handover Desk & OTP', icon: QrCode },
  { to: '/admin/audit', label: 'Tamper-Evident Audit', icon: History },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col min-h-[calc(100vh-4rem)] border-r border-slate-800 flex-shrink-0">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Security & Admin Console
        </h2>
        <p className="text-[11px] text-slate-500 mt-0.5">Role-enforced verification portal</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {ADMIN_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition',
                  isActive
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60',
                )
              }
            >
              <Icon className="w-4 h-4" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Security Station Active</span>
        </div>
      </div>
    </aside>
  );
};
