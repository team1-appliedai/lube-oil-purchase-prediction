import { NextResponse } from 'next/server';
import { getOptimizerConfig, saveOptimizerConfig } from '@/lib/db/data-access';
import { cached, invalidate } from '@/lib/db/cache';

export async function GET() {
  try {
    const config = await cached('optimizer-config', () => getOptimizerConfig(), 5 * 60 * 1000);

    // Merge with env defaults
    const defaults = {
      tankCapacityCylinder: Number(process.env.TANK_CAPACITY_CYLINDER) || 100000,
      tankCapacityMeSystem: Number(process.env.TANK_CAPACITY_ME_SYSTEM) || 95000,
      tankCapacityAeSystem: Number(process.env.TANK_CAPACITY_AE_SYSTEM) || 20000,
      tankMaxFillPct: Number(process.env.TANK_MAX_FILL_PCT) || 85,
      minRobMeSystem: Number(process.env.MIN_ROB_ME_SYSTEM) || 30000,
      minRobAeSystem: Number(process.env.MIN_ROB_AE_SYSTEM) || 5000,
      cylinderMinRobDays: Number(process.env.CYLINDER_MIN_ROB_DAYS) || 60,
      windowSize: Number(process.env.OPTIMIZER_WINDOW_SIZE) || 5,
      safetyBufferPct: Number(process.env.OPTIMIZER_SAFETY_BUFFER_PCT) || 10,
      priceMtToLDivisor: Number(process.env.PRICE_MT_TO_L_DIVISOR) || 1111,
    };

    return NextResponse.json({ ...defaults, ...config });
  } catch (error) {
    console.error('Failed to fetch config:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await saveOptimizerConfig(body);
    invalidate('optimizer-config'); // bust cache on save
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to save config:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
