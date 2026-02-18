import type {
  OptimizerInput,
  OptimizerOutput,
  OilGradeCategory,
  OilGradeConfig,
  PortStop,
} from '../types';
import { getPortPrice, computeAvailableDays } from '../engine';
import { computeDeliveryCost } from '../delivery-cost';

/**
 * Delivery Consolidation Post-Processor.
 *
 * Implements the Technical Superintendent's mindset:
 *
 * 1. **Delivery-Worthiness**: "If I'm paying $5,000 delivery, I want at least
 *    $10,000 worth of oil. Don't pay $5,000 delivery for $1,600 of AE oil."
 *    → If oil value at a port < deliveryCharge × minRatio, try to move those
 *      purchases to a nearby port that already has a delivery.
 *
 * 2. **Proximity Consolidation**: "Hamburg Jun 8 and Le Havre Jun 12 are 4 days
 *    apart — why pay $5,000 delivery at each? Combine them."
 *    → If two delivery events are within maxMergeSeaDays of each other, merge
 *      the smaller into the larger to eliminate a delivery charge.
 *
 * Operates on allocation maps (portIndex → quantity per grade).
 * Mutates allocations in place. Always verifies ROB safety before any change.
 */
export function consolidateDeliveries(
  input: OptimizerInput,
  allocations: Record<OilGradeCategory, Map<number, number>>,
  buffer: number
): void {
  const { ports, oilGrades } = input;

  let changed = true;
  let iterations = 0;

  while (changed && iterations < 10) {
    changed = false;
    iterations++;

    const deliveryPorts = getDeliveryPorts(allocations, oilGrades);
    if (deliveryPorts.length <= 1) break;

    // --- Pass A: Eliminate unworthy deliveries ---
    // Find the delivery with the worst oil-value-to-delivery-charge ratio
    let worstPortIdx = -1;
    let worstRatio = Infinity;

    for (const portIdx of deliveryPorts) {
      const oilValue = computeOilValue(portIdx, allocations, ports, oilGrades);
      const totalLiters = computeTotalLitersAtPort(portIdx, allocations, oilGrades);
      const availableDays = computeAvailableDays(ports[portIdx].arrivalDate);
      const breakdown = computeDeliveryCost(
        ports[portIdx].deliveryConfig,
        totalLiters,
        availableDays,
        ports[portIdx].deliveryCharge
      );
      const dc = breakdown.total;
      if (dc <= 0) continue; // free delivery, always worth it
      const ratio = oilValue / dc;

      if (ratio < worstRatio) {
        worstRatio = ratio;
        worstPortIdx = portIdx;
      }
    }

    // If worst ratio >= 2.0, all deliveries are worthwhile — skip to proximity
    if (worstPortIdx >= 0 && worstRatio < 2.0) {
      // Try to merge this port's purchases into the nearest delivery port
      const otherPorts = deliveryPorts
        .filter((p) => p !== worstPortIdx)
        .map((p) => ({
          portIdx: p,
          seaDays: computeSeaDaysBetween(ports, Math.min(p, worstPortIdx), Math.max(p, worstPortIdx)),
        }))
        .sort((a, b) => a.seaDays - b.seaDays);

      for (const candidate of otherPorts) {
        if (tryFullMerge(worstPortIdx, candidate.portIdx, allocations, input, buffer)) {
          changed = true;
          break;
        }
      }
    }

    // --- Pass B: Proximity merge (consecutive delivery ports close together) ---
    if (!changed) {
      const currentDeliveryPorts = getDeliveryPorts(allocations, oilGrades);

      for (let i = 0; i < currentDeliveryPorts.length - 1; i++) {
        const portA = currentDeliveryPorts[i];
        const portB = currentDeliveryPorts[i + 1];
        const seaDays = computeSeaDaysBetween(ports, portA, portB);

        // Only merge ports within 10 sea-days of each other
        if (seaDays > 10) continue;

        const oilValueA = computeOilValue(portA, allocations, ports, oilGrades);
        const oilValueB = computeOilValue(portB, allocations, ports, oilGrades);

        // Try merging the smaller value port into the larger value port
        const [fromPort, toPort] =
          oilValueA <= oilValueB ? [portA, portB] : [portB, portA];
        const fromLiters = computeTotalLitersAtPort(fromPort, allocations, oilGrades);
        const fromAvailDays = computeAvailableDays(ports[fromPort].arrivalDate);
        const fromBreakdown = computeDeliveryCost(
          ports[fromPort].deliveryConfig, fromLiters, fromAvailDays, ports[fromPort].deliveryCharge
        );
        const savedDC = fromBreakdown.total;

        // Only merge if the extra oil cost is less than the saved delivery charge
        const extraCost = computeMergeExtraCost(fromPort, toPort, allocations, ports, oilGrades);
        if (extraCost === null) continue; // can't merge (no price at destination)

        if (extraCost < savedDC * 0.9) {
          if (tryFullMerge(fromPort, toPort, allocations, input, buffer)) {
            changed = true;
            break; // restart the iteration
          }
        }
      }
    }
  }
}

