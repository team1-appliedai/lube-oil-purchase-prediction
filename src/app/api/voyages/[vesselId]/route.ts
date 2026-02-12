import { NextResponse } from 'next/server';
import { getVesselById, getVesselSchedule } from '@/lib/db/data-access';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ vesselId: string }> }
) {
  try {
    const { vesselId } = await params;

    // First get the vessel to find vessel code
    const vessel = await getVesselById(vesselId);
    if (!vessel) {
      return NextResponse.json({ error: 'Vessel not found' }, { status: 404 });
    }

    const schedule = await getVesselSchedule(vessel.vesselCode, vessel.vesselName);
    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Failed to fetch voyages:', error);
    return NextResponse.json({ error: 'Failed to fetch voyages' }, { status: 500 });
  }
}
