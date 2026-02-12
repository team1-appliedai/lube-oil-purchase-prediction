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

  const getColor = () => {
    if (current <= minRob) return 'bg-maritime-red';
    if (pct < 40) return 'bg-maritime-amber';
    return 'bg-maritime-green';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {formatLiters(current)} / {formatLiters(capacity)} ({formatPct(pct, 0)})
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-muted overflow-hidden">
        {/* Min ROB indicator */}
        <div
          className="absolute top-0 bottom-0 w-px bg-maritime-red/70 z-10"
          style={{ left: `${Math.min(minPct, 100)}%` }}
        />
        {/* Fill level */}
        <div
          className={cn('h-full rounded-full transition-all duration-500', getColor())}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
