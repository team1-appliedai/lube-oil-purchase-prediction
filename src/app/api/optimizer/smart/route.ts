import { NextResponse } from 'next/server';
import {
  getVesselById,
  getConsumptionLogs,
  getVesselSchedule,
  getPrices,
  getSupplierForVessel,
} from '@/lib/db/data-access';
import { buildOptimizerInput } from '@/lib/optimizer/transform';
import { runSmartOptimizer } from '@/lib/optimizer/smart-optimizer';
import type { StrategyName } from '@/lib/optimizer/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      vesselId,
      safetyBufferPct,
      tankOverrides,
      deliveryChargeDefault,
      minOrderQtyMe,
      minOrderQtyAe,
      strategies,
      topN,
    } = body;

    if (!vesselId) {
      return NextResponse.json({ error: 'vesselId is required' }, { status: 400 });
    }

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

    // Build base input with default params (grid will sweep over them)
    const input = buildOptimizerInput({
      vessel,
      consumptionRecords,
      schedulePorts: effectiveSchedule,
      prices,
      supplier,
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
    });

    const result = runSmartOptimizer(input, {
      strategies: strategies as StrategyName[] | undefined,
      topN: topN ?? 5,
      deliveryChargeDefault: deliveryChargeDefault ?? 1500,
    });

    return NextResponse.json({ result, oilGrades: input.oilGrades });
  } catch (error) {
    console.error('Smart optimizer run failed:', error);
    return NextResponse.json(
      { error: 'Smart optimizer run failed', details: String(error) },
      { status: 500 }
    );
  }
}
