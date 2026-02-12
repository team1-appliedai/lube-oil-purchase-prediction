'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StrategyBadge } from './strategy-badge';
import { SavingsSummary } from './savings-summary';
import { PurchasePlanTable } from './purchase-plan-table';
import { ROBProjectionChart } from './rob-projection-chart';
import { PriceComparisonChart } from './price-comparison-chart';
import { formatUSD, formatPct } from '@/lib/utils/format';
import type { SmartOptimizerResult, RankedPlan, OilGradeConfig } from '@/lib/optimizer/types';

interface RankedPlansTableProps {
  result: SmartOptimizerResult;
  oilGrades: OilGradeConfig[];
  onSavePlan: (plan: RankedPlan) => void;
  saving: boolean;
}

export function RankedPlansTable({ result, oilGrades, onSavePlan, saving }: RankedPlansTableProps) {
  const [expandedRank, setExpandedRank] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          {result.combinationsEvaluated} combinations evaluated in {result.elapsedMs}ms
        </span>
        <span>
          Baseline: {formatUSD(result.baseline.cost)} ({result.baseline.purchaseEvents} events)
        </span>
      </div>

      {/* Ranked plans */}
      <div className="overflow-x-auto rounded-xl soft-card p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th className="px-3 py-2.5">#</th>
              <th className="px-3 py-2.5 text-center">Safety</th>
              <th className="px-3 py-2.5">Strategy</th>
              <th className="px-3 py-2.5 text-right">All-In Cost</th>
              <th className="px-3 py-2.5 text-right">Savings</th>
              <th className="px-3 py-2.5 text-right">Savings %</th>
              <th className="px-3 py-2.5 text-right">Events</th>
              <th className="px-3 py-2.5 text-right">Delivery</th>
              <th className="px-3 py-2.5 text-center"></th>
            </tr>
          </thead>
          <tbody>
            {result.plans.map((plan) => {
              const isExpanded = expandedRank === plan.rank;
              const hasSavings = plan.savings > 0;

              return (
                <tr
                  key={plan.rank}
                  className={`${
                    isExpanded ? '!bg-mw-purple/[0.03]' : ''
                  } ${!plan.safe ? 'opacity-50' : plan.rank === 1 ? '!bg-emerald-50/50' : ''}`}
                  style={!plan.safe ? { background: 'rgba(239, 68, 68, 0.03)' } : undefined}
                >
                  <td className="px-3 py-2.5 font-mono text-slate-400">
                    {plan.rank}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {plan.safe ? (
                      <span className="badge-success">Safe</span>
                    ) : (
                      <span className="badge-danger" title={`${plan.robBreaches} ROB breach${plan.robBreaches !== 1 ? 'es' : ''}`}>
                        Unsafe
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <StrategyBadge strategy={plan.strategy} />
                      <span className="text-xs text-slate-400 truncate max-w-[200px]">
                        {plan.strategy === 'grid' ? plan.strategyLabel.replace('Grid: ', '') : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-700">
                    {formatUSD(plan.allInCost)}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono font-medium ${
                    hasSavings ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {hasSavings ? '+' : ''}{formatUSD(plan.savings)}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono ${
                    hasSavings ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {formatPct(plan.savingsPct)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                    {plan.output.purchaseEvents}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                    {formatUSD(plan.output.totalDeliveryCharges)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setExpandedRank(isExpanded ? null : plan.rank)}
                    >
                      {isExpanded ? 'Hide' : 'View'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded plan detail */}
      {expandedRank !== null && (
        <PlanDetail
          plan={result.plans.find((p) => p.rank === expandedRank)!}
          oilGrades={oilGrades}
          onSave={onSavePlan}
          saving={saving}
        />
      )}
    </div>
  );
}

function PlanDetail({
  plan,
  oilGrades,
  onSave,
  saving,
}: {
  plan: RankedPlan;
  oilGrades: OilGradeConfig[];
  onSave: (plan: RankedPlan) => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6 soft-card">
      {!plan.safe && (
        <div className="rounded-xl px-4 py-3 text-sm badge-danger" style={{ display: 'block', borderRadius: '12px' }}>
          <strong>Warning:</strong> This plan has {plan.robBreaches} ROB breach{plan.robBreaches !== 1 ? 'es' : ''} where oil levels drop below minimum safe levels. Not recommended for use.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-slate-800">Plan #{plan.rank}</span>
          <StrategyBadge strategy={plan.strategy} />
          <span className="text-sm text-slate-400">{plan.strategyLabel}</span>
        </div>
        <Button onClick={() => onSave(plan)} disabled={saving || !plan.safe} variant="outline" size="sm">
          {saving ? 'Saving...' : !plan.safe ? 'Unsafe Plan' : 'Save This Plan'}
        </Button>
      </div>

      <SavingsSummary result={plan.output} />

      <div className="soft-card">
        <h3 className="section-label mb-3">Purchase Plan</h3>
        <PurchasePlanTable ports={plan.output.ports} oilGrades={oilGrades} />
      </div>

      <div className="soft-card">
        <h3 className="section-label mb-3">ROB Projection</h3>
        <ROBProjectionChart ports={plan.output.ports} oilGrades={oilGrades} />
      </div>

      <div className="soft-card">
        <h3 className="section-label mb-3">Price Comparison</h3>
        <PriceComparisonChart ports={plan.output.ports} />
      </div>
    </div>
  );
}
