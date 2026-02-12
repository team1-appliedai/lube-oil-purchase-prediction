'use client';

import { formatUSD, formatPct } from '@/lib/utils/format';
import type { OptimizerOutput } from '@/lib/optimizer/types';

interface SavingsSummaryProps {
  result: OptimizerOutput;
}

export function SavingsSummary({ result }: SavingsSummaryProps) {
  const { totalCost, baselineCost, savings, totalDeliveryCharges, purchaseEvents } = result;
  const hasSavings = savings.total > 0;
  const optimizedTotal = totalCost.total + totalDeliveryCharges;
  const baselineTotal = baselineCost.total + result.baselineDeliveryCharges;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="soft-card">
        <p className="section-label">Optimized Cost</p>
        <p className="metric-sm mt-1">{formatUSD(optimizedTotal)}</p>
        <div className="mt-2 space-y-0.5 caption">
          <p>Cylinder: {formatUSD(totalCost.cylinderOil)}</p>
          <p>ME System: {formatUSD(totalCost.meSystemOil)}</p>
          <p>AE System: {formatUSD(totalCost.aeSystemOil)}</p>
          <p className="pt-0.5 border-t border-slate-200/50 mt-1">
            incl. {formatUSD(totalDeliveryCharges)} delivery ({purchaseEvents} events)
          </p>
        </div>
      </div>

      <div className="soft-card">
        <p className="section-label">Baseline Cost</p>
        <p className="metric-sm mt-1 text-slate-400">
          {formatUSD(baselineTotal)}
        </p>
        <div className="mt-2 space-y-0.5 caption">
          <p>Cylinder: {formatUSD(baselineCost.cylinderOil)}</p>
          <p>ME System: {formatUSD(baselineCost.meSystemOil)}</p>
          <p>AE System: {formatUSD(baselineCost.aeSystemOil)}</p>
          <p className="pt-0.5 border-t border-slate-200/50 mt-1">
            incl. {formatUSD(result.baselineDeliveryCharges)} delivery ({result.baselinePurchaseEvents} events)
          </p>
        </div>
      </div>

      <div className="soft-card">
        <p className="section-label">Total Savings</p>
        <p className={`metric-sm mt-1 ${hasSavings ? 'text-emerald-600' : ''}`}>
          {formatUSD(savings.total)}
        </p>
        <div className="mt-2 space-y-0.5 caption">
          <p>Cylinder: {formatUSD(savings.cylinderOil)}</p>
          <p>ME System: {formatUSD(savings.meSystemOil)}</p>
          <p>AE System: {formatUSD(savings.aeSystemOil)}</p>
        </div>
      </div>

      <div className="soft-card">
        <p className="section-label">Savings Percentage</p>
        <p className={`metric-sm mt-1 ${hasSavings ? 'text-emerald-600' : ''}`}>
          {formatPct(savings.pct)}
        </p>
        <p className="mt-2 caption">vs. reactive procurement</p>
      </div>
    </div>
  );
}
