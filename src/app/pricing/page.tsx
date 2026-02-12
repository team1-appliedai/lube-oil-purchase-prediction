'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Search, DollarSign } from 'lucide-react';
import type { PortPrice } from '@/lib/optimizer/types';

export default function PricingPage() {
  const [prices, setPrices] = useState<PortPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/pricing')
      .then((res) => res.json())
      .then((data) => setPrices(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = prices.filter(
    (p) =>
      p.port.toLowerCase().includes(search.toLowerCase()) ||
      p.country.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier.toLowerCase().includes(search.toLowerCase())
  );

  const getBestPrice = (priceMap: Record<string, number>): number | null => {
    const values = Object.values(priceMap);
    if (values.length === 0) return null;
    return Math.min(...values);
  };

  const formatPrice = (price: number | null): string => {
    if (price === null) return '—';
    return `$${price.toFixed(4)}`;
  };

  const getPriceColor = (price: number | null, allPrices: (number | null)[]): string => {
    if (price === null) return '';
    const validPrices = allPrices.filter((p): p is number => p !== null);
    if (validPrices.length === 0) return '';
    const min = Math.min(...validPrices);
    const max = Math.max(...validPrices);
    if (max === min) return 'text-foreground';
    const ratio = (price - min) / (max - min);
    if (ratio <= 0.33) return 'text-maritime-green font-medium';
    if (ratio >= 0.66) return 'text-maritime-red';
    return 'text-maritime-amber';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Collect all prices for color coding
  const allCylPrices = filtered.map((p) => getBestPrice({ ...p.cylinderOilLS, ...p.cylinderOilHS }));
  const allMePrices = filtered.map((p) => getBestPrice(p.meCrankcaseOil));
  const allAePrices = filtered.map((p) => getBestPrice(p.aeCrankcaseOil));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pricing Matrix</h2>
          <p className="text-sm text-muted-foreground">
            Lube oil prices by port (USD/L, converted from USD/MT)
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <DollarSign className="h-3 w-3" />
          {prices.length} ports
        </Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by port, country, or supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Price Comparison (USD per Liter)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Port</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Cylinder Oil</TableHead>
                  <TableHead className="text-right">ME Crankcase</TableHead>
                  <TableHead className="text-right">AE Crankcase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map((p, idx) => {
                  const cylPrice = getBestPrice({ ...p.cylinderOilLS, ...p.cylinderOilHS });
                  const mePrice = getBestPrice(p.meCrankcaseOil);
                  const aePrice = getBestPrice(p.aeCrankcaseOil);

                  return (
                    <TableRow key={`${p.port}-${p.supplier}-${idx}`}>
                      <TableCell className="font-medium">{p.port}</TableCell>
                      <TableCell>{p.country}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {p.supplier}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right ${getPriceColor(cylPrice, allCylPrices)}`}>
                        {formatPrice(cylPrice)}
                      </TableCell>
                      <TableCell className={`text-right ${getPriceColor(mePrice, allMePrices)}`}>
                        {formatPrice(mePrice)}
                      </TableCell>
                      <TableCell className={`text-right ${getPriceColor(aePrice, allAePrices)}`}>
                        {formatPrice(aePrice)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No pricing data found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
