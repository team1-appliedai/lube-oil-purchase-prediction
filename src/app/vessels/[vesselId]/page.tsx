'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Ship, ArrowLeft, BarChart3, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TankStatusBar } from '@/components/common/tank-status-bar';
import { formatDate } from '@/lib/utils/format';
import type { Vessel, ConsumptionRecord, SchedulePort } from '@/lib/optimizer/types';

const TANK_DEFAULTS = {
  cylinder: { capacity: 100_000, minRob: 20_000 },
  me: { capacity: 95_000, minRob: 30_000 },
  ae: { capacity: 20_000, minRob: 5_000 },
};

export default function VesselDetailPage({
  params,
}: {
  params: Promise<{ vesselId: string }>;
}) {
  const { vesselId } = use(params);
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [consumption, setConsumption] = useState<ConsumptionRecord[]>([]);
  const [schedule, setSchedule] = useState<SchedulePort[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/vessels/${vesselId}`).then((r) => r.json()),
      fetch(`/api/consumption/${vesselId}`).then((r) => r.json()),
      fetch(`/api/voyages/${vesselId}`).then((r) => r.json()),
    ])
      .then(([vesselData, consumptionData, scheduleData]) => {
        setVessel(vesselData);
        setConsumption(Array.isArray(consumptionData) ? consumptionData : []);
        setSchedule(Array.isArray(scheduleData) ? scheduleData : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [vesselId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="soft-card space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="soft-card space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!vessel) {
    return (
      <div className="space-y-4">
        <Link href="/vessels" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to vessels
        </Link>
        <p className="text-slate-400">Vessel not found.</p>
      </div>
    );
  }

  const sortedConsumption = [...consumption].sort(
    (a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime()
  );
  const latest = sortedConsumption.length > 0 ? sortedConsumption[0] : null;

  const avgConsumption = (() => {
    const records = consumption.filter((r) => r.cylinderOilConsumption > 0 || r.meSystemOilConsumption > 0 || r.aeSystemOilConsumption > 0);
    if (records.length === 0) return null;
    const cyl = records.reduce((sum, r) => sum + r.cylinderOilConsumption, 0) / records.length;
    const me = records.reduce((sum, r) => sum + r.meSystemOilConsumption, 0) / records.length;
    const ae = records.reduce((sum, r) => sum + r.aeSystemOilConsumption, 0) / records.length;
    return { cylinderOil: cyl, meSystemOil: me, aeSystemOil: ae, recordCount: records.length };
  })();

  const now = new Date();
  const futureSchedule = schedule.filter((sp) => {
    if (sp.arrivalDate) {
      const arr = new Date(sp.arrivalDate);
      if (!isNaN(arr.getTime()) && arr >= now) return true;
    }
    if (sp.departureDate) {
      const dep = new Date(sp.departureDate);
      if (!isNaN(dep.getTime()) && dep >= now) return true;
    }
    return false;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/vessels" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">{vessel.vesselName}</h1>
        <span className={vessel.isActive ? 'badge-success' : 'badge-neutral'}>
          {vessel.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Vessel Info */}
        <div className="soft-card">
          <div className="flex items-center gap-2 mb-4">
            <Ship className="h-5 w-5 text-mw-purple" />
            <h2 className="section-label">Vessel Information</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Vessel Code</span>
              <span className="font-medium text-slate-700">{vessel.vesselCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Type</span>
              <span className="font-medium text-slate-700">{vessel.vesselType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fleet</span>
              <span className="font-medium text-slate-700">{vessel.fleet}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Supplier</span>
              <span className="font-medium text-slate-700">{vessel.lubeSupplier}</span>
            </div>
          </div>
        </div>

        {/* Tank Status */}
        <div className="soft-card">
          <h2 className="section-label mb-4">Tank Status (Latest ROB)</h2>
          {latest ? (
            <div className="space-y-4">
              <TankStatusBar
                label="Cylinder Oil"
                current={latest.cylinderOilRob}
                capacity={TANK_DEFAULTS.cylinder.capacity}
                minRob={TANK_DEFAULTS.cylinder.minRob}
              />
              <TankStatusBar
                label="ME System Oil"
                current={latest.meSystemOilRob}
                capacity={TANK_DEFAULTS.me.capacity}
                minRob={TANK_DEFAULTS.me.minRob}
              />
              <TankStatusBar
                label="AE System Oil"
                current={latest.aeSystemOilRob}
                capacity={TANK_DEFAULTS.ae.capacity}
                minRob={TANK_DEFAULTS.ae.minRob}
              />
              <p className="caption">
                As of {formatDate(latest.reportDate)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No consumption data available.</p>
          )}
        </div>
      </div>

      {/* Average Consumption */}
      {avgConsumption && (
        <div className="soft-card">
          <h2 className="section-label mb-4">Average Daily Consumption</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="caption">Cylinder Oil</p>
              <p className="text-2xl font-bold text-mw-purple">{avgConsumption.cylinderOil.toFixed(0)} L/day</p>
            </div>
            <div className="space-y-1">
              <p className="caption">ME System Oil</p>
              <p className="text-2xl font-bold text-emerald-500">{avgConsumption.meSystemOil.toFixed(0)} L/day</p>
            </div>
            <div className="space-y-1">
              <p className="caption">AE System Oil</p>
              <p className="text-2xl font-bold text-amber-500">{avgConsumption.aeSystemOil.toFixed(0)} L/day</p>
            </div>
          </div>
          <p className="mt-3 caption">
            Based on {avgConsumption.recordCount} noon reports
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Link href={`/vessels/${vesselId}/optimize`}>
          <Button>
            <Settings className="h-4 w-4" />
            Run Optimizer
          </Button>
        </Link>
        <Link href={`/vessels/${vesselId}/consumption`}>
          <Button variant="outline">
            <BarChart3 className="h-4 w-4" />
            View Consumption
          </Button>
        </Link>
      </div>

      {/* Voyage Schedule */}
      {futureSchedule.length > 0 && (
        <div className="soft-card">
          <h2 className="section-label mb-4">Upcoming Schedule ({futureSchedule.length} ports)</h2>
          <div className="space-y-2">
            {futureSchedule.map((port, idx) => (
              <div
                key={`${port.portCode}-${idx}`}
                className="flex items-center justify-between rounded-xl p-3 text-sm"
                style={{ border: '1px solid rgba(148, 163, 184, 0.1)' }}
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-slate-700">
                    {port.portName}{' '}
                    {port.isCurrentPort && (
                      <span className="badge-info ml-1">Current</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    {port.country} &middot; {port.portCode}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  {port.arrivalDate && <p>Arr: {formatDate(port.arrivalDate)}</p>}
                  {port.departureDate && <p>Dep: {formatDate(port.departureDate)}</p>}
                  <p className="font-medium text-slate-700">Voy {port.voyageNo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
