import type {
  OptimizerInput,
  OptimizerOutput,
  SmartOptimizerConfig,
  SmartOptimizerResult,
  RankedPlan,
  StrategyName,
} from './types';
import { runOptimizer, computeBaseline } from './engine';
import { runCheapestPortStrategy } from './strategies/cheapest-port';
import { runDeliveryAwareStrategy } from './strategies/delivery-aware';
import { runConsolidatedStrategy } from './strategies/consolidated';
import { validatePlanSafety } from './strategies/build-output';
import { buildOutputWithAlerts } from './strategies/build-output';
import { consolidateDeliveries, extractAllocations } from './strategies/consolidate-deliveries';

const DEFAULT_CONFIG: SmartOptimizerConfig = {
  strategies: ['grid', 'cheapest-port', 'delivery-aware', 'consolidated'],
  topN: 5,
  deliveryChargeDefault: 500,
  grid: {
    targetFillPcts: [0.55, 0.60, 0.65, 0.70, 0.75, 0.80],
    opportunityDiscountPcts: [5, 10, 15, 20, 25],
    robTriggerMultipliers: [1.0, 1.2, 1.4, 1.6],
    windowSizes: [3, 5, 7],
  },
};

/**
 * Smart Multi-Strategy Optimizer.
 *
 * Runs 4 strategies in parallel:
 * 1. Grid Search — parametric sweep over existing optimizer
 * 2. Cheapest-Port — backward-planning algorithm
 * 3. Delivery-Aware — post-processing gate on existing optimizer
 * 4. Consolidated — minimize delivery events
 *
 * Returns top N plans ranked by:
 * - Safety first (plans with ROB breaches are ranked LAST)
 * - Then by total all-in cost ascending
 */
export function runSmartOptimizer(
  baseInput: OptimizerInput,
  config: Partial<SmartOptimizerConfig> = {}
): SmartOptimizerResult {
  const startTime = performance.now();
  const cfg = mergeConfig(config);

  // Compute baseline once (shared across all strategies)
  const buffer = 1 + baseInput.safetyBufferPct / 100;
  const baseline = computeBaseline(baseInput, buffer);
  const baselineAllInCost =
    baseline.cost.cylinderOil + baseline.cost.meSystemOil + baseline.cost.aeSystemOil + baseline.deliveryCharges;

  const allPlans: RankedPlan[] = [];
  let combinationsEvaluated = 0;

  // Strategy 1: Grid Search
  if (cfg.strategies.includes('grid')) {
    const gridPlans = runGridSearch(baseInput, cfg, baselineAllInCost);
    combinationsEvaluated += gridPlans.count;
    allPlans.push(...gridPlans.plans);
  }

  // Strategy 2: Cheapest-Port
  if (cfg.strategies.includes('cheapest-port')) {
    const output = runCheapestPortStrategy(baseInput);
    combinationsEvaluated++;
    allPlans.push(outputToRankedPlan(output, 'cheapest-port', 'Cheapest Port', baselineAllInCost, baseInput));
  }

  // Strategy 3: Delivery-Aware
  if (cfg.strategies.includes('delivery-aware')) {
    const output = runDeliveryAwareStrategy(baseInput);
    combinationsEvaluated++;
    allPlans.push(outputToRankedPlan(output, 'delivery-aware', 'Delivery-Aware', baselineAllInCost, baseInput));
  }

  // Strategy 4: Consolidated
  if (cfg.strategies.includes('consolidated')) {
    const output = runConsolidatedStrategy(baseInput);
    combinationsEvaluated++;
    allPlans.push(outputToRankedPlan(output, 'consolidated', 'Consolidated', baselineAllInCost, baseInput));
  }

  // Sort: SAFE plans first (by cost), then UNSAFE plans (by fewest breaches, then cost)
  allPlans.sort((a, b) => {
    // Safe plans always rank above unsafe plans
    if (a.safe && !b.safe) return -1;
    if (!a.safe && b.safe) return 1;
    // Among same safety status, sort by cost
    if (a.safe && b.safe) return a.allInCost - b.allInCost;
    // Among unsafe plans, fewer breaches is better
    if (a.robBreaches !== b.robBreaches) return a.robBreaches - b.robBreaches;
    return a.allInCost - b.allInCost;
  });

  // Deduplicate
  const deduped = deduplicatePlans(allPlans);

  // Take top N and assign ranks
  const topPlans = deduped.slice(0, cfg.topN).map((plan, idx) => ({
    ...plan,
    rank: idx + 1,
  }));

  const elapsedMs = Math.round(performance.now() - startTime);

  return {
    plans: topPlans,
    baseline: {
      cost: baselineAllInCost,
      oilCost: baseline.cost.cylinderOil + baseline.cost.meSystemOil + baseline.cost.aeSystemOil,
      deliveryCharges: baseline.deliveryCharges,
      purchaseEvents: baseline.purchaseEvents,
    },
    combinationsEvaluated,
    elapsedMs,
  };
}

