import React from 'react';
import { ItemStatus, ClaimStatus, RiskLevel } from '../kernel/types';
import { formatItemStatus, formatClaimStatus, formatRiskBadge } from '../utils/formatters';
import { cn } from '../utils/cn';

interface StatusBadgeProps {
  status?: ItemStatus | ClaimStatus;
  type?: 'item' | 'claim';
  risk?: RiskLevel;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'item', risk, className }) => {
  if (risk) {
    const { label, className: riskCls } = formatRiskBadge(risk);
    return (
      <span
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
          riskCls,
          className,
        )}
      >
        {label}
      </span>
    );
  }

  if (!status) return null;

  const info = type === 'claim' ? formatClaimStatus(status as ClaimStatus) : formatItemStatus(status as ItemStatus);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        info.className,
        className,
      )}
    >
      {info.label}
    </span>
  );
};
