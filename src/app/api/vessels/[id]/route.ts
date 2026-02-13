import { NextResponse } from 'next/server';
import { getVesselById } from '@/lib/db/data-access';
import { cached } from '@/lib/db/cache';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vessel = await cached(`vessel:${id}`, () => getVesselById(id), 5 * 60 * 1000);
    if (!vessel) {
      return NextResponse.json({ error: 'Vessel not found' }, { status: 404 });
    }
    return NextResponse.json(vessel);
  } catch (error) {
    console.error('Failed to fetch vessel:', error);
    return NextResponse.json({ error: 'Failed to fetch vessel' }, { status: 500 });
  }
}
