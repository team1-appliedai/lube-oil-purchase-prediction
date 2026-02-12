import { NextResponse } from 'next/server';
import { getVessels } from '@/lib/db/data-access';

export async function GET() {
  try {
    const vessels = await getVessels();
    return NextResponse.json(vessels);
  } catch (error) {
    console.error('Failed to fetch vessels:', error);
    return NextResponse.json({ error: 'Failed to fetch vessels' }, { status: 500 });
  }
}
