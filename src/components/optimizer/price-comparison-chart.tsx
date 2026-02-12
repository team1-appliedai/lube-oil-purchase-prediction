'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { PortPlan } from '@/lib/optimizer/types';

interface PriceComparisonChartProps {
  ports: PortPlan[];
}

export function PriceComparisonChart({ ports }: PriceComparisonChartProps) {
  const data = ports.map((port) => ({
    portName: port.portName,
    'Cylinder Oil': port.actions.cylinderOil.pricePerLiter,
    'ME System Oil': port.actions.meSystemOil.pricePerLiter,
    'AE System Oil': port.actions.aeSystemOil.pricePerLiter,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis
          dataKey="portName"
          tick={{ fontSize: 12 }}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(value: number) => `$${value.toFixed(2)}`}
          label={{
            value: 'USD / L',
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 12 },
          }}
          width={80}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`$${Number(value).toFixed(4)}/L`]}
        />
        <Legend />
        <Bar dataKey="Cylinder Oil" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="ME System Oil" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="AE System Oil" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
