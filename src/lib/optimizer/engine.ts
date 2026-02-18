import type {
  OptimizerInput,
  OptimizerOutput,
  PortPlan,
  PurchaseAction,
  OilGradeCategory,
  OilGradeConfig,
  PortStop,
  MinOrderConfig,
  ReorderConfig,
} from './types';
import { computeDeliveryCost } from './delivery-cost';

/**
 * Pure optimizer — skip-by-default with urgency/opportunity triggers.
 *
 * For each port, for each grade:
 * 1. Compute route average price
 * 2. Check urgency: ROB will drop below minRob * trigger before next priced port
 * 3. Check opportunity: price is X% below route average
 * 4. Otherwise SKIP
 * 5. If ROB will breach minRob and no price available -> ALERT
 *
 * Delivery charge is incurred once per port if ANY grade triggers ORDER or URGENT.
 */
export function runOptimizer(input: OptimizerInput): OptimizerOutput {
  const {
    vessel,
    ports,
    currentRob,
    oilGrades,
    safetyBufferPct,
    minOrderQty,
    reorderConfig,
  } = input;

  const { targetFillPct, robTriggerMultiplier, opportunityDiscountPct } = reorderConfig;

  // Track ROB through the voyage for each grade
  const rob: Record<OilGradeCategory, number> = {
    cylinderOil: currentRob.cylinderOil,
    meSystemOil: currentRob.meSystemOil,
    aeSystemOil: currentRob.aeSystemOil,
  };

  // Compute route average price per grade (non-null prices only)
  const routeAvgPrice = computeRouteAveragePrice(ports, oilGrades);

  const portPlans: PortPlan[] = [];
  const totalCost: Record<OilGradeCategory, number> = { cylinderOil: 0, meSystemOil: 0, aeSystemOil: 0 };
  let totalDeliveryCharges = 0;
  let purchaseEvents = 0;

  const buffer = 1 + safetyBufferPct / 100;

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
      const { tankConfig, avgDailyConsumption } = gradeConfig;
      const minRob = tankConfig.minRob;
      const targetFill = tankConfig.capacity * targetFillPct;
      const robOnArrival = rob[grade];
      const consumptionToNext = port.seaDaysToNext * avgDailyConsumption * buffer;
      const priceAtPort = getPortPrice(port, grade);
      const minQty = minOrderQty[grade];

      // Determine action
      const { action, quantity } = determineAction({
        robOnArrival,
        minRob,
        targetFill,
        consumptionToNext,
        priceAtPort,
        routeAvgPrice: routeAvgPrice[grade],
        opportunityDiscountPct,
        robTriggerMultiplier,
        minQty,
        tankCapacity: tankConfig.capacity,
        avgDailyConsumption,
        buffer,
        portsAhead: ports.slice(i + 1),
        grade,
      });

      const cost = quantity * (priceAtPort ?? 0);
      const robOnDeparture = robOnArrival + quantity;
      const robAtNextPort = robOnDeparture - consumptionToNext;

      rob[grade] = robAtNextPort;
      totalCost[grade] += cost;

      if (quantity > 0) {
        portHasPurchase = true;
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

    // Delivery charge — once per port if any grade was purchased
    if (portHasPurchase) {
      // Sum total liters purchased at this port across all grades
      let totalLitersAtPort = 0;
      for (const gradeConfig of oilGrades) {
        totalLitersAtPort += portPlan.actions[gradeConfig.category].quantity;
      }

      // Compute days between now and arrival for urgency check
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

  // Compute baseline (reactive superintendent)
  const baseline = computeBaseline(input, buffer);

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

// ============================================================
// Internal helpers
// ============================================================

export function getPortPrice(port: PortStop, grade: OilGradeCategory): number | null {
  return port.prices[grade];
}

export function computeRouteAveragePrice(
  ports: PortStop[],
  oilGrades: OilGradeConfig[]
): Record<OilGradeCategory, number> {
  const result: Record<OilGradeCategory, number> = {
    cylinderOil: 0,
    meSystemOil: 0,
    aeSystemOil: 0,
  };

  for (const gradeConfig of oilGrades) {
    const grade = gradeConfig.category;
    let sum = 0;
    let count = 0;
    for (const port of ports) {
      const price = getPortPrice(port, grade);
      if (price !== null && price > 0) {
        sum += price;
        count++;
      }
    }
    result[grade] = count > 0 ? sum / count : 0;
  }

  return result;
}

/**
 * Find the index of the next port (after current) that has a price for this grade.
 * Returns -1 if none found.
 */
function findNextPricedPortIndex(
  portsAhead: PortStop[],
  grade: OilGradeCategory
): number {
  for (let j = 0; j < portsAhead.length; j++) {
    const price = getPortPrice(portsAhead[j], grade);
    if (price !== null && price > 0) return j;
  }
  return -1;
}

/**
 * Compute total consumption from current port to a port N legs ahead.
 */
function consumptionToPortN(
  currentPort: PortStop,
  portsAhead: PortStop[],
  n: number,
  avgDailyConsumption: number,
  buffer: number
): number {
  let total = currentPort.seaDaysToNext * avgDailyConsumption * buffer;
  for (let k = 0; k < n && k < portsAhead.length; k++) {
    total += portsAhead[k].seaDaysToNext * avgDailyConsumption * buffer;
  }
  return total;
}

interface ActionParams {
  robOnArrival: number;
  minRob: number;
  targetFill: number;
  consumptionToNext: number;
  priceAtPort: number | null;
  routeAvgPrice: number;
  opportunityDiscountPct: number;
  robTriggerMultiplier: number;
  minQty: number;
  tankCapacity: number;
  avgDailyConsumption: number;
  buffer: number;
  portsAhead: PortStop[];
  grade: OilGradeCategory;
}

function determineAction(params: ActionParams): {
  action: PurchaseAction;
  quantity: number;
} {
  const {
    robOnArrival,
    minRob,
    targetFill,
    consumptionToNext,
    priceAtPort,
    routeAvgPrice,
    opportunityDiscountPct,
    robTriggerMultiplier,
    minQty,
    tankCapacity,
    avgDailyConsumption,
    buffer,
    portsAhead,
    grade,
  } = params;

  const robAtNextIfNoBuy = robOnArrival - consumptionToNext;
  const urgencyThreshold = minRob * robTriggerMultiplier;

  // No price available at this port
  if (priceAtPort === null || priceAtPort <= 0) {
    // Will ROB breach minRob before next priced port?
    const nextPricedIdx = findNextPricedPortIndex(portsAhead, grade);
    if (nextPricedIdx === -1) {
      // No future prices — alert if ROB below threshold
      if (robAtNextIfNoBuy < minRob) {
        return { action: 'ALERT', quantity: 0 };
      }
    } else {
      // Check if ROB will drop below minRob before reaching next priced port
      // Need a dummy PortStop-like structure; use portsAhead directly
      let cumulativeConsumption = consumptionToNext;
      for (let k = 0; k < nextPricedIdx; k++) {
        cumulativeConsumption += portsAhead[k].seaDaysToNext * avgDailyConsumption * buffer;
      }
      if (robOnArrival - cumulativeConsumption < minRob) {
        return { action: 'ALERT', quantity: 0 };
      }
    }
    return { action: 'SKIP', quantity: 0 };
  }

  // Full-voyage safety guard: if vessel can complete the entire known schedule
  // above minRob without any purchases, suppress urgency — only opportunity buys.
  const voyageSafe = isVoyageSafe(
    robOnArrival, minRob, consumptionToNext, portsAhead, avgDailyConsumption, buffer
  );

  // Check URGENCY: only if voyage is NOT safe for this grade
  const isUrgent = !voyageSafe && checkUrgency(
    robOnArrival,
    urgencyThreshold,
    consumptionToNext,
    portsAhead,
    grade,
    avgDailyConsumption,
    buffer
  );

  // Check OPPORTUNITY: is price attractively below route average?
  const isOpportunity =
    routeAvgPrice > 0 &&
    priceAtPort <= routeAvgPrice * (1 - opportunityDiscountPct / 100);

  if (isUrgent) {
    // URGENT: buy up to target fill
    const rawQty = Math.max(0, targetFill - robOnArrival);
    const qty = enforceMinOrder(rawQty, minQty, tankCapacity, robOnArrival, true);
    return { action: 'URGENT', quantity: qty };
  }

  if (isOpportunity) {
    // OPPORTUNITY: buy up to target fill, but only if meets minimum order
    const rawQty = Math.max(0, targetFill - robOnArrival);
    const qty = enforceMinOrder(rawQty, minQty, tankCapacity, robOnArrival, false);
    if (qty <= 0) {
      return { action: 'SKIP', quantity: 0 };
    }
    return { action: 'ORDER', quantity: qty };
  }

  // Default: SKIP
  return { action: 'SKIP', quantity: 0 };
}

/**
 * Check if ROB will drop below urgency threshold before reaching the next
 * port that has a price for this grade.
 */
function checkUrgency(
  robOnArrival: number,
  urgencyThreshold: number,
  consumptionToNext: number,
  portsAhead: PortStop[],
  grade: OilGradeCategory,
  avgDailyConsumption: number,
  buffer: number
): boolean {
  // If we can't even make it to the next port above threshold, urgent
  if (robOnArrival - consumptionToNext < urgencyThreshold) {
    return true;
  }

  // Check cumulative consumption to next priced port
  let cumulativeConsumption = consumptionToNext;
  for (let k = 0; k < portsAhead.length; k++) {
    const price = getPortPrice(portsAhead[k], grade);
    if (price !== null && price > 0) {
      // Found next priced port — check if we can reach it
      return robOnArrival - cumulativeConsumption < urgencyThreshold;
    }
    cumulativeConsumption += portsAhead[k].seaDaysToNext * avgDailyConsumption * buffer;
  }

  // No future priced ports — check if ROB stays above minRob for remaining voyage
  return robOnArrival - cumulativeConsumption < urgencyThreshold;
}

/**
 * Full-voyage safety guard: check whether the vessel can complete the entire
 * remaining schedule above minRob for this grade without any purchases.
 * If yes, urgency is suppressed — only opportunity buys are allowed.
 */
function isVoyageSafe(
  robOnArrival: number,
  minRob: number,
  consumptionToNext: number,
  portsAhead: PortStop[],
  avgDailyConsumption: number,
  buffer: number
): boolean {
  let totalRemainingConsumption = consumptionToNext;
  for (const port of portsAhead) {
    totalRemainingConsumption += port.seaDaysToNext * avgDailyConsumption * buffer;
  }
  const voyageEndRob = robOnArrival - totalRemainingConsumption;
  return voyageEndRob >= minRob;
}

/**
 * Enforce minimum order quantity.
 * - If rawQty >= minQty, return rawQty
 * - If rawQty > 0 but < minQty and tank has room, round up to minQty
 * - If opportunity (not urgent) and can't meet min, return 0
 */
function enforceMinOrder(
  rawQty: number,
  minQty: number,
  tankCapacity: number,
  robOnArrival: number,
  isUrgent: boolean
): number {
  if (rawQty <= 0) return 0;
  if (minQty <= 0) return rawQty; // No minimum for this grade (e.g. cylinder oil)

  if (rawQty >= minQty) return rawQty;

  // Below minimum — can we round up?
  const maxPossible = tankCapacity - robOnArrival;
  if (maxPossible >= minQty) {
    if (isUrgent) {
      return minQty; // Round up for urgent orders
    }
    // For opportunity orders, skip if we'd be ordering more than we need
    return 0;
  }

  // Tank doesn't have room for minimum — urgent buys whatever fits
  if (isUrgent) {
    return rawQty;
  }

  return 0;
}

// ============================================================
// Baseline: Reactive superintendent model
// ============================================================

/**
 * Simulates a reactive superintendent who buys only when ROB drops below
 * 1.0x minRob, fills to targetFillPct, at whatever port is available.
 * This represents the real alternative to the optimizer.
 */
export function computeBaseline(
  input: OptimizerInput,
  buffer: number
): {
  cost: Record<OilGradeCategory, number>;
  deliveryCharges: number;
  purchaseEvents: number;
} {
  const { ports, currentRob, oilGrades, reorderConfig } = input;
  const { targetFillPct } = reorderConfig;

  const rob: Record<OilGradeCategory, number> = {
    cylinderOil: currentRob.cylinderOil,
    meSystemOil: currentRob.meSystemOil,
    aeSystemOil: currentRob.aeSystemOil,
  };

  const cost: Record<OilGradeCategory, number> = { cylinderOil: 0, meSystemOil: 0, aeSystemOil: 0 };
  let deliveryCharges = 0;
  let purchaseEvents = 0;

  for (let i = 0; i < ports.length; i++) {
    const port = ports[i];
    let portHasPurchase = false;
    let totalLitersAtPort = 0;

    for (const gradeConfig of oilGrades) {
      const grade = gradeConfig.category;
      const { tankConfig, avgDailyConsumption } = gradeConfig;
      const minRob = tankConfig.minRob;
      const targetFill = tankConfig.capacity * targetFillPct;
      const consumptionToNext = port.seaDaysToNext * avgDailyConsumption * buffer;
      const robOnArrival = rob[grade];
      const priceAtPort = getPortPrice(port, grade);

      // Reactive: buy when ROB will drop below minRob
      const robAtNextIfNoBuy = robOnArrival - consumptionToNext;
      const needsToBuy = robAtNextIfNoBuy < minRob;

      if (needsToBuy && priceAtPort !== null && priceAtPort > 0) {
        const qty = Math.max(0, targetFill - robOnArrival);
        cost[grade] += qty * priceAtPort;
        rob[grade] = robOnArrival + qty - consumptionToNext;
        portHasPurchase = true;
        totalLitersAtPort += qty;
      } else {
        rob[grade] = robAtNextIfNoBuy;
      }
    }

    if (portHasPurchase) {
      const availableDays = computeAvailableDays(port.arrivalDate);
      const breakdown = computeDeliveryCost(
        port.deliveryConfig,
        totalLitersAtPort,
        availableDays,
        port.deliveryCharge
      );
      deliveryCharges += breakdown.total;
      purchaseEvents++;
    }
  }

  return { cost, deliveryCharges, purchaseEvents };
}

/**
 * Compute working days between now and a port arrival date.
 * Returns -1 if arrival date is invalid (treated as unknown/plenty of time).
 */
export function computeAvailableDays(arrivalDate: string): number {
  if (!arrivalDate) return -1;
  const arrival = new Date(arrivalDate);
  if (isNaN(arrival.getTime())) return -1;
  const now = new Date();
  const diffMs = arrival.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  // Approximate working days as 5/7 of calendar days
  return Math.max(0, Math.floor(diffDays * (5 / 7)));
}
