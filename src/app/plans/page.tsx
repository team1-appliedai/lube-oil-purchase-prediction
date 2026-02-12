'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

const statusBadge: Record<string, string> = {
  draft: 'badge-neutral',
  submitted: 'badge-info',
  approved: 'badge-success',
  rejected: 'badge-danger',
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
          <h2 className="text-2xl font-bold text-slate-800">Purchase Plans</h2>
          <p className="text-sm text-slate-400">
            Saved optimization results and approval workflow
          </p>
        </div>
        <span className="badge-info gap-1">
          <ClipboardList className="h-3 w-3" />
          {plans.length} plans
        </span>
      </div>

      {plans.length === 0 ? (
        <div className="soft-card flex flex-col items-center justify-center py-12">
          <ClipboardList className="h-12 w-12 text-slate-300 mb-4" />
          <p className="text-slate-400">No purchase plans yet</p>
          <p className="text-sm text-slate-300 mt-1">
            Run the optimizer on a vessel to create a plan
          </p>
          <Link href="/vessels">
            <Button className="mt-4" variant="outline">
              Go to Vessels
            </Button>
          </Link>
        </div>
      ) : (
        <div className="soft-card p-0 overflow-hidden">
          <div className="p-4 pb-2">
            <h3 className="section-label">All Plans</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: 'rgba(148, 163, 184, 0.15)', background: 'rgba(248, 250, 252, 0.6)' }}>
                <TableHead className="text-[11px] uppercase tracking-wider text-slate-400">Vessel</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-slate-400">Status</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider text-slate-400">Total Cost</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider text-slate-400">Savings</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-slate-400">Created</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan._id} className="hover:bg-mw-purple/[0.02]" style={{ borderColor: 'rgba(148, 163, 184, 0.08)' }}>
                  <TableCell className="font-medium text-slate-700">
                    {plan.vesselName}
                  </TableCell>
                  <TableCell>
                    <span className={statusBadge[plan.status] || 'badge-neutral'}>
                      {plan.status.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-slate-700">
                    {formatUSD(plan.optimizerOutput.totalCost.total)}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600">
                    {formatUSD(plan.optimizerOutput.savings.total)}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {plan.createdAt ? formatDate(String(plan.createdAt)) : '\u2014'}
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
                            className="text-emerald-600"
                            onClick={() => handleStatusChange(plan._id!, 'approved')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500"
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
        </div>
      )}
    </div>
  );
}
