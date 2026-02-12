'use client';

import { use, useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber, formatDate } from '@/lib/utils/format';
import { chartColors, chartConfig } from '@/lib/chart-config';
import type { ConsumptionRecord } from '@/lib/optimizer/types';

// ── Types ────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc' | null;
type NumericOp = '>' | '>=' | '=' | '<=' | '<';

interface NumericFilter {
  op: NumericOp;
  value: number;
}

interface DateFilter {
  start: string; // yyyy-mm-dd
  end: string;
}

type NumericField =
  | 'cylinderOilRob'
  | 'meSystemOilRob'
  | 'aeSystemOilRob'
  | 'cylinderOilConsumption'
  | 'meSystemOilConsumption'
  | 'aeSystemOilConsumption';

const NUMERIC_COLS: { key: NumericField; label: string; group: string }[] = [
  { key: 'cylinderOilRob', label: 'Cyl ROB', group: 'ROB (L)' },
  { key: 'meSystemOilRob', label: 'ME ROB', group: 'ROB (L)' },
  { key: 'aeSystemOilRob', label: 'AE ROB', group: 'ROB (L)' },
  { key: 'cylinderOilConsumption', label: 'Cyl Cons.', group: 'Consumption (L)' },
  { key: 'meSystemOilConsumption', label: 'ME Cons.', group: 'Consumption (L)' },
  { key: 'aeSystemOilConsumption', label: 'AE Cons.', group: 'Consumption (L)' },
];

const OP_OPTIONS: { value: NumericOp; label: string }[] = [
  { value: '>', label: '> Greater than' },
  { value: '>=', label: '>= Greater or equal' },
  { value: '=', label: '= Equal to' },
  { value: '<=', label: '<= Less or equal' },
  { value: '<', label: '< Less than' },
];

const PAGE_SIZES = [25, 50, 75, 100];

// ── Helpers ──────────────────────────────────────────────────

function passesNumericFilter(val: number, f: NumericFilter | null): boolean {
  if (!f) return true;
  switch (f.op) {
    case '>':  return val > f.value;
    case '>=': return val >= f.value;
    case '=':  return val === f.value;
    case '<=': return val <= f.value;
    case '<':  return val < f.value;
  }
}

function passesDateFilter(dateStr: string, f: DateFilter): boolean {
  if (!f.start && !f.end) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  if (f.start) {
    const s = new Date(f.start);
    if (d < s) return false;
  }
  if (f.end) {
    const e = new Date(f.end);
    e.setHours(23, 59, 59, 999);
    if (d > e) return false;
  }
  return true;
}

// ── Components ───────────────────────────────────────────────

