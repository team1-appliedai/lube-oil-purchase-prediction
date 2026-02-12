import { NextResponse } from 'next/server';
import { getVessels } from '@/lib/db/data-access';
import { cached } from '@/lib/db/cache';

export async function GET() {
  try {
    const vessels = await cached('vessels', () => getVessels(), 5 * 60 * 1000); // 5 min
    return NextResponse.json(vessels);
  } catch (error) {
    console.error('Failed to fetch vessels:', error);
    return NextResponse.json({ error: 'Failed to fetch vessels' }, { status: 500 });
  }
}
