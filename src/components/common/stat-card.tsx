'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const variantColors = {
  default: { value: 'text-mw-purple', circle: 'status-circle-info', icon: 'text-mw-purple' },
  success: { value: 'text-emerald-600', circle: 'status-circle-success', icon: 'text-emerald-500' },
  warning: { value: 'text-amber-600', circle: 'status-circle-warning', icon: 'text-amber-500' },
  danger: { value: 'text-red-600', circle: 'status-circle-danger', icon: 'text-red-500' },
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  const colors = variantColors[variant];

  return (
    <div className="soft-card">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="section-label">{title}</p>
          <p className={cn('metric-sm', colors.value)}>{value}</p>
          {subtitle && <p className="caption">{subtitle}</p>}
          {trend && (
            <p
              className={cn(
                'text-xs font-medium',
                trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {trend.value >= 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className={colors.circle}>
            <Icon className={cn('h-5 w-5', colors.icon)} />
          </div>
        )}
      </div>
    </div>
  );
}
