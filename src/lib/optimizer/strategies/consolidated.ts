import type {
  OptimizerInput,
  OptimizerOutput,
  OilGradeCategory,
  OilGradeConfig,
  PortStop,
} from '../types';
import { computeRouteAveragePrice, getPortPrice } from '../engine';
import { buildOutputWithAlerts } from './build-output';
import { consolidateDeliveries } from './consolidate-deliveries';

/**
 * Consolidated Strategy — minimize delivery events.
 *
 * 1. Score each priced port by combined value across ALL grades:
 *    score = sum_grades((avgPrice - portPrice) * estimatedQty) - deliveryCharge
 * 2. Greedily select highest-score ports until all grades are covered for entire voyage
 * 3. Ensure ROB never drops below minROB throughout
 */
export function runConsolidatedStrategy(input: OptimizerInput): OptimizerOutput {
  const { vessel, ports, currentRob, oilGrades, safetyBufferPct, reorderConfig, minOrderQty } = input;
  const { targetFillPct } = reorderConfig;
  const buffer = 1 + safetyBufferPct / 100;
  const routeAvgPrice = computeRouteAveragePrice(ports, oilGrades);

  // Phase 1: Score each port by combined value across all grades
  const portScores: { idx: number; score: number; gradeQtys: Record<OilGradeCategory, number> }[] = [];

  for (let i = 0; i < ports.length; i++) {
    const port = ports[i];
    let totalScore = -port.deliveryCharge; // delivery cost is a penalty
    const gradeQtys: Record<OilGradeCategory, number> = { cylinderOil: 0, meSystemOil: 0, aeSystemOil: 0 };
    let hasAnyPrice = false;

    for (const gradeConfig of oilGrades) {
      const grade = gradeConfig.category;
      const price = getPortPrice(port, grade);
      if (price === null || price <= 0) continue;

      hasAnyPrice = true;
      const avgPrice = routeAvgPrice[grade];
      const priceDiff = avgPrice - price; // positive = this port is cheaper than average
      // Estimate max quantity we'd buy (rough: target fill from empty)
      const estimatedQty = gradeConfig.tankConfig.capacity * targetFillPct * 0.5;
      totalScore += priceDiff * estimatedQty;
      gradeQtys[grade] = estimatedQty;
    }

    if (hasAnyPrice) {
      portScores.push({ idx: i, score: totalScore, gradeQtys });
    }
  }

  // Sort by score descending
  portScores.sort((a, b) => b.score - a.score);

  // Phase 2: Greedily select ports to ensure all grades covered
  const selectedPorts = new Set<number>();
  const allocations: Record<OilGradeCategory, Map<number, number>> = {
    cylinderOil: new Map(),
    meSystemOil: new Map(),
    aeSystemOil: new Map(),
  };

  // First pass: add ports that are needed for safety (must-buy)
  for (const gradeConfig of oilGrades) {
    const grade = gradeConfig.category;
    const { tankConfig, avgDailyConsumption } = gradeConfig;
    const minRob = tankConfig.minRob;

    // Find breach points without any purchases
    let rob = currentRob[grade];
    for (let i = 0; i < ports.length; i++) {
      const consumption = ports[i].seaDaysToNext * avgDailyConsumption * buffer;
      const robAfterTravel = rob - consumption;

      if (robAfterTravel < minRob) {
        // Must buy before this point. Find the best-scored port in the window
        const windowEnd = i;
        const windowStart = findLastAllocatedPort(allocations[grade], i);

        let bestPortIdx = -1;
        let bestPortScore = -Infinity;

        for (const ps of portScores) {
          if (ps.idx >= windowStart && ps.idx <= windowEnd) {
            const price = getPortPrice(ports[ps.idx], grade);
            if (price !== null && price > 0 && ps.score > bestPortScore) {
              bestPortScore = ps.score;
              bestPortIdx = ps.idx;
            }
          }
        }

        // Fallback: find any priced port in window
        if (bestPortIdx === -1) {
          for (let j = windowStart; j <= windowEnd && j < ports.length; j++) {
            const price = getPortPrice(ports[j], grade);
            if (price !== null && price > 0) {
              bestPortIdx = j;
              break;
            }
          }
        }

        if (bestPortIdx >= 0) {
          const targetFill = tankConfig.capacity * targetFillPct;
          // Simulate ROB at this port considering prior allocations
          const robAtPort = simulateRobAtPort(
            grade, ports, currentRob[grade], avgDailyConsumption, buffer, allocations[grade], bestPortIdx
          );
          const qty = Math.max(0, Math.min(targetFill - robAtPort, tankConfig.capacity - robAtPort));

          if (qty > 0) {
            allocations[grade].set(bestPortIdx, qty);
            selectedPorts.add(bestPortIdx);
          }
        }

        // Re-simulate ROB from this point forward
        rob = simulateRobAtPort(
          grade, ports, currentRob[grade], avgDailyConsumption, buffer, allocations[grade], i
        );
        if (allocations[grade].has(i)) {
          rob += allocations[grade].get(i)!;
        }
        rob -= consumption;
      } else {
        rob = robAfterTravel;
      }
    }
  }

  // Second pass: for selected ports, check if other grades can piggyback
  for (const portIdx of selectedPorts) {
    for (const gradeConfig of oilGrades) {
      const grade = gradeConfig.category;
      if (allocations[grade].has(portIdx)) continue;

      const price = getPortPrice(ports[portIdx], grade);
      if (price === null || price <= 0) continue;

      const avgPrice = routeAvgPrice[grade];
      // Only piggyback if price is at or below average
      if (price > avgPrice * 1.05) continue;

      const { tankConfig, avgDailyConsumption } = gradeConfig;
      const targetFill = tankConfig.capacity * targetFillPct;
      const robAtPort = simulateRobAtPort(
        grade, ports, currentRob[grade], avgDailyConsumption, buffer, allocations[grade], portIdx
      );
      const qty = Math.max(0, Math.min(targetFill - robAtPort, tankConfig.capacity - robAtPort));

      if (qty > 0) {
        allocations[grade].set(portIdx, qty);
      }
    }
  }

  // Phase 3: Consolidate delivery events (merge nearby/unworthy deliveries)
  consolidateDeliveries(input, allocations, buffer);

  // Phase 4: Build output (with ALERT detection)
  return buildOutputWithAlerts(input, allocations, buffer);
}

function findLastAllocatedPort(allocations: Map<number, number>, beforeIdx: number): number {
  let last = 0;
  for (const [idx] of allocations) {
    if (idx < beforeIdx) last = Math.max(last, idx + 1);
  }
  return last;
}

function simulateRobAtPort(
  grade: OilGradeCategory,
  ports: PortStop[],
  startingRob: number,
  avgDailyConsumption: number,
  buffer: number,
  allocations: Map<number, number>,
  targetIdx: number
): number {
  let rob = startingRob;
  for (let i = 0; i < targetIdx && i < ports.length; i++) {
    rob += allocations.get(i) ?? 0;
    rob -= ports[i].seaDaysToNext * avgDailyConsumption * buffer;
  }
  return rob;
}

