import type { PortDeliveryConfig, DeliveryBreakdown } from './types';

/**
 * Compute variable delivery cost based on Shell Marine pricing model.
 *
 * Components:
 * 1. Port Price Differential: (rate / 100) × totalLiters
 * 2. Small Order Surcharge: $200 if bulk order < 4,000L
 * 3. Urgent Order Surcharge: $200 if available days < lead time
 *
 * Falls back to flat charge when no config is available.
 */
export function computeDeliveryCost(
  config: PortDeliveryConfig | null,
  totalLiters: number,
  availableDays: number,
  fallbackFlat: number
): DeliveryBreakdown {
  if (!config) {
    return {
      differential: fallbackFlat,
      smallOrderSurcharge: 0,
      urgentSurcharge: 0,
      total: fallbackFlat,
    };
  }

  // No purchase → no delivery cost
  if (totalLiters <= 0) {
    return { differential: 0, smallOrderSurcharge: 0, urgentSurcharge: 0, total: 0 };
  }

  const differential = (config.differentialPer100L / 100) * totalLiters;

  const smallOrderSurcharge =
    totalLiters > 0 && totalLiters < config.smallOrderThresholdL
      ? config.smallOrderSurcharge
      : 0;

  const urgentSurcharge =
    availableDays >= 0 && availableDays < config.leadTimeDays
      ? config.urgentOrderSurcharge
      : 0;

  const total = differential + smallOrderSurcharge + urgentSurcharge;

  return { differential, smallOrderSurcharge, urgentSurcharge, total };
}

/**
 * Estimate delivery cost for scoring/comparison purposes.
 * Uses an estimated volume (e.g., 50% of target fill) since actual
 * quantities aren't known yet during port scoring.
 */
export function estimateDeliveryCost(
  config: PortDeliveryConfig | null,
  estimatedLiters: number,
  fallbackFlat: number
): number {
  if (!config) return fallbackFlat;
  if (estimatedLiters <= 0) return 0;

  // Assume standard lead time (no urgency) for estimates
  const differential = (config.differentialPer100L / 100) * estimatedLiters;
  const smallOrderSurcharge =
    estimatedLiters < config.smallOrderThresholdL ? config.smallOrderSurcharge : 0;

  return differential + smallOrderSurcharge;
}