/**
 * Extract allocation maps from an OptimizerOutput.
 * Useful for applying consolidation to strategies that produce output directly
 * (like grid search or delivery-aware's base optimizer run).
 */
export function extractAllocations(
  output: OptimizerOutput,
  oilGrades: OilGradeConfig[]
): Record<OilGradeCategory, Map<number, number>> {
  const allocations: Record<OilGradeCategory, Map<number, number>> = {
    cylinderOil: new Map(),
    meSystemOil: new Map(),
    aeSystemOil: new Map(),
  };

  for (let i = 0; i < output.ports.length; i++) {
    for (const gradeConfig of oilGrades) {
      const grade = gradeConfig.category;
      const qty = output.ports[i].actions[grade].quantity;
      if (qty > 0) {
        allocations[grade].set(i, qty);
      }
    }
  }

  return allocations;
}

// ───────────────────────── Internal helpers ─────────────────────────

/** Get sorted list of port indices that have any purchase allocation. */
function getDeliveryPorts(
  allocations: Record<OilGradeCategory, Map<number, number>>,
  oilGrades: OilGradeConfig[]
): number[] {
  const ports = new Set<number>();
  for (const gradeConfig of oilGrades) {
    for (const [idx, qty] of allocations[gradeConfig.category]) {
      if (qty > 0) ports.add(idx);
    }
  }
  return Array.from(ports).sort((a, b) => a - b);
}

/** Total liters purchased at a port across all grades. */
function computeTotalLitersAtPort(
  portIdx: number,
  allocations: Record<OilGradeCategory, Map<number, number>>,
  oilGrades: OilGradeConfig[]
): number {
  let total = 0;
  for (const gradeConfig of oilGrades) {
    total += allocations[gradeConfig.category].get(portIdx) ?? 0;
  }
  return total;
}

/** Total oil purchase value (qty × price) at a port across all grades. */
function computeOilValue(
  portIdx: number,
  allocations: Record<OilGradeCategory, Map<number, number>>,
  ports: PortStop[],
  oilGrades: OilGradeConfig[]
): number {
  let total = 0;
  for (const gradeConfig of oilGrades) {
    const grade = gradeConfig.category;
    const qty = allocations[grade].get(portIdx) ?? 0;
    if (qty <= 0) continue;
    const price = getPortPrice(ports[portIdx], grade) ?? 0;
    total += qty * price;
  }
  return total;
}

/** Sea-days between two port indices. */
function computeSeaDaysBetween(ports: PortStop[], fromIdx: number, toIdx: number): number {
  let days = 0;
  for (let i = fromIdx; i < toIdx && i < ports.length; i++) {
    days += ports[i].seaDaysToNext;
  }
  return days;
}

/**
 * Compute the extra oil cost of moving all purchases from fromPort to toPort.
 * Returns null if any grade can't be purchased at toPort.
 * Returns the total price difference (positive = toPort is more expensive).
 */
function computeMergeExtraCost(
  fromPort: number,
  toPort: number,
  allocations: Record<OilGradeCategory, Map<number, number>>,
  ports: PortStop[],
  oilGrades: OilGradeConfig[]
): number | null {
  let extraCost = 0;

  for (const gradeConfig of oilGrades) {
    const grade = gradeConfig.category;
    const qty = allocations[grade].get(fromPort);
    if (!qty || qty <= 0) continue;

    const priceAtDest = getPortPrice(ports[toPort], grade);
    if (priceAtDest === null || priceAtDest <= 0) return null;

    const priceAtSource = getPortPrice(ports[fromPort], grade) ?? 0;
    extraCost += (priceAtDest - priceAtSource) * qty;
  }

  return extraCost;
}

/**
 * Attempt to move ALL purchases from fromPort to toPort.
 * Verifies: (a) destination has price for all grades being moved,
 *           (b) tank capacity not exceeded, (c) ROB stays above minRob.
 * Mutates allocations in place if successful.
 * Returns true if merge was applied.
 */
