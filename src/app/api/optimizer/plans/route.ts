import { NextResponse } from 'next/server';
import { getPurchasePlans, savePurchasePlan, updatePlanStatus } from '@/lib/db/data-access';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const vesselId = url.searchParams.get('vesselId') || undefined;
    const plans = await getPurchasePlans(vesselId);
    return NextResponse.json(plans);
  } catch (error) {
    console.error('Failed to fetch plans:', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = await savePurchasePlan(body);
    return NextResponse.json({ id });
  } catch (error) {
    console.error('Failed to save plan:', error);
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { planId, status } = body;
    if (!planId || !status) {
      return NextResponse.json({ error: 'planId and status required' }, { status: 400 });
    }
    await updatePlanStatus(planId, status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to update plan:', error);
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }
}
