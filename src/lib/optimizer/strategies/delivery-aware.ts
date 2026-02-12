import type {
  OptimizerInput,
  OptimizerOutput,
} from '../types';
import { runOptimizer } from '../engine';
import { buildOutputWithAlerts } from './build-output';
import { consolidateDeliveries, extractAllocations } from './consolidate-deliveries';

/**
 * Delivery-Aware Strategy.
 *
 * 1. Run the standard optimizer to get a base plan
 * 2. Extract purchase allocations from that plan
 * 3. Apply delivery consolidation:
 *    - Merge nearby delivery events to save delivery charges
 *    - Eliminate unworthy deliveries (oil value < delivery charge × 2)
 * 4. Rebuild output with proper ALERT detection and safety checks
 *
 * This strategy takes the best of the existing optimizer's logic
 * and adds the superintendent's delivery economics on top.
 */
export function runDeliveryAwareStrategy(input: OptimizerInput): OptimizerOutput {
  const baseResult = runOptimizer(input);
  const buffer = 1 + input.safetyBufferPct / 100;

  // Extract allocations from base optimizer output
  const allocations = extractAllocations(baseResult, input.oilGrades);

  // Consolidate delivery events (worthiness check + proximity merge)
  consolidateDeliveries(input, allocations, buffer);

  // Build output with proper ALERT detection
  return buildOutputWithAlerts(input, allocations, buffer);
}
