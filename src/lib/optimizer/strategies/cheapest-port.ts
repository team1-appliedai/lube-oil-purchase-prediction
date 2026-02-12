import type {
  OptimizerInput,
  OptimizerOutput,
  OilGradeCategory,
  OilGradeConfig,
  PortStop,
} from '../types';
import { getPortPrice } from '../engine';
import { buildOutputWithAlerts } from './build-output';
import { consolidateDeliveries } from './consolidate-deliveries';

/**
 * Cheapest-Port Strategy — backward-planning algorithm.
 *
 * For each oil grade:
 *   1. Simulate forward WITHOUT buying → find where ROB breaches minROB ("breach points")
 *   2. For each breach, define a "need window" = [last purchase port .. breach port]
 *   3. Within window, pick the port with the LOWEST price → allocate purchase there
 *   4. Quantity = min(targetFill - arrivalROB, tankCapacity - arrivalROB)
 *   5. After allocation, re-simulate to find next breach
 *
 * Cross-grade consolidation pass:
 *   - Find ports with deliveries already allocated
 *   - Check if non-allocated grades at those ports could piggyback
 *   - Accept piggyback if: avoided future delivery cost > extra oil cost from price diff
 */
export function runCheapestPortStrategy(input: OptimizerInput): OptimizerOutput {
  const { vessel, ports, currentRob, oilGrades, safetyBufferPct, reorderConfig } = input;
  const { targetFillPct } = reorderConfig;
  const buffer = 1 + safetyBufferPct / 100;

  // Per-grade purchase allocations: portIndex → quantity
  const allocations: Record<OilGradeCategory, Map<number, number>> = {
    cylinderOil: new Map(),
    meSystemOil: new Map(),
    aeSystemOil: new Map(),
  };

  // Phase 1: Independent grade planning
  for (const gradeConfig of oilGrades) {
    const grade = gradeConfig.category;
    const { tankConfig, avgDailyConsumption } = gradeConfig;
    const minRob = tankConfig.minRob;
    const targetFill = tankConfig.capacity * targetFillPct;

    planGrade(
      grade,
      ports,
      currentRob[grade],
      minRob,
      targetFill,
      tankConfig.capacity,
      avgDailyConsumption,
      buffer,
      allocations[grade]
    );
  }

  // Phase 2: Cross-grade consolidation
  consolidateAcrossGrades(
    ports,
    oilGrades,
    currentRob,
    allocations,
    targetFillPct,
    buffer
  );

  // Phase 3: Consolidate delivery events (merge nearby/unworthy deliveries)
  consolidateDeliveries(input, allocations, buffer);

  // Phase 4: Build OptimizerOutput from allocations (with ALERT detection)
  return buildOutputWithAlerts(input, allocations, buffer);
}

/**
 * Plan purchases for a single grade using the cheapest-port-in-window approach.
 */
