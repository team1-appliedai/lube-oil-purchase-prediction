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
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2} className="border-r">Port</TableHead>
            <TableHead rowSpan={2} className="border-r">Country</TableHead>
            <TableHead rowSpan={2} className="border-r">Arrival</TableHead>
            <TableHead rowSpan={2} className="border-r text-right">Sea Days</TableHead>
            <TableHead rowSpan={2} className="border-r text-right">Delivery</TableHead>
            {oilGrades.map((grade) => (
              <TableHead
                key={grade.category}
                colSpan={5}
                className="border-r text-center last:border-r-0"
              >
                {grade.label}
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            {oilGrades.map((grade) => (
              <GradeSubHeaders key={grade.category} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ports.map((port) => (
            <TableRow key={`${port.portCode}-${port.arrivalDate}`}>
              <TableCell className="border-r font-medium">{port.portName}</TableCell>
              <TableCell className="border-r text-muted-foreground">{port.country}</TableCell>
              <TableCell className="border-r">{formatDateShort(port.arrivalDate)}</TableCell>
              <TableCell className="border-r text-right">{formatNumber(port.seaDaysToNext, 1)}</TableCell>
              <TableCell className="border-r text-right tabular-nums">
                {port.deliveryCharge > 0 ? formatUSD(port.deliveryCharge) : '—'}
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
      <TableHead className="text-center text-xs">Action</TableHead>
      <TableHead className="text-right text-xs">Qty (L)</TableHead>
      <TableHead className="text-right text-xs">Cost (USD)</TableHead>
      <TableHead className="text-right text-xs">ROB Arr.</TableHead>
      <TableHead className="text-right text-xs border-r last:border-r-0">ROB Dep.</TableHead>
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
      <TableCell className="text-right tabular-nums">
        {quantity > 0 ? formatLiters(quantity) : '—'}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {cost > 0 ? formatUSD(cost) : '—'}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatLiters(robOnArrival)}</TableCell>
      <TableCell className="text-right tabular-nums border-r last:border-r-0">
        {formatLiters(robOnDeparture)}
      </TableCell>
    </>
  );
}
