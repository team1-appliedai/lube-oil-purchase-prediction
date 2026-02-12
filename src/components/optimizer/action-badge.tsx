'use client';

import { cn } from '@/lib/utils';
import type { PurchaseAction } from '@/lib/optimizer/types';

const actionConfig: Record<
  PurchaseAction,
  { label: string; className: string }
> = {
  ORDER: {
    label: 'ORDER',
    className: 'badge-success',
  },
  URGENT: {
    label: 'URGENT',
    className: 'badge-warning',
  },
  SKIP: {
    label: 'SKIP',
    className: 'badge-neutral',
  },
  ALERT: {
    label: 'ALERT',
    className: 'badge-danger animate-pulse',
  },
};

interface ActionBadgeProps {
  action: PurchaseAction;
  className?: string;
}

export function ActionBadge({ action, className }: ActionBadgeProps) {
  const config = actionConfig[action];
  return (
    <span
      className={cn('text-[10px] font-bold uppercase tracking-wider', config.className, className)}
    >
      {config.label}
    </span>
  );
}
