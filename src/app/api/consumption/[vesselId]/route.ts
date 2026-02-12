import { NextResponse } from 'next/server';
import { getConsumptionLogs } from '@/lib/db/data-access';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ vesselId: string }> }
) {
  try {
    const { vesselId } = await params;
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const logs = await getConsumptionLogs(
      vesselId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to fetch consumption logs:', error);
    return NextResponse.json({ error: 'Failed to fetch consumption logs' }, { status: 500 });
  }
}
