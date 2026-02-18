'use client';

import { use, useState } from 'react';
import { Button } from '@/components/ui/button';
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

  const [windowSize, setWindowSize] = useState(5);
  const [safetyBufferPct, setSafetyBufferPct] = useState(10);
  const [targetFillPct, setTargetFillPct] = useState(70);
  const [opportunityDiscountPct, setOpportunityDiscountPct] = useState(10);
  const [robTriggerMultiplier, setRobTriggerMultiplier] = useState(1.2);
  const [deliveryChargeDefault, setDeliveryChargeDefault] = useState(1500);
  const [result, setResult] = useState<OptimizerOutput | null>(null);
  const [oilGrades, setOilGrades] = useState<OilGradeConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [smartResult, setSmartResult] = useState<SmartOptimizerResult | null>(null);
  const [smartOilGrades, setSmartOilGrades] = useState<OilGradeConfig[]>([]);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [smartDeliveryCharge, setSmartDeliveryCharge] = useState(1500);
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
        if (prev.length <= 1) return prev;
        return prev.filter((s) => s !== strategy);
      }
      return [...prev, strategy];
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Purchase Optimizer</h1>
          <p className="text-slate-400">
            Vessel: {vesselId}
          </p>
        </div>
        {result && (
          <Button onClick={() => savePlan()} disabled={saving} variant="outline">
            {saving ? 'Saving...' : 'Save Plan'}
          </Button>
        )}
      </div>

      <Tabs defaultValue="smart">
        <TabsList>
          <TabsTrigger value="smart">Smart</TabsTrigger>
          <TabsTrigger value="standard">Standard</TabsTrigger>
        </TabsList>

        {/* ==================== STANDARD TAB ==================== */}
        <TabsContent value="standard" className="space-y-6">
          <div className="soft-card">
            <h2 className="section-label mb-4">Optimizer Settings</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-600">Look-ahead Window</label>
                    <span className="text-sm tabular-nums text-slate-400">
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
                    <label className="text-sm font-medium text-slate-600">Safety Buffer</label>
                    <span className="text-sm tabular-nums text-slate-400">
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
                    <label className="text-sm font-medium text-slate-600">Target Fill</label>
                    <span className="text-sm tabular-nums text-slate-400">
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
                    <label className="text-sm font-medium text-slate-600">Opportunity Discount</label>
                    <span className="text-sm tabular-nums text-slate-400">
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
                    <label className="text-sm font-medium text-slate-600">ROB Trigger</label>
                    <span className="text-sm tabular-nums text-slate-400">
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
                  <Label htmlFor="delivery-charge" className="text-sm font-medium text-slate-600">
                    Fallback Delivery Charge (USD)
                  </Label>
                  <Input
                    id="delivery-charge"
                    type="number"
                    value={deliveryChargeDefault}
                    onChange={(e) => setDeliveryChargeDefault(Number(e.target.value))}
                    className="h-9"
                  />
                  <p className="text-[11px] text-slate-400">
                    Default value used when a port does not have delivery charges available
                  </p>
                </div>
              </div>
              <Button onClick={runOptimizer} disabled={loading}>
                {loading ? 'Running...' : 'Run Optimizer'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="soft-card" style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {loading && <LoadingSkeleton />}

          {result && !loading && (
            <div className="space-y-6">
              <SavingsSummary result={result} />
              <div className="soft-card">
                <h3 className="section-label mb-3">Purchase Plan</h3>
                <PurchasePlanTable ports={result.ports} oilGrades={oilGrades} />
              </div>
              <div className="soft-card">
                <h3 className="section-label mb-3">ROB Projection</h3>
                <ROBProjectionChart ports={result.ports} oilGrades={oilGrades} />
              </div>
              <div className="soft-card">
                <h3 className="section-label mb-3">Price Comparison</h3>
                <PriceComparisonChart ports={result.ports} />
              </div>
            </div>
          )}
        </TabsContent>

        {/* ==================== SMART TAB ==================== */}
        <TabsContent value="smart" className="space-y-6">
          <div className="soft-card">
            <h2 className="section-label mb-4">Smart Multi-Strategy Optimizer</h2>
            <div className="space-y-6">
              <p className="text-sm text-slate-400">
                Runs multiple optimization strategies in parallel and ranks results by total cost.
                Evaluates 360+ parameter combinations plus 3 specialized algorithms.
              </p>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="smart-delivery-charge" className="text-sm font-medium text-slate-600">
                    Fallback Delivery Charge (USD)
                  </Label>
                  <Input
                    id="smart-delivery-charge"
                    type="number"
                    value={smartDeliveryCharge}
                    onChange={(e) => setSmartDeliveryCharge(Number(e.target.value))}
                    className="h-9"
                  />
                  <p className="text-[11px] text-slate-400">
                    Default value used when a port does not have delivery charges available
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-600">Strategies</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_STRATEGIES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => toggleStrategy(s.value)}
                        className={
                          enabledStrategies.includes(s.value)
                            ? 'chip-active'
                            : 'chip-inactive'
                        }
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
            </div>
          </div>

          {smartError && (
            <div className="soft-card" style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <p className="text-sm text-red-600">{smartError}</p>
            </div>
          )}

          {smartLoading && <LoadingSkeleton />}

          {smartResult && !smartLoading && (
            <div className="soft-card">
              <h3 className="section-label mb-3">Ranked Plans</h3>
              <RankedPlansTable
                result={smartResult}
                oilGrades={smartOilGrades}
                onSavePlan={handleSmartSave}
                saving={saving}
              />
            </div>
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
          <div key={i} className="soft-card">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-32" />
            <div className="mt-2 space-y-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
      <div className="soft-card">
        <Skeleton className="h-[300px] w-full" />
      </div>
      <div className="soft-card">
        <Skeleton className="h-[400px] w-full" />
      </div>
    </div>
  );
}