function tryFullMerge(
  fromPort: number,
  toPort: number,
  allocations: Record<OilGradeCategory, Map<number, number>>,
  input: OptimizerInput,
  buffer: number
): boolean {
  const { ports, oilGrades } = input;

  // Collect grades to move
  const gradesToMove: { grade: OilGradeCategory; qty: number }[] = [];

  for (const gradeConfig of oilGrades) {
    const grade = gradeConfig.category;
    const qty = allocations[grade].get(fromPort);
    if (!qty || qty <= 0) continue;

    // Check destination has a price for this grade
    const priceAtDest = getPortPrice(ports[toPort], grade);
    if (priceAtDest === null || priceAtDest <= 0) {
      return false; // can't buy this grade at destination
    }

    gradesToMove.push({ grade, qty });
  }

  if (gradesToMove.length === 0) return false;

  // Create temporary allocations and apply the merge
  const temp = cloneAllocations(allocations);
  for (const { grade, qty } of gradesToMove) {
    temp[grade].delete(fromPort);
    const existing = temp[grade].get(toPort) ?? 0;
    temp[grade].set(toPort, existing + qty);
  }

  // Verify safety and capacity
  if (!verifyAllocations(temp, input, buffer)) {
    // Full merge failed — try partial merge (move what fits)
    return tryPartialMerge(fromPort, toPort, gradesToMove, allocations, input, buffer);
  }

  // Apply merge to real allocations
  for (const { grade, qty } of gradesToMove) {
    allocations[grade].delete(fromPort);
    const existing = allocations[grade].get(toPort) ?? 0;
    allocations[grade].set(toPort, existing + qty);
  }

  return true;
}

/**
 * Try moving grades one at a time when full merge fails.
 * Some grades may have tank overflow at destination; we move what we can.
 * Only counts as success if ALL purchases are moved from fromPort
 * (otherwise we'd still pay delivery there).
 */
function tryPartialMerge(
  fromPort: number,
  toPort: number,
  gradesToMove: { grade: OilGradeCategory; qty: number }[],
  allocations: Record<OilGradeCategory, Map<number, number>>,
  input: OptimizerInput,
  buffer: number
): boolean {
  const { ports, oilGrades, currentRob } = input;

  // Try reducing quantities to fit tank capacity at destination
  const temp = cloneAllocations(allocations);
  const adjustedMoves: { grade: OilGradeCategory; qty: number }[] = [];

  for (const { grade, qty } of gradesToMove) {
    const gradeConfig = oilGrades.find((g) => g.category === grade)!;

    // Simulate ROB at toPort with current temp allocations
    let rob = currentRob[grade];
    for (let i = 0; i < toPort && i < ports.length; i++) {
      rob += temp[grade].get(i) ?? 0;
      rob -= ports[i].seaDaysToNext * gradeConfig.avgDailyConsumption * buffer;
    }

    // Available room at destination
    const roomAtDest = gradeConfig.tankConfig.capacity - rob;
    const existingAtDest = temp[grade].get(toPort) ?? 0;
    const maxAdditional = Math.max(0, roomAtDest - existingAtDest);
    const adjustedQty = Math.min(qty, maxAdditional);

    if (adjustedQty <= 0) return false; // can't fit anything, partial merge fails

    temp[grade].delete(fromPort);
    temp[grade].set(toPort, existingAtDest + adjustedQty);

    // If we couldn't move the full qty, there's leftover at fromPort
    const leftover = qty - adjustedQty;
    if (leftover > 0) {
      return false; // still need delivery at fromPort
    }

    adjustedMoves.push({ grade, qty: adjustedQty });
  }

  // Verify the adjusted allocations
  if (!verifyAllocations(temp, input, buffer)) return false;

  // Apply
  for (const { grade, qty } of adjustedMoves) {
    allocations[grade].delete(fromPort);
    const existing = allocations[grade].get(toPort) ?? 0;
    allocations[grade].set(toPort, existing + qty);
  }

  return true;
}

/** Deep-clone allocation maps. */
function cloneAllocations(
  allocations: Record<OilGradeCategory, Map<number, number>>
): Record<OilGradeCategory, Map<number, number>> {
  return {
    cylinderOil: new Map(allocations.cylinderOil),
    meSystemOil: new Map(allocations.meSystemOil),
    aeSystemOil: new Map(allocations.aeSystemOil),
  };
}

/**
 * Verify that allocations produce a safe plan:
 * - Tank capacity never exceeded
 * - ROB never drops below minRob (except at last port)
 */
function verifyAllocations(
  allocations: Record<OilGradeCategory, Map<number, number>>,
  input: OptimizerInput,
  buffer: number
): boolean {
  const { ports, oilGrades, currentRob } = input;

  for (const gradeConfig of oilGrades) {
    const grade = gradeConfig.category;
    const { tankConfig, avgDailyConsumption } = gradeConfig;
    let rob = currentRob[grade];

    for (let i = 0; i < ports.length; i++) {
      const qty = allocations[grade].get(i) ?? 0;

      // Tank overflow check (1% tolerance for rounding)
      if (rob + qty > tankConfig.capacity * 1.01) return false;

      rob += qty;
      rob -= ports[i].seaDaysToNext * avgDailyConsumption * buffer;

      // ROB safety check (skip last port and zero-travel ports)
      if (rob < tankConfig.minRob && ports[i].seaDaysToNext > 0 && i < ports.length - 1) {
        return false;
      }
    }
  }

  return true;
}
