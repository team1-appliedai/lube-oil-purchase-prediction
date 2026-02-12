'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Ship, ArrowLeft, BarChart3, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
          <Card>
            <CardContent className="space-y-3 pt-6">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!vessel) {
    return (
      <div className="space-y-4">
        <Link href="/vessels" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to vessels
        </Link>
        <p className="text-muted-foreground">Vessel not found.</p>
      </div>
    );
  }

  // Consumption is sorted ascending by date — latest is the last element
  // But date format isn't ISO, so also sort by parsing Date to be safe
  const sortedConsumption = [...consumption].sort(
    (a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime()
  );
  const latest = sortedConsumption.length > 0 ? sortedConsumption[0] : null;

  // Compute average daily consumption from records with non-zero values
  const avgConsumption = (() => {
    const records = consumption.filter((r) => r.cylinderOilConsumption > 0 || r.meSystemOilConsumption > 0 || r.aeSystemOilConsumption > 0);
    if (records.length === 0) return null;
    const cyl = records.reduce((sum, r) => sum + r.cylinderOilConsumption, 0) / records.length;
    const me = records.reduce((sum, r) => sum + r.meSystemOilConsumption, 0) / records.length;
    const ae = records.reduce((sum, r) => sum + r.aeSystemOilConsumption, 0) / records.length;
    return { cylinderOil: cyl, meSystemOil: me, aeSystemOil: ae, recordCount: records.length };
  })();

  // Filter schedule to future ports only
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
        <Link href="/vessels" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold">{vessel.vesselName}</h1>
        <Badge
          variant={vessel.isActive ? 'default' : 'secondary'}
          className={vessel.isActive ? 'bg-green-600' : 'bg-gray-400'}
        >
          {vessel.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Vessel Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Ship className="h-5 w-5 text-primary" />
              <CardTitle>Vessel Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vessel Code</span>
                <span className="font-medium">{vessel.vesselCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{vessel.vesselType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fleet</span>
                <span className="font-medium">{vessel.fleet}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier</span>
                <span className="font-medium">{vessel.lubeSupplier}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tank Status */}
        <Card>
          <CardHeader>
            <CardTitle>Tank Status (Latest ROB)</CardTitle>
          </CardHeader>
          <CardContent>
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
                <p className="text-xs text-muted-foreground">
                  As of {formatDate(latest.reportDate)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No consumption data available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Average Consumption */}
      {avgConsumption && (
        <Card>
          <CardHeader>
            <CardTitle>Average Daily Consumption</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cylinder Oil</p>
                <p className="text-2xl font-bold text-blue-500">{avgConsumption.cylinderOil.toFixed(0)} L/day</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">ME System Oil</p>
                <p className="text-2xl font-bold text-emerald-500">{avgConsumption.meSystemOil.toFixed(0)} L/day</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">AE System Oil</p>
                <p className="text-2xl font-bold text-amber-500">{avgConsumption.aeSystemOil.toFixed(0)} L/day</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Based on {avgConsumption.recordCount} noon reports
            </p>
          </CardContent>
        </Card>
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

      {/* Voyage Schedule (future ports only) */}
      {futureSchedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Schedule ({futureSchedule.length} ports)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {futureSchedule.map((port, idx) => (
                <div
                  key={`${port.portCode}-${idx}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      {port.portName}{' '}
                      {port.isCurrentPort && (
                        <Badge variant="outline" className="ml-1 text-xs">
                          Current
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {port.country} &middot; {port.portCode}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {port.arrivalDate && <p>Arr: {formatDate(port.arrivalDate)}</p>}
                    {port.departureDate && <p>Dep: {formatDate(port.departureDate)}</p>}
                    <p className="font-medium text-foreground">Voy {port.voyageNo}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
