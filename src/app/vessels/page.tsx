'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ship } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Vessel } from '@/lib/optimizer/types';

export default function VesselsPage() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/vessels')
      .then((res) => res.json())
      .then((data) => {
        setVessels(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Vessels</h1>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="soft-card">
              <Skeleton className="h-5 w-40 mb-3" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Vessels</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vessels.map((vessel) => (
          <Link key={vessel.vesselId} href={`/vessels/${vessel.vesselId}`}>
            <div className="soft-card-hover">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Ship className="h-5 w-5 text-mw-purple" />
                  <span className="font-semibold text-slate-700">{vessel.vesselName}</span>
                </div>
                <span className={vessel.isActive ? 'badge-success' : 'badge-neutral'}>
                  {vessel.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="text-slate-400">
                  <span className="font-medium text-slate-600">Code:</span>{' '}
                  {vessel.vesselCode}
                </p>
                <p className="text-slate-400">
                  <span className="font-medium text-slate-600">Type:</span>{' '}
                  {vessel.vesselType}
                </p>
                <p className="text-slate-400">
                  <span className="font-medium text-slate-600">Fleet:</span>{' '}
                  {vessel.fleet}
                </p>
                <p className="text-slate-400">
                  <span className="font-medium text-slate-600">Supplier:</span>{' '}
                  {vessel.lubeSupplier}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
