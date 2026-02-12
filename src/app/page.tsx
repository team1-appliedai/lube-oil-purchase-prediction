'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ship, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  const attentionCount = 0; // Placeholder for vessels needing attention

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

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
      <Card>
        <CardHeader>
          <CardTitle>Fleet Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {vessels.length > 0 ? (
            <div className="space-y-3">
              {vessels.map((vessel) => (
                <Link
                  key={vessel.vesselId}
                  href={`/vessels/${vessel.vesselId}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Ship className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{vessel.vesselName}</p>
                      <p className="text-xs text-muted-foreground">
                        {vessel.vesselType} &middot; {vessel.lubeSupplier}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={vessel.isActive ? 'default' : 'secondary'}
                    className={vessel.isActive ? 'bg-green-600' : 'bg-gray-400'}
                  >
                    {vessel.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No vessels found.</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/vessels"
              className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              All Vessels
            </Link>
            <Link
              href="/config"
              className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              Configuration
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
