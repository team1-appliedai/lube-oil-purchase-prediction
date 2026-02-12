'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PurchaseAction } from '@/lib/optimizer/types';

const actionConfig: Record<
  PurchaseAction,
  { label: string; className: string }
> = {
  ORDER: {
    label: 'ORDER',
    className: 'bg-maritime-green/20 text-maritime-green border-maritime-green/30',
  },
  URGENT: {
    label: 'URGENT',
    className: 'bg-maritime-orange/20 text-maritime-orange border-maritime-orange/30',
  },
  SKIP: {
    label: 'SKIP',
    className: 'bg-muted text-muted-foreground border-border',
  },
  ALERT: {
    label: 'ALERT',
    className: 'bg-maritime-red/20 text-maritime-red border-maritime-red/30 animate-pulse',
  },
};

interface ActionBadgeProps {
  action: PurchaseAction;
  className?: string;
}

export function ActionBadge({ action, className }: ActionBadgeProps) {
  const config = actionConfig[action];
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] font-bold uppercase tracking-wider', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
