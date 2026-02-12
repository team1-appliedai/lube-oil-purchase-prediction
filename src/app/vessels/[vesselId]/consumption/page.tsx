'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatLiters, formatDate } from '@/lib/utils/format';
import type { ConsumptionRecord } from '@/lib/optimizer/types';

export default function ConsumptionPage({
  params,
}: {
  params: Promise<{ vesselId: string }>;
}) {
  const { vesselId } = use(params);
  const [records, setRecords] = useState<ConsumptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/consumption/${vesselId}`)
      .then((res) => res.json())
      .then((data) => {
        setRecords(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [vesselId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sort by date ascending for chart display
  const sorted = [...records].sort(
    (a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime()
  );

  const chartData = sorted.map((r) => ({
    date: formatDate(r.reportDate),
    cylinderRob: r.cylinderOilRob,
    meRob: r.meSystemOilRob,
    aeRob: r.aeSystemOilRob,
  }));

  const vesselName = records.length > 0 ? records[0].vesselName : 'Vessel';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/vessels/${vesselId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold">{vesselName} - Consumption History</h1>
      </div>

      {/* ROB Chart */}
      <Card>
        <CardHeader>
          <CardTitle>ROB Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cylinderRob"
                  name="Cylinder Oil ROB"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="meRob"
                  name="ME System Oil ROB"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="aeRob"
                  name="AE System Oil ROB"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No consumption data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Consumption Log</CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Cyl ROB</TableHead>
                  <TableHead className="text-right">ME ROB</TableHead>
                  <TableHead className="text-right">AE ROB</TableHead>
                  <TableHead className="text-right">Cyl Cons.</TableHead>
                  <TableHead className="text-right">ME Cons.</TableHead>
                  <TableHead className="text-right">AE Cons.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r, idx) => (
                  <TableRow key={`${r.reportDate}-${idx}`}>
                    <TableCell>{formatDate(r.reportDate)}</TableCell>
                    <TableCell className="text-right">{formatLiters(r.cylinderOilRob)}</TableCell>
                    <TableCell className="text-right">{formatLiters(r.meSystemOilRob)}</TableCell>
                    <TableCell className="text-right">{formatLiters(r.aeSystemOilRob)}</TableCell>
                    <TableCell className="text-right">{formatLiters(r.cylinderOilConsumption)}</TableCell>
                    <TableCell className="text-right">{formatLiters(r.meSystemOilConsumption)}</TableCell>
                    <TableCell className="text-right">{formatLiters(r.aeSystemOilConsumption)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No records found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
