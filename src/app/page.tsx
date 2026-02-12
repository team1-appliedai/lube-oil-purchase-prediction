'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ship, AlertTriangle, CheckCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/common/stat-card';
import type { Vessel } from '@/lib/optimizer/types';

export default function DashboardPage() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/vessels')
      .then((res) => res.json())
      .then((data) => {
        setVessels(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeVessels = vessels.filter((v) => v.isActive);
  const attentionCount = 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="soft-card">
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
        <div className="soft-card">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Total Vessels"
          value={String(vessels.length)}
          icon={Ship}
        />
        <StatCard
          title="Active Vessels"
          value={String(activeVessels.length)}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Needs Attention"
          value={String(attentionCount)}
          icon={AlertTriangle}
          variant={attentionCount > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Fleet Overview */}
      <div className="soft-card">
        <h2 className="section-label mb-4">Fleet Overview</h2>
        {vessels.length > 0 ? (
          <div className="space-y-2">
            {vessels.map((vessel) => (
              <Link
                key={vessel.vesselId}
                href={`/vessels/${vessel.vesselId}`}
                className="flex items-center justify-between rounded-xl p-3 text-sm transition-all hover:bg-white/50"
                style={{ border: '1px solid rgba(148, 163, 184, 0.1)' }}
              >
                <div className="flex items-center gap-3">
                  <Ship className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-700">{vessel.vesselName}</p>
                    <p className="text-xs text-slate-400">
                      {vessel.vesselType} &middot; {vessel.lubeSupplier}
                    </p>
                  </div>
                </div>
                <span className={vessel.isActive ? 'badge-success' : 'badge-neutral'}>
                  {vessel.isActive ? 'Active' : 'Inactive'}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No vessels found.</p>
        )}
      </div>

      {/* Quick Links */}
      <div className="soft-card">
        <h2 className="section-label mb-4">Quick Links</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/vessels"
            className="chip-active"
          >
            All Vessels
          </Link>
          <Link
            href="/config"
            className="chip-inactive"
          >
            Configuration
          </Link>
        </div>
      </div>
    </div>
  );
}
