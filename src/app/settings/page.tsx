'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, RotateCcw } from 'lucide-react';

interface Config {
  tankCapacityCylinder: number;
  tankCapacityMeSystem: number;
  tankCapacityAeSystem: number;
  tankMaxFillPct: number;
  minRobMeSystem: number;
  minRobAeSystem: number;
  cylinderMinRobDays: number;
  windowSize: number;
  safetyBufferPct: number;
  priceMtToLDivisor: number;
  deliveryChargeDefault: number;
  minOrderQtyMeSystem: number;
  minOrderQtyAeSystem: number;
  targetFillPct: number;
  robTriggerMultiplier: number;
  opportunityDiscountPct: number;
}

const defaultConfig: Config = {
  tankCapacityCylinder: 100000,
  tankCapacityMeSystem: 95000,
  tankCapacityAeSystem: 20000,
  tankMaxFillPct: 85,
  minRobMeSystem: 30000,
  minRobAeSystem: 5000,
  cylinderMinRobDays: 60,
  windowSize: 5,
  safetyBufferPct: 10,
  priceMtToLDivisor: 1111,
  deliveryChargeDefault: 500,
  minOrderQtyMeSystem: 10000,
  minOrderQtyAeSystem: 10000,
  targetFillPct: 70,
  robTriggerMultiplier: 1.2,
  opportunityDiscountPct: 10,
};

