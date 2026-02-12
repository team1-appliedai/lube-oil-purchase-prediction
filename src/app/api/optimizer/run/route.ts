import { NextResponse } from 'next/server';
import {
  getVesselById,
  getConsumptionLogs,
  getVesselSchedule,
  getPrices,
  getSupplierForVessel,
} from '@/lib/db/data-access';
import { buildOptimizerInput } from '@/lib/optimizer/transform';
import { runOptimizer } from '@/lib/optimizer/engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      vesselId,
      windowSize,
      safetyBufferPct,
      tankOverrides,
      targetFillPct,
      opportunityDiscountPct,
      robTriggerMultiplier,
      deliveryChargeDefault,
      minOrderQtyMe,
      minOrderQtyAe,
    } = body;

    if (!vesselId) {
      return NextResponse.json({ error: 'vesselId is required' }, { status: 400 });
    }

    // Fetch all data in parallel
    const vessel = await getVesselById(vesselId);
    if (!vessel) {
      return NextResponse.json({ error: 'Vessel not found' }, { status: 404 });
    }

    const [consumptionRecords, schedule, prices, supplier] = await Promise.all([
      getConsumptionLogs(vesselId),
      getVesselSchedule(vessel.vesselCode, vessel.vesselName),
      getPrices(),
      getSupplierForVessel(vessel.vesselName),
    ]);

    if (!supplier) {
      return NextResponse.json(
        { error: `No supplier mapping found for vessel: ${vessel.vesselName}` },
        { status: 404 }
      );
    }

    if (schedule.length === 0) {
      return NextResponse.json(
        { error: 'No schedule found for this vessel' },
        { status: 404 }
      );
    }

    // Filter to future schedule ports only (from today onwards)
    const now = new Date();
    const futureSchedule = schedule.filter((sp) => {
      if (sp.arrivalDate) {
        const arr = new Date(sp.arrivalDate);
        if (!isNaN(arr.getTime()) && arr >= now) return true;
      }
      if (sp.departureDate) {
        const dep = new Date(sp.departureDate);
        if (!isNaN(dep.getTime()) && dep >= now) return true;
      }
      return false;
    });

    const effectiveSchedule = futureSchedule.length > 0 ? futureSchedule : schedule.slice(-20);

    // Transform and run optimizer
    const input = buildOptimizerInput({
      vessel,
      consumptionRecords,
      schedulePorts: effectiveSchedule,
      prices,
      supplier,
      windowSize,
      safetyBufferPct,
      tankOverrides,
      deliveryCharges: deliveryChargeDefault != null
        ? { defaultCharge: deliveryChargeDefault }
        : undefined,
      minOrderQty: (minOrderQtyMe != null || minOrderQtyAe != null)
        ? {
            meSystemOil: minOrderQtyMe,
            aeSystemOil: minOrderQtyAe,
          }
        : undefined,
      reorderConfig: (targetFillPct != null || opportunityDiscountPct != null || robTriggerMultiplier != null)
        ? {
            targetFillPct: targetFillPct != null ? targetFillPct / 100 : undefined,
            opportunityDiscountPct,
            robTriggerMultiplier,
          }
        : undefined,
    });

    const result = runOptimizer(input);

    return NextResponse.json({ result, oilGrades: input.oilGrades });
  } catch (error) {
    console.error('Optimizer run failed:', error);
    return NextResponse.json(
      { error: 'Optimizer run failed', details: String(error) },
      { status: 500 }
    );
  }
}
