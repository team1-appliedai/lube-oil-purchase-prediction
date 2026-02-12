'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Optimized Cost
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatUSD(optimizedTotal)}</p>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <p>Cylinder: {formatUSD(totalCost.cylinderOil)}</p>
            <p>ME System: {formatUSD(totalCost.meSystemOil)}</p>
            <p>AE System: {formatUSD(totalCost.aeSystemOil)}</p>
            <p className="pt-0.5 border-t mt-1">
              incl. {formatUSD(totalDeliveryCharges)} delivery ({purchaseEvents} events)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Baseline Cost
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-muted-foreground">
            {formatUSD(baselineTotal)}
          </p>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <p>Cylinder: {formatUSD(baselineCost.cylinderOil)}</p>
            <p>ME System: {formatUSD(baselineCost.meSystemOil)}</p>
            <p>AE System: {formatUSD(baselineCost.aeSystemOil)}</p>
            <p className="pt-0.5 border-t mt-1">
              incl. {formatUSD(result.baselineDeliveryCharges)} delivery ({result.baselinePurchaseEvents} events)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Savings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${hasSavings ? 'text-green-600' : ''}`}>
            {formatUSD(savings.total)}
          </p>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <p>Cylinder: {formatUSD(savings.cylinderOil)}</p>
            <p>ME System: {formatUSD(savings.meSystemOil)}</p>
            <p>AE System: {formatUSD(savings.aeSystemOil)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Savings Percentage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${hasSavings ? 'text-green-600' : ''}`}>
            {formatPct(savings.pct)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            vs. reactive procurement
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
