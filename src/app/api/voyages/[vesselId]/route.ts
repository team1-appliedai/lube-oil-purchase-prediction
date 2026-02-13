import { NextResponse } from 'next/server';
import { getVesselById, getVesselSchedule } from '@/lib/db/data-access';
import { cached } from '@/lib/db/cache';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ vesselId: string }> }
) {
  try {
    const { vesselId } = await params;

    // First get the vessel to find vessel code
    const vessel = await cached(`vessel:${vesselId}`, () => getVesselById(vesselId), 5 * 60 * 1000);
    if (!vessel) {
      return NextResponse.json({ error: 'Vessel not found' }, { status: 404 });
    }

    const schedule = await cached(`voyages:${vesselId}`, () => getVesselSchedule(vessel.vesselCode, vessel.vesselName), 5 * 60 * 1000);
    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Failed to fetch voyages:', error);
    return NextResponse.json({ error: 'Failed to fetch voyages' }, { status: 500 });
  }
}
