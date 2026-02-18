import type {
  OptimizerInput,
  OptimizerOutput,
  PortPlan,
  OilGradeCategory,
  PurchaseAction,
} from '../types';
import { computeBaseline, getPortPrice, computeAvailableDays } from '../engine';
import { computeDeliveryCost } from '../delivery-cost';

/**
 * Shared output builder for all strategies.
 *
 * Converts allocation maps into a full OptimizerOutput with:
 * - Proper ALERT actions when ROB will breach minRob and no purchase/price available
 * - Minimum order enforcement
 * - Correct ROB simulation
 */
export function buildOutputWithAlerts(
  input: OptimizerInput,
  allocations: Record<OilGradeCategory, Map<number, number>>,
  buffer: number,
  precomputedBaseline?: { cost: Record<OilGradeCategory, number>; deliveryCharges: number; purchaseEvents: number }
): OptimizerOutput {
  const { vessel, ports, currentRob, oilGrades, minOrderQty } = input;

  const rob: Record<OilGradeCategory, number> = { ...currentRob };
  const totalCost: Record<OilGradeCategory, number> = { cylinderOil: 0, meSystemOil: 0, aeSystemOil: 0 };
  let totalDeliveryCharges = 0;
  let purchaseEvents = 0;

  const portPlans: PortPlan[] = [];

  for (let i = 0; i < ports.length; i++) {
    const port = ports[i];
    let portHasPurchase = false;

    const portPlan: PortPlan = {
      portName: port.portName,
      portCode: port.portCode,
      country: port.country,
      arrivalDate: port.arrivalDate,
      departureDate: port.departureDate,
      seaDaysToNext: port.seaDaysToNext,
      deliveryCharge: 0,
      actions: {} as PortPlan['actions'],
    };

    for (const gradeConfig of oilGrades) {
      const grade = gradeConfig.category;
      const { avgDailyConsumption, tankConfig } = gradeConfig;
      const priceAtPort = getPortPrice(port, grade);
      const robOnArrival = rob[grade];
      const consumptionToNext = port.seaDaysToNext * avgDailyConsumption * buffer;

      let quantity = allocations[grade].get(i) ?? 0;

      // Enforce minimum order quantity
      const minQty = minOrderQty[grade];
      if (quantity > 0 && minQty > 0 && quantity < minQty) {
        const maxRoom = tankConfig.capacity - robOnArrival;
        if (maxRoom >= minQty) {
          quantity = minQty;
        }
      }

      const cost = quantity * (priceAtPort ?? 0);
      const robOnDeparture = robOnArrival + quantity;
      const robAtNextPort = robOnDeparture - consumptionToNext;

      rob[grade] = robAtNextPort;
      totalCost[grade] += cost;

      if (quantity > 0) portHasPurchase = true;

      // Determine action with proper ALERT detection
      let action: PurchaseAction;
      if (quantity > 0) {
        action = robOnArrival < tankConfig.minRob * 1.2 ? 'URGENT' : 'ORDER';
      } else if (robAtNextPort < tankConfig.minRob && (priceAtPort === null || priceAtPort <= 0)) {
        // ROB will breach minRob and no price available → ALERT
        action = 'ALERT';
      } else if (robOnArrival < tankConfig.minRob && (priceAtPort === null || priceAtPort <= 0)) {
        // Already below minRob and no price → ALERT
        action = 'ALERT';
      } else {
        action = 'SKIP';
      }

      portPlan.actions[grade] = {
        action,
        quantity,
        cost,
        pricePerLiter: priceAtPort ?? 0,
        robOnArrival,
        robOnDeparture,
        robAtNextPort,
      };
    }

    if (portHasPurchase) {
      // Sum total liters at this port for variable delivery cost
      let totalLitersAtPort = 0;
      for (const gradeConfig of oilGrades) {
        totalLitersAtPort += portPlan.actions[gradeConfig.category].quantity;
      }

      const availableDays = computeAvailableDays(port.arrivalDate);
      const breakdown = computeDeliveryCost(
        port.deliveryConfig,
        totalLitersAtPort,
        availableDays,
        port.deliveryCharge
      );
      portPlan.deliveryCharge = breakdown.total;
      portPlan.deliveryBreakdown = breakdown;
      totalDeliveryCharges += breakdown.total;
      purchaseEvents++;
    }

    portPlans.push(portPlan);
  }

  const baseline = precomputedBaseline ?? computeBaseline(input, buffer);

  const totalOptimized =
    totalCost.cylinderOil + totalCost.meSystemOil + totalCost.aeSystemOil + totalDeliveryCharges;
  const totalBaseline =
    baseline.cost.cylinderOil + baseline.cost.meSystemOil + baseline.cost.aeSystemOil + baseline.deliveryCharges;

  return {
    vesselId: vessel.vesselId,
    vesselName: vessel.vesselName,
    ports: portPlans,
    totalCost: {
      ...totalCost,
      total: totalCost.cylinderOil + totalCost.meSystemOil + totalCost.aeSystemOil,
    },
    totalDeliveryCharges,
    purchaseEvents,
    baselineCost: {
      ...baseline.cost,
      total: baseline.cost.cylinderOil + baseline.cost.meSystemOil + baseline.cost.aeSystemOil,
    },
    baselineDeliveryCharges: baseline.deliveryCharges,
    baselinePurchaseEvents: baseline.purchaseEvents,
    savings: {
      cylinderOil: baseline.cost.cylinderOil - totalCost.cylinderOil,
      meSystemOil: baseline.cost.meSystemOil - totalCost.meSystemOil,
      aeSystemOil: baseline.cost.aeSystemOil - totalCost.aeSystemOil,
      total: totalBaseline - totalOptimized,
      pct: totalBaseline > 0 ? ((totalBaseline - totalOptimized) / totalBaseline) * 100 : 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Validate a plan for safety: count how many ports have ROB below minRob for any grade.
 */
export function validatePlanSafety(
  output: OptimizerOutput,
  input: OptimizerInput
): { safe: boolean; robBreaches: number } {
  let robBreaches = 0;

  for (const portPlan of output.ports) {
    for (const gradeConfig of input.oilGrades) {
      const grade = gradeConfig.category;
      const action = portPlan.actions[grade];
      const minRob = gradeConfig.tankConfig.minRob;

      // Check ROB at next port
      if (action.robAtNextPort < minRob && portPlan.seaDaysToNext > 0) {
        robBreaches++;
      }
      // Check if ROB goes negative (critical)
      if (action.robAtNextPort < 0) {
        robBreaches += 5; // heavily penalize negative ROB
      }
    }
  }

  return { safe: robBreaches === 0, robBreaches };
}
