export const chartColors = {
  primary: '#7c5cfc',
  secondary: '#f97316',
  tertiary: '#3b82f6',
  quaternary: '#10b981',
  quinary: '#f59e0b',
  danger: '#ef4444',
  muted: '#94a3b8',
};

export const chartConfig = {
  grid: {
    strokeDasharray: '3 3',
    stroke: 'rgba(148, 163, 184, 0.15)',
  },
  xAxis: {
    tick: { fontSize: 12, fill: '#94a3b8' },
    axisLine: { stroke: 'rgba(148, 163, 184, 0.15)' },
    tickLine: false as const,
  },
  yAxis: {
    tick: { fontSize: 12, fill: '#94a3b8' },
    axisLine: false as const,
    tickLine: false as const,
  },
  tooltip: {
    contentStyle: {
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      fontSize: '12px',
      color: '#1e293b',
    },
  },
  legend: {
    wrapperStyle: { fontSize: '12px', color: '#64748b' },
  },
  line: {
    strokeWidth: 2,
    dot: { r: 4 },
    activeDot: { r: 6 },
  },
  bar: {
    radius: [6, 6, 0, 0] as [number, number, number, number],
  },
};

export const pieColors = [
  chartColors.primary,
  chartColors.secondary,
  chartColors.tertiary,
  chartColors.quaternary,
  chartColors.quinary,
];

export const chartHeights = {
  sm: 250,
  md: 350,
  lg: 400,
};

export function getStatusColor(status: 'success' | 'warning' | 'danger' | 'info'): string {
  const map = {
    success: chartColors.quaternary,
    warning: chartColors.quinary,
    danger: chartColors.danger,
    info: chartColors.tertiary,
  };
  return map[status];
}

export function ChartGradients() {
  return (
    <defs>
      <linearGradient id="gradPrimary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.3} />
        <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0.05} />
      </linearGradient>
      <linearGradient id="gradSecondary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={chartColors.secondary} stopOpacity={0.3} />
        <stop offset="100%" stopColor={chartColors.secondary} stopOpacity={0.05} />
      </linearGradient>
      <linearGradient id="gradTertiary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={chartColors.tertiary} stopOpacity={0.3} />
        <stop offset="100%" stopColor={chartColors.tertiary} stopOpacity={0.05} />
      </linearGradient>
      <linearGradient id="gradQuaternary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={chartColors.quaternary} stopOpacity={0.3} />
        <stop offset="100%" stopColor={chartColors.quaternary} stopOpacity={0.05} />
      </linearGradient>
    </defs>
  );
}