/**
 * Grid search: sweep over parameter combinations.
 */
function runGridSearch(
  baseInput: OptimizerInput,
  cfg: SmartOptimizerConfig,
  baselineAllInCost: number
): { plans: RankedPlan[]; count: number } {
  const plans: RankedPlan[] = [];
  let count = 0;
  const buffer = 1 + baseInput.safetyBufferPct / 100;

  const { targetFillPcts, opportunityDiscountPcts, robTriggerMultipliers, windowSizes } = cfg.grid;

  for (const targetFillPct of targetFillPcts) {
    for (const oppDisc of opportunityDiscountPcts) {
      for (const robTrigger of robTriggerMultipliers) {
        for (const windowSize of windowSizes) {
          count++;

          const modifiedInput: OptimizerInput = {
            ...baseInput,
            windowSize,
            reorderConfig: {
              ...baseInput.reorderConfig,
              targetFillPct,
              opportunityDiscountPct: oppDisc,
              robTriggerMultiplier: robTrigger,
            },
          };

          // Run optimizer, then consolidate delivery events
          const baseOutput = runOptimizer(modifiedInput);
          const allocs = extractAllocations(baseOutput, baseInput.oilGrades);
          consolidateDeliveries(modifiedInput, allocs, buffer);
          const output = buildOutputWithAlerts(modifiedInput, allocs, buffer);
          const allInCost = output.totalCost.total + output.totalDeliveryCharges;
          const { safe, robBreaches } = validatePlanSafety(output, modifiedInput);

          const label = `Grid: Fill ${Math.round(targetFillPct * 100)}%, Disc ${oppDisc}%, ROB ${robTrigger}x, Win ${windowSize}`;

          plans.push({
            rank: 0,
            strategy: 'grid',
            strategyLabel: label,
            params: {
              targetFillPct,
              opportunityDiscountPct: oppDisc,
              robTriggerMultiplier: robTrigger,
              windowSize,
            },
            output,
            allInCost,
            baselineAllInCost,
            savings: baselineAllInCost - allInCost,
            savingsPct: baselineAllInCost > 0
              ? ((baselineAllInCost - allInCost) / baselineAllInCost) * 100
              : 0,
            safe,
            robBreaches,
          });
        }
      }
    }
  }

  return { plans, count };
}

function outputToRankedPlan(
  output: OptimizerOutput,
  strategy: StrategyName,
  label: string,
  baselineAllInCost: number,
  input: OptimizerInput
): RankedPlan {
  const allInCost = output.totalCost.total + output.totalDeliveryCharges;
  const { safe, robBreaches } = validatePlanSafety(output, input);
  return {
    rank: 0,
    strategy,
    strategyLabel: label,
    output,
    allInCost,
    baselineAllInCost,
    savings: baselineAllInCost - allInCost,
    savingsPct: baselineAllInCost > 0
      ? ((baselineAllInCost - allInCost) / baselineAllInCost) * 100
      : 0,
    safe,
    robBreaches,
  };
}

function deduplicatePlans(plans: RankedPlan[]): RankedPlan[] {
  const seen = new Set<string>();
  const result: RankedPlan[] = [];

  for (const plan of plans) {
    const fingerprint = `${Math.round(plan.allInCost * 100)}-${plan.output.purchaseEvents}-${Math.round(plan.output.totalDeliveryCharges * 100)}-${plan.safe}`;
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      result.push(plan);
    }
  }

  return result;
}

function mergeConfig(partial: Partial<SmartOptimizerConfig>): SmartOptimizerConfig {
  return {
    strategies: partial.strategies ?? DEFAULT_CONFIG.strategies,
    topN: partial.topN ?? DEFAULT_CONFIG.topN,
    deliveryChargeDefault: partial.deliveryChargeDefault ?? DEFAULT_CONFIG.deliveryChargeDefault,
    grid: {
      targetFillPcts: partial.grid?.targetFillPcts ?? DEFAULT_CONFIG.grid.targetFillPcts,
      opportunityDiscountPcts: partial.grid?.opportunityDiscountPcts ?? DEFAULT_CONFIG.grid.opportunityDiscountPcts,
      robTriggerMultipliers: partial.grid?.robTriggerMultipliers ?? DEFAULT_CONFIG.grid.robTriggerMultipliers,
      windowSizes: partial.grid?.windowSizes ?? DEFAULT_CONFIG.grid.windowSizes,
    },
  };
}
