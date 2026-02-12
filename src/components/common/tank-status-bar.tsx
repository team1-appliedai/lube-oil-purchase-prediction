'use client';

import { cn } from '@/lib/utils';
import { formatLiters, formatPct } from '@/lib/utils/format';

interface TankStatusBarProps {
  label: string;
  current: number;
  capacity: number;
  minRob: number;
}

export function TankStatusBar({ label, current, capacity, minRob }: TankStatusBarProps) {
  const pct = capacity > 0 ? (current / capacity) * 100 : 0;
  const minPct = capacity > 0 ? (minRob / capacity) * 100 : 0;

  const getFillClass = () => {
    if (current <= minRob) return 'progress-fill-danger';
    if (pct < 40) return 'progress-fill-warning';
    return 'progress-fill-success';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-400">
          {formatLiters(current)} / {formatLiters(capacity)} ({formatPct(pct, 0)})
        </span>
      </div>
      <div className="progress-track relative">
        {/* Min ROB indicator */}
        <div
          className="absolute top-0 bottom-0 w-px bg-red-400/70 z-10"
          style={{ left: `${Math.min(minPct, 100)}%` }}
        />
        {/* Fill level */}
        <div
          className={cn(getFillClass())}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
