'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { StrategyName } from '@/lib/optimizer/types';

const strategyStyles: Record<StrategyName, string> = {
  grid: 'bg-blue-100 text-blue-800 border-blue-200',
  'cheapest-port': 'bg-green-100 text-green-800 border-green-200',
  'delivery-aware': 'bg-amber-100 text-amber-800 border-amber-200',
  consolidated: 'bg-purple-100 text-purple-800 border-purple-200',
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
    <Badge
      variant="outline"
      className={cn(
        'text-[11px] font-semibold border',
        strategyStyles[strategy],
        className
      )}
    >
      {strategyLabels[strategy]}
    </Badge>
  );
}
