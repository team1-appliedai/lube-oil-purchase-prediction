'use client';

import { use, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SavingsSummary } from '@/components/optimizer/savings-summary';
import { PurchasePlanTable } from '@/components/optimizer/purchase-plan-table';
import { ROBProjectionChart } from '@/components/optimizer/rob-projection-chart';
import { PriceComparisonChart } from '@/components/optimizer/price-comparison-chart';
import { RankedPlansTable } from '@/components/optimizer/ranked-plans-table';
import type { OptimizerOutput, OilGradeConfig, SmartOptimizerResult, RankedPlan, StrategyName } from '@/lib/optimizer/types';

interface PageProps {
  params: Promise<{ vesselId: string }>;
}

const ALL_STRATEGIES: { value: StrategyName; label: string }[] = [
  { value: 'grid', label: 'Grid Search' },
  { value: 'cheapest-port', label: 'Cheapest Port' },
  { value: 'delivery-aware', label: 'Delivery-Aware' },
  { value: 'consolidated', label: 'Consolidated' },
];

export default function OptimizePage({ params }: PageProps) {
  const { vesselId } = use(params);

  // Standard mode state
  const [windowSize, setWindowSize] = useState(5);
  const [safetyBufferPct, setSafetyBufferPct] = useState(10);
  const [targetFillPct, setTargetFillPct] = useState(70);
  const [opportunityDiscountPct, setOpportunityDiscountPct] = useState(10);
  const [robTriggerMultiplier, setRobTriggerMultiplier] = useState(1.2);
  const [deliveryChargeDefault, setDeliveryChargeDefault] = useState(500);
  const [result, setResult] = useState<OptimizerOutput | null>(null);
  const [oilGrades, setOilGrades] = useState<OilGradeConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Smart mode state
  const [smartResult, setSmartResult] = useState<SmartOptimizerResult | null>(null);
  const [smartOilGrades, setSmartOilGrades] = useState<OilGradeConfig[]>([]);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [smartDeliveryCharge, setSmartDeliveryCharge] = useState(500);
  const [enabledStrategies, setEnabledStrategies] = useState<StrategyName[]>([
    'grid', 'cheapest-port', 'delivery-aware', 'consolidated',
  ]);

  async function runOptimizer() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/optimizer/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vesselId,
          windowSize,
          safetyBufferPct,
          targetFillPct,
          opportunityDiscountPct,
          robTriggerMultiplier,
          deliveryChargeDefault,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data.result);
      setOilGrades(data.oilGrades ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function runSmartOptimizer() {
    setSmartLoading(true);
    setSmartError(null);
    setSmartResult(null);

    try {
      const res = await fetch('/api/optimizer/smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vesselId,
          deliveryChargeDefault: smartDeliveryCharge,
          strategies: enabledStrategies,
          topN: 5,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setSmartResult(data.result);
      setSmartOilGrades(data.oilGrades ?? []);
    } catch (err) {
      setSmartError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setSmartLoading(false);
    }
  }

  async function savePlan(output?: OptimizerOutput) {
    const planOutput = output ?? result;
    if (!planOutput) return;
    setSaving(true);

    try {
      const res = await fetch('/api/optimizer/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vesselId,
          vesselName: planOutput.vesselName,
          optimizerOutput: planOutput,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Save failed (${res.status})`);
      }
    } catch (err) {
      const setErr = output ? setSmartError : setError;
      setErr(err instanceof Error ? err.message : 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  }

  function handleSmartSave(plan: RankedPlan) {
    savePlan(plan.output);
  }

  function toggleStrategy(strategy: StrategyName) {
    setEnabledStrategies((prev) => {
      if (prev.includes(strategy)) {
        if (prev.length <= 1) return prev; // must keep at least 1
        return prev.filter((s) => s !== strategy);
      }
      return [...prev, strategy];
    });
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Optimizer</h1>
          <p className="text-muted-foreground">
            Vessel: {vesselId}
          </p>
        </div>
        {result && (
          <Button onClick={() => savePlan()} disabled={saving} variant="outline">
            {saving ? 'Saving...' : 'Save Plan'}
          </Button>
        )}
      </div>

      <Tabs defaultValue="standard">
        <TabsList>
          <TabsTrigger value="standard">Standard</TabsTrigger>
          <TabsTrigger value="smart">Smart</TabsTrigger>
        </TabsList>

        {/* ==================== STANDARD TAB ==================== */}
        <TabsContent value="standard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Optimizer Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Look-ahead Window</label>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {windowSize} ports
                    </span>
                  </div>
                  <Slider
                    value={[windowSize]}
                    onValueChange={(v) => setWindowSize(v[0])}
                    min={3}
                    max={10}
                    step={1}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Safety Buffer</label>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {safetyBufferPct}%
                    </span>
                  </div>
                  <Slider
                    value={[safetyBufferPct]}
                    onValueChange={(v) => setSafetyBufferPct(v[0])}
                    min={0}
                    max={25}
                    step={1}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Target Fill</label>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {targetFillPct}%
                    </span>
                  </div>
                  <Slider
                    value={[targetFillPct]}
                    onValueChange={(v) => setTargetFillPct(v[0])}
                    min={50}
                    max={90}
                    step={1}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Opportunity Discount</label>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {opportunityDiscountPct}%
                    </span>
                  </div>
                  <Slider
                    value={[opportunityDiscountPct]}
                    onValueChange={(v) => setOpportunityDiscountPct(v[0])}
                    min={5}
                    max={25}
                    step={1}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">ROB Trigger</label>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {robTriggerMultiplier.toFixed(1)}x
                    </span>
                  </div>
                  <Slider
                    value={[robTriggerMultiplier * 10]}
                    onValueChange={(v) => setRobTriggerMultiplier(v[0] / 10)}
                    min={10}
                    max={20}
                    step={1}
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="delivery-charge" className="text-sm font-medium">
                    Delivery Charge (USD)
                  </Label>
                  <Input
                    id="delivery-charge"
                    type="number"
                    value={deliveryChargeDefault}
                    onChange={(e) => setDeliveryChargeDefault(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
              </div>
              <Button onClick={runOptimizer} disabled={loading}>
                {loading ? 'Running...' : 'Run Optimizer'}
              </Button>
            </CardContent>
          </Card>

          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {loading && <LoadingSkeleton />}

          {result && !loading && (
            <div className="space-y-6">
              <SavingsSummary result={result} />
              <Card>
                <CardHeader>
                  <CardTitle>Purchase Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <PurchasePlanTable ports={result.ports} oilGrades={oilGrades} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>ROB Projection</CardTitle>
                </CardHeader>
                <CardContent>
                  <ROBProjectionChart ports={result.ports} oilGrades={oilGrades} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Price Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <PriceComparisonChart ports={result.ports} />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ==================== SMART TAB ==================== */}
        <TabsContent value="smart" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Smart Multi-Strategy Optimizer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Runs multiple optimization strategies in parallel and ranks results by total cost.
                Evaluates 360+ parameter combinations plus 3 specialized algorithms.
              </p>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="smart-delivery-charge" className="text-sm font-medium">
                    Delivery Charge (USD)
                  </Label>
                  <Input
                    id="smart-delivery-charge"
                    type="number"
                    value={smartDeliveryCharge}
                    onChange={(e) => setSmartDeliveryCharge(Number(e.target.value))}
                    className="h-9"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">Strategies</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_STRATEGIES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => toggleStrategy(s.value)}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                          enabledStrategies.includes(s.value)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Button onClick={runSmartOptimizer} disabled={smartLoading}>
                {smartLoading ? 'Running...' : 'Run Smart Optimizer'}
              </Button>
            </CardContent>
          </Card>

          {smartError && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-sm text-destructive">{smartError}</p>
              </CardContent>
            </Card>
          )}

          {smartLoading && <LoadingSkeleton />}

          {smartResult && !smartLoading && (
            <Card>
              <CardHeader>
                <CardTitle>Ranked Plans</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedPlansTable
                  result={smartResult}
                  oilGrades={smartOilGrades}
                  onSavePlan={handleSmartSave}
                  saving={saving}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <div className="mt-2 space-y-1">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-28" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
