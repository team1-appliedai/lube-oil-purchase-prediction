'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {result.combinationsEvaluated} combinations evaluated in {result.elapsedMs}ms
        </span>
        <span>
          Baseline: {formatUSD(result.baseline.cost)} ({result.baseline.purchaseEvents} events)
        </span>
      </div>

      {/* Ranked plans */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-center font-medium">Safety</th>
              <th className="px-3 py-2 text-left font-medium">Strategy</th>
              <th className="px-3 py-2 text-right font-medium">All-In Cost</th>
              <th className="px-3 py-2 text-right font-medium">Savings</th>
              <th className="px-3 py-2 text-right font-medium">Savings %</th>
              <th className="px-3 py-2 text-right font-medium">Events</th>
              <th className="px-3 py-2 text-right font-medium">Delivery</th>
              <th className="px-3 py-2 text-center font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {result.plans.map((plan) => {
              const isExpanded = expandedRank === plan.rank;
              const hasSavings = plan.savings > 0;

              return (
                <tr
                  key={plan.rank}
                  className={`border-b transition-colors ${
                    isExpanded ? 'bg-accent/50' : 'hover:bg-muted/30'
                  } ${!plan.safe ? 'bg-red-50/50 opacity-60' : plan.rank === 1 ? 'bg-green-50/50' : ''}`}
                >
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">
                    {plan.rank}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {plan.safe ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Safe
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700" title={`${plan.robBreaches} ROB breach${plan.robBreaches !== 1 ? 'es' : ''}`}>
                        Unsafe
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <StrategyBadge strategy={plan.strategy} />
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {plan.strategy === 'grid' ? plan.strategyLabel.replace('Grid: ', '') : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-medium">
                    {formatUSD(plan.allInCost)}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono font-medium ${
                    hasSavings ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {hasSavings ? '+' : ''}{formatUSD(plan.savings)}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono ${
                    hasSavings ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPct(plan.savingsPct)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {plan.output.purchaseEvents}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
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
    <div className="space-y-6 rounded-lg border bg-background p-4">
      {!plan.safe && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Warning:</strong> This plan has {plan.robBreaches} ROB breach{plan.robBreaches !== 1 ? 'es' : ''} where oil levels drop below minimum safe levels. Not recommended for use.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">Plan #{plan.rank}</span>
          <StrategyBadge strategy={plan.strategy} />
          <span className="text-sm text-muted-foreground">{plan.strategyLabel}</span>
        </div>
        <Button onClick={() => onSave(plan)} disabled={saving || !plan.safe} variant="outline" size="sm">
          {saving ? 'Saving...' : !plan.safe ? 'Unsafe Plan' : 'Save This Plan'}
        </Button>
      </div>

      <SavingsSummary result={plan.output} />

      <Card>
        <CardHeader>
          <CardTitle>Purchase Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchasePlanTable ports={plan.output.ports} oilGrades={oilGrades} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ROB Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <ROBProjectionChart ports={plan.output.ports} oilGrades={oilGrades} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <PriceComparisonChart ports={plan.output.ports} />
        </CardContent>
      </Card>
    </div>
  );
}
