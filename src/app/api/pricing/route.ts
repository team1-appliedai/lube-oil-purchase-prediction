import { NextResponse } from 'next/server';
import { getPrices } from '@/lib/db/data-access';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const supplier = url.searchParams.get('supplier') || undefined;
    const prices = await getPrices(supplier);
    return NextResponse.json(prices);
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
  }
}
