'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Eye } from 'lucide-react';
import type { PurchasePlan } from '@/lib/optimizer/types';
import { formatUSD, formatDate } from '@/lib/utils/format';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-maritime-blue/20 text-maritime-blue-light',
  approved: 'bg-maritime-green/20 text-maritime-green',
  rejected: 'bg-maritime-red/20 text-maritime-red',
};

export default function PlansPage() {
  const [plans, setPlans] = useState<PurchasePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/optimizer/plans')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPlans(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (planId: string, status: string) => {
    try {
      await fetch('/api/optimizer/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, status }),
      });
      setPlans((prev) =>
        prev.map((p) =>
          p._id === planId ? { ...p, status: status as PurchasePlan['status'] } : p
        )
      );
    } catch (error) {
      console.error('Failed to update plan status:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Purchase Plans</h2>
          <p className="text-sm text-muted-foreground">
            Saved optimization results and approval workflow
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <ClipboardList className="h-3 w-3" />
          {plans.length} plans
        </Badge>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No purchase plans yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Run the optimizer on a vessel to create a plan
            </p>
            <Link href="/vessels">
              <Button className="mt-4" variant="outline">
                Go to Vessels
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">All Plans</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Savings</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan._id}>
                    <TableCell className="font-medium">
                      {plan.vesselName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[plan.status] || ''}
                      >
                        {plan.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUSD(plan.optimizerOutput.totalCost.total)}
                    </TableCell>
                    <TableCell className="text-right text-maritime-green">
                      {formatUSD(plan.optimizerOutput.savings.total)}
                    </TableCell>
                    <TableCell>
                      {plan.createdAt ? formatDate(String(plan.createdAt)) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {plan.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(plan._id!, 'submitted')}
                          >
                            Submit
                          </Button>
                        )}
                        {plan.status === 'submitted' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-maritime-green"
                              onClick={() => handleStatusChange(plan._id!, 'approved')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-maritime-red"
                              onClick={() => handleStatusChange(plan._id!, 'rejected')}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        <Link href={`/plans/${plan._id}`}>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
