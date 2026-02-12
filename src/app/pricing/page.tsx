'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { PortPrice } from '@/lib/optimizer/types';

// ── Types ────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc' | null;

type PriceKey = 'cylPrice' | 'mePrice' | 'aePrice';

interface FlatRow {
  port: string;
  country: string;
  supplier: string;
  cylPrice: number | null;
  mePrice: number | null;
  aePrice: number | null;
  _idx: number;
}

const PAGE_SIZES = [25, 50, 75, 100];

// ── Helpers ──────────────────────────────────────────────────

function getBestPrice(priceMap: Record<string, number>): number | null {
  const values = Object.values(priceMap);
  if (values.length === 0) return null;
  return Math.min(...values);
}

function formatPrice(price: number | null): string {
  if (price === null) return '\u2014';
  return price.toFixed(4);
}

function getPriceColor(price: number | null, allPrices: (number | null)[]): string {
  if (price === null) return '';
  const valid = allPrices.filter((p): p is number => p !== null);
  if (valid.length === 0) return '';
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return 'text-slate-700';
  const ratio = (price - min) / (max - min);
  if (ratio <= 0.33) return 'text-emerald-600 font-medium';
  if (ratio >= 0.66) return 'text-red-500';
  return 'text-amber-600';
}

// ── Filter Components ────────────────────────────────────────

