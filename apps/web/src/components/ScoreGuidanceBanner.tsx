import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';
import { cn } from '../utils/cn';

interface ScoreGuidanceBannerProps {
  score?: number;
  confidenceLabel?: 'LOW' | 'MEDIUM' | 'HIGH';
  className?: string;
  isMultiConflict?: boolean;
}

export const ScoreGuidanceBanner: React.FC<ScoreGuidanceBannerProps> = ({
  score,
  confidenceLabel,
  className,
  isMultiConflict = false,
}) => {
  return (
    <div
      className={cn(
        'rounded-lg p-4 border transition-all text-sm',
        isMultiConflict
          ? 'bg-amber-50 border-amber-300 text-amber-900'
          : 'bg-blue-50 border-blue-200 text-blue-900',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {isMultiConflict ? (
          <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        ) : (
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        )}
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <span>Ownership Match Score / Claim Confidence Score</span>
            {score !== undefined && (
              <span className="px-2 py-0.5 rounded bg-white text-slate-800 text-xs font-bold border border-slate-300 shadow-sm">
                {Math.round(score)} / 100
              </span>
            )}
            {confidenceLabel && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-bold uppercase',
                  confidenceLabel === 'HIGH'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : confidenceLabel === 'MEDIUM'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300',
                )}
              >
                {confidenceLabel} Confidence
              </span>
            )}
          </div>
          <p className="text-xs text-slate-700">
            <strong>Mandatory Protocol:</strong> Score is guidance; security makes the final decision.
            All claims must undergo strict verification before asset release.
          </p>
          {isMultiConflict && (
            <p className="text-xs font-semibold text-amber-800 mt-1 bg-amber-100/80 p-2 rounded">
              Warning: Multiple competing claims have reached high confidence thresholds for this item.
              Automatic approval is suspended; security desk manual interview required.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
