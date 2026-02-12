'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ship } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
        <h1 className="text-2xl font-bold">Vessels</h1>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Vessels</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vessels.map((vessel) => (
          <Link key={vessel.vesselId} href={`/vessels/${vessel.vesselId}`}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ship className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{vessel.vesselName}</CardTitle>
                  </div>
                  <Badge
                    variant={vessel.isActive ? 'default' : 'secondary'}
                    className={vessel.isActive ? 'bg-green-600' : 'bg-gray-400'}
                  >
                    {vessel.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Code:</span>{' '}
                    {vessel.vesselCode}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Type:</span>{' '}
                    {vessel.vesselType}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Fleet:</span>{' '}
                    {vessel.fleet}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Supplier:</span>{' '}
                    {vessel.lubeSupplier}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
