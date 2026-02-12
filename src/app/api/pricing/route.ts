import { NextResponse } from 'next/server';
import { getPrices } from '@/lib/db/data-access';
import { cached } from '@/lib/db/cache';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const supplier = url.searchParams.get('supplier') || undefined;
    const cacheKey = `prices:${supplier ?? 'all'}`;
    const prices = await cached(cacheKey, () => getPrices(supplier), 10 * 60 * 1000); // 10 min
    return NextResponse.json(prices);
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
  }
}
