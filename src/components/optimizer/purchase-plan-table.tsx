'use client';

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { ActionBadge } from '@/components/optimizer/action-badge';
import { formatLiters, formatUSD, formatDateShort, formatNumber } from '@/lib/utils/format';
import type { PortPlan, OilGradeConfig, OilGradeCategory } from '@/lib/optimizer/types';

interface PurchasePlanTableProps {
  ports: PortPlan[];
  oilGrades: OilGradeConfig[];
}

export function PurchasePlanTable({ ports, oilGrades }: PurchasePlanTableProps) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(148, 163, 184, 0.15)' }}>
      <Table>
        <TableHeader>
          <TableRow className="!border-b" style={{ borderColor: 'rgba(148, 163, 184, 0.15)', background: 'rgba(248, 250, 252, 0.6)' }}>
            <TableHead rowSpan={2} className="border-r border-slate-200/30 text-[11px] uppercase tracking-wider text-slate-400">Port</TableHead>
            <TableHead rowSpan={2} className="border-r border-slate-200/30 text-[11px] uppercase tracking-wider text-slate-400">Country</TableHead>
            <TableHead rowSpan={2} className="border-r border-slate-200/30 text-[11px] uppercase tracking-wider text-slate-400">Arrival</TableHead>
            <TableHead rowSpan={2} className="border-r border-slate-200/30 text-right text-[11px] uppercase tracking-wider text-slate-400">Sea Days</TableHead>
            <TableHead rowSpan={2} className="border-r border-slate-200/30 text-right text-[11px] uppercase tracking-wider text-slate-400">Delivery</TableHead>
            {oilGrades.map((grade) => (
              <TableHead
                key={grade.category}
                colSpan={5}
                className="border-r border-slate-200/30 text-center last:border-r-0 text-[11px] uppercase tracking-wider text-slate-400"
              >
                {grade.label}
              </TableHead>
            ))}
          </TableRow>
          <TableRow style={{ borderColor: 'rgba(148, 163, 184, 0.15)', background: 'rgba(248, 250, 252, 0.6)' }}>
            {oilGrades.map((grade) => (
              <GradeSubHeaders key={grade.category} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ports.map((port) => (
            <TableRow key={`${port.portCode}-${port.arrivalDate}`} className="hover:bg-mw-purple/[0.02]" style={{ borderColor: 'rgba(148, 163, 184, 0.08)' }}>
              <TableCell className="border-r border-slate-200/30 font-medium text-slate-700">{port.portName}</TableCell>
              <TableCell className="border-r border-slate-200/30 text-slate-400">{port.country}</TableCell>
              <TableCell className="border-r border-slate-200/30 text-slate-600">{formatDateShort(port.arrivalDate)}</TableCell>
              <TableCell className="border-r border-slate-200/30 text-right text-slate-600">{formatNumber(port.seaDaysToNext, 1)}</TableCell>
              <TableCell className="border-r border-slate-200/30 text-right tabular-nums text-slate-600">
                {port.deliveryCharge > 0 ? formatUSD(port.deliveryCharge) : '\u2014'}
              </TableCell>
              {oilGrades.map((grade) => {
                const action = port.actions[grade.category as OilGradeCategory];
                return (
                  <GradeCells
                    key={grade.category}
                    action={action.action}
                    quantity={action.quantity}
                    cost={action.cost}
                    robOnArrival={action.robOnArrival}
                    robOnDeparture={action.robOnDeparture}
                  />
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GradeSubHeaders() {
  return (
    <>
      <TableHead className="text-center text-[10px] uppercase tracking-wider text-slate-400">Action</TableHead>
      <TableHead className="text-right text-[10px] uppercase tracking-wider text-slate-400">Qty (L)</TableHead>
      <TableHead className="text-right text-[10px] uppercase tracking-wider text-slate-400">Cost (USD)</TableHead>
      <TableHead className="text-right text-[10px] uppercase tracking-wider text-slate-400">ROB Arr.</TableHead>
      <TableHead className="text-right text-[10px] uppercase tracking-wider text-slate-400 border-r border-slate-200/30 last:border-r-0">ROB Dep.</TableHead>
    </>
  );
}

interface GradeCellsProps {
  action: PortPlan['actions'][OilGradeCategory]['action'];
  quantity: number;
  cost: number;
  robOnArrival: number;
  robOnDeparture: number;
}

function GradeCells({ action, quantity, cost, robOnArrival, robOnDeparture }: GradeCellsProps) {
  return (
    <>
      <TableCell className="text-center">
        <ActionBadge action={action} />
      </TableCell>
      <TableCell className="text-right tabular-nums text-slate-600">
        {quantity > 0 ? formatLiters(quantity) : '\u2014'}
      </TableCell>
      <TableCell className="text-right tabular-nums text-slate-600">
        {cost > 0 ? formatUSD(cost) : '\u2014'}
      </TableCell>
      <TableCell className="text-right tabular-nums text-slate-600">{formatLiters(robOnArrival)}</TableCell>
      <TableCell className="text-right tabular-nums border-r border-slate-200/30 last:border-r-0 text-slate-600">
        {formatLiters(robOnDeparture)}
      </TableCell>
    </>
  );
}
