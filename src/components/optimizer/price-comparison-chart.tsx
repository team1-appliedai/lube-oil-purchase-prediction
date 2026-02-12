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
import { chartColors, chartConfig } from '@/lib/chart-config';
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
        <CartesianGrid strokeDasharray={chartConfig.grid.strokeDasharray} stroke={chartConfig.grid.stroke} />
        <XAxis
          dataKey="portName"
          tick={chartConfig.xAxis.tick}
          axisLine={chartConfig.xAxis.axisLine}
          tickLine={chartConfig.xAxis.tickLine}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={chartConfig.yAxis.tick}
          axisLine={chartConfig.yAxis.axisLine}
          tickLine={chartConfig.yAxis.tickLine}
          tickFormatter={(value: number) => `$${value.toFixed(2)}`}
          label={{
            value: 'USD / L',
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 12, fill: '#94a3b8' },
          }}
          width={80}
        />
        <Tooltip
          contentStyle={chartConfig.tooltip.contentStyle}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`$${Number(value).toFixed(4)}/L`]}
        />
        <Legend wrapperStyle={chartConfig.legend.wrapperStyle} />
        <Bar dataKey="Cylinder Oil" fill={chartColors.primary} radius={chartConfig.bar.radius} />
        <Bar dataKey="ME System Oil" fill={chartColors.quaternary} radius={chartConfig.bar.radius} />
        <Bar dataKey="AE System Oil" fill={chartColors.secondary} radius={chartConfig.bar.radius} />
      </BarChart>
    </ResponsiveContainer>
  );
}
