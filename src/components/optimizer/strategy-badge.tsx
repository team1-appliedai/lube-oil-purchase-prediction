'use client';

import { cn } from '@/lib/utils';
import type { StrategyName } from '@/lib/optimizer/types';

const strategyStyles: Record<StrategyName, string> = {
  grid: 'badge-info',
  'cheapest-port': 'badge-success',
  'delivery-aware': 'badge-warning',
  consolidated: 'badge-purple',
};

const strategyLabels: Record<StrategyName, string> = {
  grid: 'Grid',
  'cheapest-port': 'Cheapest Port',
  'delivery-aware': 'Delivery-Aware',
  consolidated: 'Consolidated',
};

interface StrategyBadgeProps {
  strategy: StrategyName;
  className?: string;
}

export function StrategyBadge({ strategy, className }: StrategyBadgeProps) {
  return (
    <span
      className={cn(
        'text-[11px] font-semibold',
        strategyStyles[strategy],
        className
      )}
    >
      {strategyLabels[strategy]}
    </span>
  );
}
