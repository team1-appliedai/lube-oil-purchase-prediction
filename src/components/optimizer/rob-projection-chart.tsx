'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { chartColors, chartConfig } from '@/lib/chart-config';
import type { PortPlan, OilGradeConfig, OilGradeCategory } from '@/lib/optimizer/types';
import { formatLiters } from '@/lib/utils/format';

const GRADE_COLORS: Record<OilGradeCategory, string> = {
  cylinderOil: chartColors.primary,
  meSystemOil: chartColors.quaternary,
  aeSystemOil: chartColors.secondary,
};

interface ROBProjectionChartProps {
  ports: PortPlan[];
  oilGrades: OilGradeConfig[];
}

export function ROBProjectionChart({ ports, oilGrades }: ROBProjectionChartProps) {
  const data = ports.map((port) => {
    const point: Record<string, string | number> = {
      portName: port.portName,
    };
    for (const grade of oilGrades) {
      const cat = grade.category as OilGradeCategory;
      point[`${cat}_arrival`] = port.actions[cat].robOnArrival;
      point[`${cat}_departure`] = port.actions[cat].robOnDeparture;
    }
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
          tickFormatter={(value: number) => formatLiters(value)}
          width={90}
        />
        <Tooltip
          contentStyle={chartConfig.tooltip.contentStyle}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            return [formatLiters(Number(value)), String(name)];
          }}
        />
        <Legend wrapperStyle={chartConfig.legend.wrapperStyle} />

        {oilGrades.map((grade) => {
          const cat = grade.category as OilGradeCategory;
          const color = GRADE_COLORS[cat];
          return (
            <Line
              key={cat}
              type="monotone"
              dataKey={`${cat}_departure`}
              name={`${grade.label} ROB`}
              stroke={color}
              strokeWidth={chartConfig.line.strokeWidth}
              dot={{ fill: color, r: chartConfig.line.dot.r }}
              activeDot={{ r: chartConfig.line.activeDot.r }}
            />
          );
        })}

        {oilGrades.map((grade) => {
          const cat = grade.category as OilGradeCategory;
          return (
            <ReferenceLine
              key={`${cat}_min`}
              y={grade.tankConfig.minRob}
              stroke={chartColors.danger}
              strokeDasharray="6 4"
              label={{
                value: `${grade.label} Min`,
                position: 'insideTopRight',
                fontSize: 10,
                fill: chartColors.danger,
              }}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