export default function SettingsPage() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setConfig({ ...defaultConfig, ...data }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(defaultConfig);
  };

  const updateField = (field: keyof Config, value: number) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
        <p className="text-sm text-slate-400">
          Configure tank capacities, minimum ROB values, and optimizer parameters
        </p>
      </div>

      {/* Tank Capacities */}
      <div className="soft-card">
        <h3 className="section-label mb-4">Tank Capacities (Liters)</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cyl-capacity" className="text-slate-600">Cylinder Oil</Label>
              <Input
                id="cyl-capacity"
                type="number"
                value={config.tankCapacityCylinder}
                onChange={(e) => updateField('tankCapacityCylinder', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="me-capacity" className="text-slate-600">ME System Oil</Label>
              <Input
                id="me-capacity"
                type="number"
                value={config.tankCapacityMeSystem}
                onChange={(e) => updateField('tankCapacityMeSystem', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ae-capacity" className="text-slate-600">AE System Oil</Label>
              <Input
                id="ae-capacity"
                type="number"
                value={config.tankCapacityAeSystem}
                onChange={(e) => updateField('tankCapacityAeSystem', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600">
              Max Fill: {config.tankMaxFillPct}%
            </Label>
            <Slider
              value={[config.tankMaxFillPct]}
              onValueChange={([v]) => updateField('tankMaxFillPct', v)}
              min={50}
              max={100}
              step={5}
            />
          </div>
        </div>
      </div>

      {/* Minimum ROB */}
      <div className="soft-card">
        <h3 className="section-label mb-4">Minimum ROB</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="me-min-rob" className="text-slate-600">ME System Oil (L, fixed)</Label>
              <Input
                id="me-min-rob"
                type="number"
                value={config.minRobMeSystem}
                onChange={(e) => updateField('minRobMeSystem', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ae-min-rob" className="text-slate-600">AE System Oil (L, fixed)</Label>
              <Input
                id="ae-min-rob"
                type="number"
                value={config.minRobAeSystem}
                onChange={(e) => updateField('minRobAeSystem', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cyl-days" className="text-slate-600">
              Cylinder Oil Min ROB Days (avg daily consumption x days)
            </Label>
            <Input
              id="cyl-days"
              type="number"
              value={config.cylinderMinRobDays}
              onChange={(e) => updateField('cylinderMinRobDays', Number(e.target.value))}
            />
            <p className="caption">
              Min ROB = last 6 months avg daily consumption x {config.cylinderMinRobDays} days
            </p>
          </div>
        </div>
      </div>

      {/* Optimizer Parameters */}
      <div className="soft-card">
        <h3 className="section-label mb-4">Optimizer Parameters</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-600">
              Window Size: {config.windowSize} ports
            </Label>
            <Slider
              value={[config.windowSize]}
              onValueChange={([v]) => updateField('windowSize', v)}
              min={3}
              max={10}
              step={1}
            />
            <p className="caption">
              How many ports to look ahead for price comparison
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600">
              Safety Buffer: {config.safetyBufferPct}%
            </Label>
            <Slider
              value={[config.safetyBufferPct]}
              onValueChange={([v]) => updateField('safetyBufferPct', v)}
              min={0}
              max={25}
              step={1}
            />
            <p className="caption">
              Extra consumption buffer added to forecasts
            </p>
          </div>

          <div className="border-t border-slate-200/50 my-2" />

          <div className="space-y-2">
            <Label htmlFor="divisor" className="text-slate-600">Price Conversion Divisor (USD/MT to USD/L)</Label>
            <Input
              id="divisor"
              type="number"
              value={config.priceMtToLDivisor}
              onChange={(e) => updateField('priceMtToLDivisor', Number(e.target.value))}
            />
            <p className="caption">
              USD/L = USD/MT / {config.priceMtToLDivisor}
            </p>
          </div>
        </div>
      </div>

      {/* Delivery Charges */}
      <div className="soft-card">
        <h3 className="section-label mb-4">Delivery Charges</h3>
        <div className="space-y-2">
          <Label htmlFor="delivery-charge" className="text-slate-600">Default Charge (USD per bunkering event)</Label>
          <Input
            id="delivery-charge"
            type="number"
            value={config.deliveryChargeDefault}
            onChange={(e) => updateField('deliveryChargeDefault', Number(e.target.value))}
          />
          <p className="caption">
            Fixed cost charged per delivery, regardless of volume ordered
          </p>
        </div>
      </div>

      {/* Minimum Order Quantities */}
      <div className="soft-card">
        <h3 className="section-label mb-4">Minimum Order Quantities</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-order-me" className="text-slate-600">ME System Oil (L)</Label>
              <Input
                id="min-order-me"
                type="number"
                value={config.minOrderQtyMeSystem}
                onChange={(e) => updateField('minOrderQtyMeSystem', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min-order-ae" className="text-slate-600">AE System Oil (L)</Label>
              <Input
                id="min-order-ae"
                type="number"
                value={config.minOrderQtyAeSystem}
                onChange={(e) => updateField('minOrderQtyAeSystem', Number(e.target.value))}
              />
            </div>
          </div>
          <p className="caption">
            Cylinder Oil: No minimum (consumed continuously)
          </p>
        </div>
      </div>

      {/* Reorder Triggers */}
      <div className="soft-card">
        <h3 className="section-label mb-4">Reorder Triggers</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-600">
              Target Fill: {config.targetFillPct}%
            </Label>
            <Slider
              value={[config.targetFillPct]}
              onValueChange={([v]) => updateField('targetFillPct', v)}
              min={50}
              max={90}
              step={1}
            />
            <p className="caption">
              When ordering, fill tank to this percentage of capacity
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600">
              ROB Trigger Multiplier: {config.robTriggerMultiplier.toFixed(1)}x
            </Label>
            <Slider
              value={[config.robTriggerMultiplier * 10]}
              onValueChange={([v]) => updateField('robTriggerMultiplier', v / 10)}
              min={10}
              max={20}
              step={1}
            />
            <p className="caption">
              Order urgently when ROB drops below {config.robTriggerMultiplier.toFixed(1)}x minimum ROB
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600">
              Opportunity Discount: {config.opportunityDiscountPct}%
            </Label>
            <Slider
              value={[config.opportunityDiscountPct]}
              onValueChange={([v]) => updateField('opportunityDiscountPct', v)}
              min={5}
              max={25}
              step={1}
            />
            <p className="caption">
              Buy opportunistically when price is {config.opportunityDiscountPct}%+ below route average
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        {saved && (
          <span className="text-sm text-emerald-600">Settings saved</span>
        )}
      </div>
    </div>
  );
}