function DateFilterPopover({
  filter,
  onChange,
}: {
  filter: DateFilter;
  onChange: (f: DateFilter) => void;
}) {
  const [start, setStart] = useState(filter.start);
  const [end, setEnd] = useState(filter.end);
  const [open, setOpen] = useState(false);
  const isActive = filter.start || filter.end;

  const apply = () => {
    onChange({ start, end });
    setOpen(false);
  };
  const clear = () => {
    setStart('');
    setEnd('');
    onChange({ start: '', end: '' });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`ml-1 inline-flex items-center justify-center rounded p-0.5 transition-colors ${
            isActive
              ? 'text-mw-purple bg-mw-purple/10'
              : 'text-slate-300 hover:text-slate-500'
          }`}
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-3">
        <p className="text-xs font-medium text-slate-500">Filter by date range</p>
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400">From</label>
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400">To</label>
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 flex-1 text-xs" onClick={apply}>
            Apply
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={clear}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NumericFilterPopover({
  label,
  filter,
  onChange,
}: {
  label: string;
  filter: NumericFilter | null;
  onChange: (f: NumericFilter | null) => void;
}) {
  const [op, setOp] = useState<NumericOp>(filter?.op ?? '>');
  const [val, setVal] = useState(filter?.value?.toString() ?? '');
  const [open, setOpen] = useState(false);

  const apply = () => {
    const num = Number(val);
    if (!isNaN(num) && val.trim() !== '') {
      onChange({ op, value: num });
    }
    setOpen(false);
  };
  const clear = () => {
    setVal('');
    onChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`ml-1 inline-flex items-center justify-center rounded p-0.5 transition-colors ${
            filter
              ? 'text-mw-purple bg-mw-purple/10'
              : 'text-slate-300 hover:text-slate-500'
          }`}
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 space-y-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <div className="space-y-2">
          <Select value={op} onValueChange={(v) => setOp(v as NumericOp)}>
            <SelectTrigger className="h-8 text-xs w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OP_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Value..."
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 flex-1 text-xs" onClick={apply}>
            Apply
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={clear}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortButton({
  dir,
  onClick,
}: {
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="ml-1 inline-flex items-center text-slate-300 hover:text-slate-500 transition-colors">
      {dir === 'asc' ? (
        <ArrowUp className="h-3 w-3 text-mw-purple" />
      ) : dir === 'desc' ? (
        <ArrowDown className="h-3 w-3 text-mw-purple" />
      ) : (
        <ArrowUpDown className="h-3 w-3" />
      )}
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function ConsumptionPage({
  params,
}: {
  params: Promise<{ vesselId: string }>;
}) {
  const { vesselId } = use(params);
  const [records, setRecords] = useState<ConsumptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting
  const [sortKey, setSortKey] = useState<string>('reportDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>({ start: '', end: '' });
  const [numericFilters, setNumericFilters] = useState<Record<string, NumericFilter | null>>({});

  // Pagination
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch(`/api/consumption/${vesselId}`)
      .then((res) => res.json())
      .then((data) => {
        setRecords(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [vesselId]);

  // Cycle sort: null → asc → desc → null
  const toggleSort = useCallback((key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortDir(null);
    } else {
      setSortDir('asc');
    }
  }, [sortKey, sortDir]);

  const updateNumericFilter = useCallback((key: string, f: NumericFilter | null) => {
    setNumericFilters((prev) => ({ ...prev, [key]: f }));
    setPage(0);
  }, []);

  const updateDateFilter = useCallback((f: DateFilter) => {
    setDateFilter(f);
    setPage(0);
  }, []);

  // Filtered + sorted data
  const processed = useMemo(() => {
    let data = [...records];

    // Date filter
    data = data.filter((r) => passesDateFilter(r.reportDate, dateFilter));

    // Numeric filters
    for (const [key, filter] of Object.entries(numericFilters)) {
      if (filter) {
        data = data.filter((r) => passesNumericFilter(r[key as NumericField], filter));
      }
    }

    // Sort
    if (sortDir && sortKey) {
      data.sort((a, b) => {
        let aVal: number | string;
        let bVal: number | string;

        if (sortKey === 'reportDate') {
          aVal = new Date(a.reportDate).getTime();
          bVal = new Date(b.reportDate).getTime();
        } else {
          aVal = (a as unknown as Record<string, number>)[sortKey] ?? 0;
          bVal = (b as unknown as Record<string, number>)[sortKey] ?? 0;
        }

        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [records, dateFilter, numericFilters, sortKey, sortDir]);

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageData = processed.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Active filter count
  const activeFilterCount =
    (dateFilter.start || dateFilter.end ? 1 : 0) +
    Object.values(numericFilters).filter(Boolean).length;

  // Chart uses all records (unfiltered), sorted by date ascending
  const chartData = useMemo(() => {
    const sorted = [...records].sort(
      (a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime()
    );
    return sorted.map((r) => ({
      date: formatDate(r.reportDate),
      cylinderRob: r.cylinderOilRob,
      meRob: r.meSystemOilRob,
      aeRob: r.aeSystemOilRob,
    }));
  }, [records]);

  const vesselName = records.length > 0 ? records[0].vesselName : 'Vessel';

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="soft-card">
          <Skeleton className="h-[300px] w-full" />
        </div>
        <div className="soft-card">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const getSortDir = (key: string): SortDir => (sortKey === key ? sortDir : null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/vessels/${vesselId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">{vesselName} - Consumption History</h1>
      </div>

      {/* ROB Chart */}
      <div className="soft-card">
        <h3 className="section-label mb-3">ROB Over Time</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid {...chartConfig.grid} />
              <XAxis dataKey="date" {...chartConfig.xAxis} />
              <YAxis {...chartConfig.yAxis} />
              <Tooltip {...chartConfig.tooltip} />
              <Legend {...chartConfig.legend} />
              <Line type="monotone" dataKey="cylinderRob" name="Cylinder Oil ROB" stroke={chartColors.primary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="meRob" name="ME System Oil ROB" stroke={chartColors.quaternary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="aeRob" name="AE System Oil ROB" stroke={chartColors.secondary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400">No consumption data available.</p>
        )}
      </div>

      {/* Data Table */}
      <div className="soft-card p-0 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2">
            <h3 className="section-label">Consumption Log</h3>
            {activeFilterCount > 0 && (
              <span className="badge-purple text-[10px]">{activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{processed.length} of {records.length} records</span>
          </div>
        </div>

        {processed.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: 'rgba(148, 163, 184, 0.15)', background: 'rgba(248, 250, 252, 0.6)' }}>
                    {/* Date column */}
                    <TableHead className="text-[11px] uppercase tracking-wider text-slate-400">
                      <div className="flex items-center">
                        <span>Date</span>
                        <SortButton dir={getSortDir('reportDate')} onClick={() => toggleSort('reportDate')} />
                        <DateFilterPopover filter={dateFilter} onChange={updateDateFilter} />
                      </div>
                    </TableHead>

                    {/* Numeric columns */}
                    {NUMERIC_COLS.map((col) => (
                      <TableHead key={col.key} className="text-right text-[11px] uppercase tracking-wider text-slate-400">
                        <div className="flex items-center justify-end">
                          <div className="text-right">
                            <span>{col.label}</span>
                            <span className="block text-[9px] font-normal normal-case tracking-normal text-slate-300">({col.group})</span>
                          </div>
                          <SortButton dir={getSortDir(col.key)} onClick={() => toggleSort(col.key)} />
                          <NumericFilterPopover
                            label={col.label}
                            filter={numericFilters[col.key] ?? null}
                            onChange={(f) => updateNumericFilter(col.key, f)}
                          />
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.map((r, idx) => (
                    <TableRow
                      key={`${r.reportDate}-${safePage}-${idx}`}
                      className="hover:bg-mw-purple/[0.02]"
                      style={{ borderColor: 'rgba(148, 163, 184, 0.08)' }}
                    >
                      <TableCell className="text-slate-700">{formatDate(r.reportDate)}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">{formatNumber(r.cylinderOilRob)}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">{formatNumber(r.meSystemOilRob)}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">{formatNumber(r.aeSystemOilRob)}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">{formatNumber(r.cylinderOilConsumption)}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">{formatNumber(r.meSystemOilConsumption)}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">{formatNumber(r.aeSystemOilConsumption)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination bar */}
            <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: 'rgba(148, 163, 184, 0.12)' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Rows per page</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                  <SelectTrigger className="h-7 w-[70px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)} className="text-xs">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, processed.length)} of {processed.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={safePage === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400 p-4">
            {activeFilterCount > 0 ? 'No records match the current filters.' : 'No records found.'}
          </p>
        )}
      </div>
    </div>
  );
}
