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
import type { PortPlan, OilGradeConfig, OilGradeCategory } from '@/lib/optimizer/types';
import { formatLiters } from '@/lib/utils/format';

const GRADE_COLORS: Record<OilGradeCategory, string> = {
  cylinderOil: '#3b82f6',
  meSystemOil: '#10b981',
  aeSystemOil: '#f59e0b',
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
          tickFormatter={(value: number) => formatLiters(value)}
          width={90}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            return [formatLiters(Number(value)), String(name)];
          }}
        />
        <Legend />

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
              strokeWidth={2}
              dot={{ fill: color, r: 4 }}
              activeDot={{ r: 6 }}
            />
          );
        })}

        {oilGrades.map((grade) => {
          const cat = grade.category as OilGradeCategory;
          return (
            <ReferenceLine
              key={`${cat}_min`}
              y={grade.tankConfig.minRob}
              stroke="#ef4444"
              strokeDasharray="6 4"
              label={{
                value: `${grade.label} Min`,
                position: 'insideTopRight',
                fontSize: 10,
                fill: '#ef4444',
              }}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