function SortButton({ dir, onClick }: { dir: SortDir; onClick: () => void }) {
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

function TextSearchPopover({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isActive = value.length > 0;

  const apply = () => { onChange(local); setOpen(false); };
  const clear = () => { setLocal(''); onChange(''); setOpen(false); };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setTimeout(() => inputRef.current?.focus(), 50); }}>
      <PopoverTrigger asChild>
        <button className={`ml-1 inline-flex items-center justify-center rounded p-0.5 transition-colors ${isActive ? 'text-mw-purple bg-mw-purple/10' : 'text-slate-300 hover:text-slate-500'}`}>
          <Search className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 space-y-3">
        <p className="text-xs font-medium text-slate-500">Search {label}</p>
        <Input
          ref={inputRef}
          placeholder={`Type to search...`}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          className="h-8 text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" className="h-7 flex-1 text-xs" onClick={apply}>Apply</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={clear}><X className="h-3 w-3" /></Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CheckboxFilterPopover({
  label,
  allOptions,
  selected,
  onChange,
}: {
  label: string;
  allOptions: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [search, setSearch] = useState('');
  const [local, setLocal] = useState(selected);
  const [open, setOpen] = useState(false);
  const isActive = selected.size > 0 && selected.size < allOptions.length;

  const filtered = allOptions.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (val: string) => {
    const next = new Set(local);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setLocal(next);
  };

  const selectAll = () => setLocal(new Set(allOptions));
  const clearAll = () => setLocal(new Set());

  const apply = () => { onChange(local); setOpen(false); };
  const clear = () => { onChange(new Set()); setLocal(new Set()); setOpen(false); };

  // Sync local when parent changes
  const openChange = (o: boolean) => {
    if (o) setLocal(selected);
    setOpen(o);
  };

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button className={`ml-1 inline-flex items-center justify-center rounded p-0.5 transition-colors ${isActive ? 'text-mw-purple bg-mw-purple/10' : 'text-slate-300 hover:text-slate-500'}`}>
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-2 p-3">
        <p className="text-xs font-medium text-slate-500">Filter by {label}</p>
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
        <div className="flex gap-2 text-[10px]">
          <button onClick={selectAll} className="text-mw-purple hover:underline">Select all</button>
          <span className="text-slate-300">|</span>
          <button onClick={clearAll} className="text-slate-400 hover:underline">Clear all</button>
        </div>
        <div className="max-h-40 overflow-y-auto space-y-0.5 custom-scrollbar">
          {filtered.map((opt) => {
            const checked = local.has(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50 transition-colors"
              >
                <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${checked ? 'bg-mw-purple border-mw-purple' : 'border-slate-300'}`}>
                  {checked && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="truncate text-slate-600">{opt}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-[10px] text-slate-400 py-2 text-center">No matches</p>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-7 flex-1 text-xs" onClick={apply}>Apply</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={clear}><X className="h-3 w-3" /></Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function PricingPage() {
  const [prices, setPrices] = useState<PortPrice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [portSearch, setPortSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState<Set<string>>(new Set());
  const [supplierFilter, setSupplierFilter] = useState<Set<string>>(new Set());

  // Sort
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Pagination
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch('/api/pricing')
      .then((res) => res.json())
      .then((data) => setPrices(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Unique options for checkbox filters
  const allCountries = useMemo(() => [...new Set(prices.map((p) => p.country))].sort(), [prices]);
  const allSuppliers = useMemo(() => [...new Set(prices.map((p) => p.supplier))].sort(), [prices]);

  // Flatten to rows with computed prices
  const rows: FlatRow[] = useMemo(() =>
    prices.map((p, i) => ({
      port: p.port,
      country: p.country,
      supplier: p.supplier,
      cylPrice: getBestPrice({ ...p.cylinderOilLS, ...p.cylinderOilHS }),
      mePrice: getBestPrice(p.meCrankcaseOil),
      aePrice: getBestPrice(p.aeCrankcaseOil),
      _idx: i,
    })),
    [prices]
  );

  const toggleSort = useCallback((key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else if (sortDir === 'desc') { setSortDir(null); setSortKey(null); }
    else setSortDir('asc');
  }, [sortKey, sortDir]);

  // Filter + sort
  const processed = useMemo(() => {
    let data = [...rows];

    // Port text search
    if (portSearch) {
      const q = portSearch.toLowerCase();
      data = data.filter((r) => r.port.toLowerCase().includes(q));
    }

    // Country checkbox
    if (countryFilter.size > 0) {
      data = data.filter((r) => countryFilter.has(r.country));
    }

    // Supplier checkbox
    if (supplierFilter.size > 0) {
      data = data.filter((r) => supplierFilter.has(r.supplier));
    }

    // Sort
    if (sortDir && sortKey) {
      data.sort((a, b) => {
        const aVal = a[sortKey as keyof FlatRow];
        const bVal = b[sortKey as keyof FlatRow];

        // Nulls go last
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDir === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }

        return 0;
      });
    }

    return data;
  }, [rows, portSearch, countryFilter, supplierFilter, sortKey, sortDir]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [portSearch, countryFilter, supplierFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageData = processed.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Price color arrays (from visible page for relative coloring)
  const allCylPrices = processed.map((r) => r.cylPrice);
  const allMePrices = processed.map((r) => r.mePrice);
  const allAePrices = processed.map((r) => r.aePrice);

  const activeFilterCount =
    (portSearch ? 1 : 0) +
    (countryFilter.size > 0 && countryFilter.size < allCountries.length ? 1 : 0) +
    (supplierFilter.size > 0 && supplierFilter.size < allSuppliers.length ? 1 : 0);

  const getSortDir = (key: string): SortDir => (sortKey === key ? sortDir : null);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Pricing Matrix</h2>
          <p className="text-sm text-slate-400">
            Lube oil prices by port, converted from USD/MT
          </p>
        </div>
        <span className="badge-info gap-1">
          <DollarSign className="h-3 w-3" />
          {prices.length} ports
        </span>
      </div>

      <div className="soft-card p-0 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2">
            <h3 className="section-label">Price Comparison</h3>
            {activeFilterCount > 0 && (
              <span className="badge-purple text-[10px]">{activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active</span>
            )}
          </div>
          <span className="text-xs text-slate-400">{processed.length} of {prices.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: 'rgba(148, 163, 184, 0.15)', background: 'rgba(248, 250, 252, 0.6)' }}>
                {/* Port */}
                <TableHead className="text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center">
                    <span>Port</span>
                    <SortButton dir={getSortDir('port')} onClick={() => toggleSort('port')} />
                    <TextSearchPopover label="ports" value={portSearch} onChange={setPortSearch} />
                  </div>
                </TableHead>

                {/* Country */}
                <TableHead className="text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center">
                    <span>Country</span>
                    <SortButton dir={getSortDir('country')} onClick={() => toggleSort('country')} />
                    <CheckboxFilterPopover
                      label="country"
                      allOptions={allCountries}
                      selected={countryFilter}
                      onChange={setCountryFilter}
                    />
                  </div>
                </TableHead>

                {/* Supplier */}
                <TableHead className="text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center">
                    <span>Supplier</span>
                    <SortButton dir={getSortDir('supplier')} onClick={() => toggleSort('supplier')} />
                    <CheckboxFilterPopover
                      label="supplier"
                      allOptions={allSuppliers}
                      selected={supplierFilter}
                      onChange={setSupplierFilter}
                    />
                  </div>
                </TableHead>

                {/* Cylinder Oil */}
                <TableHead className="text-right text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center justify-end">
                    <div className="text-right">
                      <span>Cylinder Oil</span>
                      <span className="block text-[9px] font-normal normal-case tracking-normal text-slate-300">(USD/L)</span>
                    </div>
                    <SortButton dir={getSortDir('cylPrice')} onClick={() => toggleSort('cylPrice')} />
                  </div>
                </TableHead>

                {/* ME Crankcase */}
                <TableHead className="text-right text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center justify-end">
                    <div className="text-right">
                      <span>ME Crankcase</span>
                      <span className="block text-[9px] font-normal normal-case tracking-normal text-slate-300">(USD/L)</span>
                    </div>
                    <SortButton dir={getSortDir('mePrice')} onClick={() => toggleSort('mePrice')} />
                  </div>
                </TableHead>

                {/* AE Crankcase */}
                <TableHead className="text-right text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center justify-end">
                    <div className="text-right">
                      <span>AE Crankcase</span>
                      <span className="block text-[9px] font-normal normal-case tracking-normal text-slate-300">(USD/L)</span>
                    </div>
                    <SortButton dir={getSortDir('aePrice')} onClick={() => toggleSort('aePrice')} />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {pageData.map((r) => (
                <TableRow key={`${r.port}-${r.supplier}-${r._idx}`} className="hover:bg-mw-purple/[0.02]" style={{ borderColor: 'rgba(148, 163, 184, 0.08)' }}>
                  <TableCell className="font-medium text-slate-700">{r.port}</TableCell>
                  <TableCell className="text-slate-500">{r.country}</TableCell>
                  <TableCell>
                    <span className="badge-neutral text-[10px]">{r.supplier}</span>
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${getPriceColor(r.cylPrice, allCylPrices)}`}>
                    {formatPrice(r.cylPrice)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${getPriceColor(r.mePrice, allMePrices)}`}>
                    {formatPrice(r.mePrice)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${getPriceColor(r.aePrice, allAePrices)}`}>
                    {formatPrice(r.aePrice)}
                  </TableCell>
                </TableRow>
              ))}
              {processed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                    {activeFilterCount > 0 ? 'No records match the current filters.' : 'No pricing data found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {processed.length > 0 && (
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
        )}
      </div>
    </div>
  );
}