function planGrade(
  grade: OilGradeCategory,
  ports: PortStop[],
  startingRob: number,
  minRob: number,
  targetFill: number,
  tankCapacity: number,
  avgDailyConsumption: number,
  buffer: number,
  allocations: Map<number, number>
): void {
  let lastPurchaseIdx = -1;

  // Iterate: find breaches, allocate purchases, re-simulate
  for (let iteration = 0; iteration < ports.length; iteration++) {
    // Simulate forward with current allocations
    const robAtPort = simulateRob(
      grade,
      ports,
      startingRob,
      avgDailyConsumption,
      buffer,
      allocations
    );

    // Find next breach point (ROB < minRob at any port)
    let breachIdx = -1;
    for (let i = 0; i < ports.length; i++) {
      // Check ROB at next port (after consumption from port i)
      const consumption = ports[i].seaDaysToNext * avgDailyConsumption * buffer;
      const robAfterTravel = robAtPort[i] - consumption;
      if (robAfterTravel < minRob && i < ports.length - 1) {
        breachIdx = i + 1; // breach happens arriving at port i+1
        break;
      }
      // Also check if ROB at this port itself is below minRob
      if (robAtPort[i] < minRob && i > 0) {
        breachIdx = i;
        break;
      }
    }

    if (breachIdx === -1) break; // no more breaches, we're done

    // Define need window: [lastPurchaseIdx+1 .. breachIdx]
    const windowStart = Math.max(0, lastPurchaseIdx + 1);
    const windowEnd = breachIdx;

    // Find cheapest priced port in window
    let bestIdx = -1;
    let bestPrice = Infinity;
    for (let i = windowStart; i <= windowEnd && i < ports.length; i++) {
      const price = getPortPrice(ports[i], grade);
      if (price !== null && price > 0 && price < bestPrice) {
        bestPrice = price;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) {
      // No priced port in window — extend window forward
      for (let i = windowEnd + 1; i < ports.length; i++) {
        const price = getPortPrice(ports[i], grade);
        if (price !== null && price > 0) {
          bestIdx = i;
          break;
        }
      }
      if (bestIdx === -1) break; // no priced ports at all
    }

    // Allocate purchase at bestIdx
    const robAtBest = robAtPort[bestIdx];
    const rawQty = Math.max(0, targetFill - robAtBest);
    const maxRoom = tankCapacity - robAtBest;
    const qty = Math.min(rawQty, maxRoom);

    if (qty > 0) {
      const existing = allocations.get(bestIdx) ?? 0;
      allocations.set(bestIdx, existing + qty);
      lastPurchaseIdx = bestIdx;
    } else {
      break; // can't buy more, stop
    }
  }
}

/**
 * Simulate ROB at each port given current allocations.
 * Returns array of ROB values at arrival of each port.
 */
function simulateRob(
  grade: OilGradeCategory,
  ports: PortStop[],
  startingRob: number,
  avgDailyConsumption: number,
  buffer: number,
  allocations: Map<number, number>
): number[] {
  const robAtPort: number[] = [];
  let rob = startingRob;

  for (let i = 0; i < ports.length; i++) {
    robAtPort.push(rob);

    // Add any purchase at this port
    const purchase = allocations.get(i) ?? 0;
    rob += purchase;

    // Subtract consumption to next port
    const consumption = ports[i].seaDaysToNext * avgDailyConsumption * buffer;
    rob -= consumption;
  }

  return robAtPort;
}

/**
 * Cross-grade consolidation: if a port already has a delivery for one grade,
 * check if other grades could piggyback to avoid a separate delivery later.
 */
function consolidateAcrossGrades(
  ports: PortStop[],
  oilGrades: OilGradeConfig[],
  currentRob: Record<OilGradeCategory, number>,
  allocations: Record<OilGradeCategory, Map<number, number>>,
  targetFillPct: number,
  buffer: number
): void {
  // Find ports that already have at least one grade purchasing
  const purchasePorts = new Set<number>();
  for (const grade of oilGrades) {
    for (const [idx] of allocations[grade.category]) {
      purchasePorts.add(idx);
    }
  }

  for (const portIdx of purchasePorts) {
    for (const gradeConfig of oilGrades) {
      const grade = gradeConfig.category;
      // Skip if this grade already buys at this port
      if (allocations[grade].has(portIdx)) continue;

      // Check if this grade has a price at this port
      const price = getPortPrice(ports[portIdx], grade);
      if (price === null || price <= 0) continue;

      // Check if this grade has a future purchase that incurs its own delivery
      const futureDeliveryIdx = findNextSoloPurchase(
        grade,
        portIdx + 1,
        allocations,
        oilGrades,
        ports
      );
      if (futureDeliveryIdx === -1) continue;

      // Compare: piggybacking cost vs doing nothing
      // Piggyback: buy some qty at this port's price, potentially reduce future buy
      const futurePrice = getPortPrice(ports[futureDeliveryIdx], grade) ?? 0;
      const deliveryCost = ports[futureDeliveryIdx].deliveryCharge;

      // Only piggyback if price here is not much worse than future price
      // and the saved delivery cost justifies it
      const priceDiff = price - futurePrice; // positive means this port is more expensive
      const { tankConfig, avgDailyConsumption } = gradeConfig;
      const targetFill = tankConfig.capacity * targetFillPct;

      // Simulate ROB at this port for this grade
      const robAtPort = simulateRob(
        grade,
        ports,
        currentRob[grade],
        avgDailyConsumption,
        buffer,
        allocations[grade]
      );
      const robHere = robAtPort[portIdx];
      const rawQty = Math.max(0, targetFill - robHere);
      const maxRoom = tankConfig.capacity - robHere;
      const qty = Math.min(rawQty, maxRoom);

      if (qty <= 0) continue;

      // Would piggybacking save money overall?
      // Extra oil cost = qty * priceDiff (could be negative if this port is cheaper)
      // Saved delivery = deliveryCost (only if future purchase would be the sole grade there)
      const extraOilCost = qty * priceDiff;
      if (extraOilCost < deliveryCost * 0.8) {
        // Piggyback is worth it — add purchase here and reduce/remove future purchase
        allocations[grade].set(portIdx, qty);

        // Reduce future purchase by what we just bought (or remove entirely)
        const futureQty = allocations[grade].get(futureDeliveryIdx) ?? 0;
        const newFutureQty = Math.max(0, futureQty - qty);
        if (newFutureQty <= 0) {
          allocations[grade].delete(futureDeliveryIdx);
        } else {
          allocations[grade].set(futureDeliveryIdx, newFutureQty);
        }
      }
    }
  }
}

/**
 * Find the next port where only this grade is purchasing (solo delivery).
 */
function findNextSoloPurchase(
  grade: OilGradeCategory,
  startIdx: number,
  allocations: Record<OilGradeCategory, Map<number, number>>,
  oilGrades: OilGradeConfig[],
  ports: PortStop[]
): number {
  for (let i = startIdx; i < ports.length; i++) {
    if (!allocations[grade].has(i)) continue;

    // Check if other grades also buy here
    const otherGradesBuyHere = oilGrades.some(
      (g) => g.category !== grade && allocations[g.category].has(i)
    );
    if (!otherGradesBuyHere) return i; // solo delivery
  }
  return -1;
}

