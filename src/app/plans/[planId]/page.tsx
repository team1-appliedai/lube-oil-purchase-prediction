'use client';

import { use, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { PurchasePlan } from '@/lib/optimizer/types';
import { formatUSD, formatDate } from '@/lib/utils/format';

export default function PlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = use(params);
  const [plan, setPlan] = useState<PurchasePlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/optimizer/plans?planId=${planId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPlan(data[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [planId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Plan not found</p>
        <Link href="/plans">
          <Button variant="outline" className="mt-4">
            Back to Plans
          </Button>
        </Link>
      </div>
    );
  }

  const output = plan.optimizerOutput;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/plans">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">{plan.vesselName} — Purchase Plan</h2>
          <p className="text-sm text-muted-foreground">
            Created {plan.createdAt ? formatDate(String(plan.createdAt)) : '—'}
          </p>
        </div>
        <Badge
          variant="outline"
          className="ml-auto"
        >
          {plan.status.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Optimized Cost</p>
            <p className="text-xl font-bold text-primary">{formatUSD(output.totalCost.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Baseline Cost</p>
            <p className="text-xl font-bold">{formatUSD(output.baselineCost?.total ?? (output as any).naiveCost?.total ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Savings</p>
            <p className="text-xl font-bold text-maritime-green">{formatUSD(output.savings.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Savings %</p>
            <p className="text-xl font-bold text-maritime-green">{output.savings.pct.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Port-by-Port Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Port</th>
                  <th className="text-left py-2 px-3">Country</th>
                  <th className="text-right py-2 px-3">Cyl Action</th>
                  <th className="text-right py-2 px-3">Cyl Qty (L)</th>
                  <th className="text-right py-2 px-3">Cyl Cost</th>
                  <th className="text-right py-2 px-3">ME Action</th>
                  <th className="text-right py-2 px-3">ME Qty (L)</th>
                  <th className="text-right py-2 px-3">ME Cost</th>
                  <th className="text-right py-2 px-3">AE Action</th>
                  <th className="text-right py-2 px-3">AE Qty (L)</th>
                  <th className="text-right py-2 px-3">AE Cost</th>
                </tr>
              </thead>
              <tbody>
                {output.ports.map((port, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-2 px-3 font-medium">{port.portName}</td>
                    <td className="py-2 px-3">{port.country}</td>
                    <td className="py-2 px-3 text-right">{port.actions.cylinderOil.action}</td>
                    <td className="py-2 px-3 text-right">{Math.round(port.actions.cylinderOil.quantity).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">{formatUSD(port.actions.cylinderOil.cost)}</td>
                    <td className="py-2 px-3 text-right">{port.actions.meSystemOil.action}</td>
                    <td className="py-2 px-3 text-right">{Math.round(port.actions.meSystemOil.quantity).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">{formatUSD(port.actions.meSystemOil.cost)}</td>
                    <td className="py-2 px-3 text-right">{port.actions.aeSystemOil.action}</td>
                    <td className="py-2 px-3 text-right">{Math.round(port.actions.aeSystemOil.quantity).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">{formatUSD(port.actions.aeSystemOil.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {plan.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{plan.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
