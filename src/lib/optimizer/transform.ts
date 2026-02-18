import type {
  Vessel,
  ConsumptionRecord,
  SchedulePort,
  PortPrice,
  PortStop,
  OptimizerInput,
  OilGradeConfig,
  OilGradeCategory,
  DeliveryChargeConfig,
  MinOrderConfig,
  ReorderConfig,
  PortDeliveryConfig,
} from './types';
import {
  computeDailyConsumption,
  weightedAvgConsumption,
  computeCylinderMinRob,
} from './consumption-forecast';

/**
 * Transform raw MongoDB data into OptimizerInput.
 * This is the bridge between the DB layer and the pure optimizer engine.
 */
export function buildOptimizerInput(params: {
  vessel: Vessel;
  consumptionRecords: ConsumptionRecord[];
  schedulePorts: SchedulePort[];
  prices: PortPrice[];
  supplier: string;
  windowSize?: number;
  safetyBufferPct?: number;
  tankOverrides?: Partial<Record<OilGradeCategory, { capacity?: number; maxFillPct?: number; minRob?: number }>>;
  deliveryCharges?: Partial<DeliveryChargeConfig>;
  minOrderQty?: Partial<MinOrderConfig>;
  reorderConfig?: Partial<ReorderConfig>;
}): OptimizerInput {
  const {
    vessel,
    consumptionRecords,
    schedulePorts,
    prices,
    supplier,
    windowSize = Number(process.env.OPTIMIZER_WINDOW_SIZE) || 5,
    safetyBufferPct = Number(process.env.OPTIMIZER_SAFETY_BUFFER_PCT) || 10,
    tankOverrides,
  } = params;

  // Build delivery charges config
  // Port delivery configs are now derived from price docs (see buildPortStops)
  const deliveryCharges: DeliveryChargeConfig = {
    defaultCharge: params.deliveryCharges?.defaultCharge ?? (Number(process.env.DELIVERY_CHARGE_DEFAULT) || 1500),
    portOverrides: params.deliveryCharges?.portOverrides ?? {},
    portConfigs: params.deliveryCharges?.portConfigs ?? [],
  };

  // Build min order qty config
  const minOrderQty: MinOrderConfig = {
    cylinderOil: params.minOrderQty?.cylinderOil ?? 0,
    meSystemOil: params.minOrderQty?.meSystemOil ?? (Number(process.env.MIN_ORDER_QTY_ME_SYSTEM) || 10000),
    aeSystemOil: params.minOrderQty?.aeSystemOil ?? (Number(process.env.MIN_ORDER_QTY_AE_SYSTEM) || 10000),
  };

  // Build reorder config
  const reorderConfig: ReorderConfig = {
    targetFillPct: params.reorderConfig?.targetFillPct ?? ((Number(process.env.TARGET_FILL_PCT) || 70) / 100),
    robTriggerMultiplier: params.reorderConfig?.robTriggerMultiplier ?? (Number(process.env.REORDER_ROB_TRIGGER_MULTIPLIER) || 1.2),
    opportunityDiscountPct: params.reorderConfig?.opportunityDiscountPct ?? (Number(process.env.OPPORTUNITY_DISCOUNT_PCT) || 10),
  };

  // 1. Compute average daily consumption from noon reports
  const dailyRecords = computeDailyConsumption(consumptionRecords);
  const avgDaily = weightedAvgConsumption(dailyRecords, 6);

  // 2. Get current ROB from most recent consumption record
  const sortedRecords = [...consumptionRecords].sort(
    (a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime()
  );
  const latestRecord = sortedRecords[0];
  const currentRob = {
    cylinderOil: latestRecord?.cylinderOilRob ?? 0,
    meSystemOil: latestRecord?.meSystemOilRob ?? 0,
    aeSystemOil: latestRecord?.aeSystemOilRob ?? 0,
  };

  // 3. Build tank configs
  const cylinderMinRob = computeCylinderMinRob(
    avgDaily.cylinderOil,
    Number(process.env.CYLINDER_MIN_ROB_DAYS) || 60
  );

  const oilGrades: OilGradeConfig[] = [
    {
      category: 'cylinderOil',
      label: 'Cylinder Oil',
      tankConfig: {
        capacity: tankOverrides?.cylinderOil?.capacity ?? (Number(process.env.TANK_CAPACITY_CYLINDER) || 100000),
        maxFillPct: tankOverrides?.cylinderOil?.maxFillPct ?? ((Number(process.env.TANK_MAX_FILL_PCT) || 85) / 100),
        minRob: tankOverrides?.cylinderOil?.minRob ?? cylinderMinRob,
      },
      avgDailyConsumption: avgDaily.cylinderOil,
    },
    {
      category: 'meSystemOil',
      label: 'ME System Oil',
      tankConfig: {
        capacity: tankOverrides?.meSystemOil?.capacity ?? (Number(process.env.TANK_CAPACITY_ME_SYSTEM) || 95000),
        maxFillPct: tankOverrides?.meSystemOil?.maxFillPct ?? ((Number(process.env.TANK_MAX_FILL_PCT) || 85) / 100),
        minRob: tankOverrides?.meSystemOil?.minRob ?? (Number(process.env.MIN_ROB_ME_SYSTEM) || 30000),
      },
      avgDailyConsumption: avgDaily.meSystemOil,
    },
    {
      category: 'aeSystemOil',
      label: 'AE System Oil',
      tankConfig: {
        capacity: tankOverrides?.aeSystemOil?.capacity ?? (Number(process.env.TANK_CAPACITY_AE_SYSTEM) || 20000),
        maxFillPct: tankOverrides?.aeSystemOil?.maxFillPct ?? ((Number(process.env.TANK_MAX_FILL_PCT) || 85) / 100),
        minRob: tankOverrides?.aeSystemOil?.minRob ?? (Number(process.env.MIN_ROB_AE_SYSTEM) || 5000),
      },
      avgDailyConsumption: avgDaily.aeSystemOil,
    },
  ];

  // 4. Filter prices to vessel's supplier only (fuzzy match: "Total Lub" matches "TOTAL")
  const supplierLower = supplier.toLowerCase();
  const supplierPrices = prices.filter((p) => {
    const pSupplier = p.supplier.toLowerCase();
    return pSupplier === supplierLower
      || supplierLower.startsWith(pSupplier)
      || pSupplier.startsWith(supplierLower);
  });

  // 5. Build port stops with prices, sea days, and delivery charges
  const ports = buildPortStops(schedulePorts, supplierPrices, deliveryCharges, prices);

  return {
    vessel,
    ports,
    currentRob,
    oilGrades,
    windowSize,
    safetyBufferPct,
    deliveryCharges,
    minOrderQty,
    reorderConfig,
  };
}

/**
 * Convert schedule ports + prices into PortStop[] with sea days, prices, and delivery charges.
 * Delivery config is derived from PortPrice docs (which now carry delivery fields).
 */
function buildPortStops(
  schedulePorts: SchedulePort[],
  supplierPrices: PortPrice[],
  deliveryCharges: DeliveryChargeConfig,
  allPrices: PortPrice[]
): PortStop[] {
  const portStops: PortStop[] = [];

  // Build a price lookup by port name and country (case-insensitive) — supplier-filtered
  const priceLookup = new Map<string, PortPrice>();
  for (const p of supplierPrices) {
    const key = `${p.port.toLowerCase()}|${p.country.toLowerCase()}`;
    priceLookup.set(key, p);
    priceLookup.set(p.port.toLowerCase(), p);
  }

  // Build a delivery config lookup from ALL prices (any supplier, since delivery is per-port)
  // Pick the first doc that has delivery fields for each port+country
  const deliveryConfigLookup = new Map<string, PortDeliveryConfig>();
  for (const p of allPrices) {
    if (p.differentialPer100L == null) continue;
    const key = `${p.port.toLowerCase()}|${p.country.toLowerCase()}`;
    if (deliveryConfigLookup.has(key)) continue; // first one wins
    deliveryConfigLookup.set(key, {
      portName: p.port,
      country: p.country,
      differentialPer100L: p.differentialPer100L!,
      leadTimeDays: p.leadTimeDays ?? 5,
      smallOrderThresholdL: p.smallOrderThresholdL ?? 4000,
      smallOrderSurcharge: p.smallOrderSurcharge ?? 200,
      urgentOrderSurcharge: p.urgentOrderSurcharge ?? 200,
    });
    deliveryConfigLookup.set(p.port.toLowerCase(), deliveryConfigLookup.get(key)!);
  }

  for (let i = 0; i < schedulePorts.length; i++) {
    const sp = schedulePorts[i];
    const nextSp = schedulePorts[i + 1];

    // Calculate sea days to next port
    let seaDaysToNext = 0;
    if (nextSp && sp.departureDate && nextSp.arrivalDate) {
      const depDate = new Date(sp.departureDate);
      const arrDate = new Date(nextSp.arrivalDate);
      seaDaysToNext = Math.max(0, (arrDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Lookup prices for this port (try full name, then first word before comma, then country)
    const portNameLower = sp.portName.toLowerCase();
    const countryLower = sp.country.toLowerCase();
    const priceKey = `${portNameLower}|${countryLower}`;
    // Port names from schedule may have suffix like "TOKYO, TOKYO" or "SHIMIZU, SHIZUOKA"
    const shortName = portNameLower.includes(',') ? portNameLower.split(',')[0].trim() : portNameLower;
    const portPrice = priceLookup.get(priceKey)
      || priceLookup.get(portNameLower)
      || priceLookup.get(`${shortName}|${countryLower}`)
      || priceLookup.get(shortName);

    // Get best (lowest) price for each grade
    const getBestPrice = (priceMap: Record<string, number> | undefined): number | null => {
      if (!priceMap || Object.keys(priceMap).length === 0) return null;
      return Math.min(...Object.values(priceMap));
    };

    // Delivery charge: port override or default (flat fallback)
    const deliveryCharge = deliveryCharges.portOverrides[sp.portCode] ?? deliveryCharges.defaultCharge;

    // Match delivery config from price docs using same fuzzy matching
    const deliveryConfig = deliveryConfigLookup.get(priceKey)
      || deliveryConfigLookup.get(portNameLower)
      || deliveryConfigLookup.get(`${shortName}|${countryLower}`)
      || deliveryConfigLookup.get(shortName)
      || null;

    portStops.push({
      portName: sp.portName,
      portCode: sp.portCode,
      country: sp.country,
      arrivalDate: sp.arrivalDate || '',
      departureDate: sp.departureDate || '',
      seaDaysToNext,
      deliveryCharge,
      deliveryConfig,
      prices: {
        cylinderOil: portPrice ? getBestPrice(portPrice.cylinderOilLS) ?? getBestPrice(portPrice.cylinderOilHS) : null,
        meSystemOil: portPrice ? getBestPrice(portPrice.meCrankcaseOil) : null,
        aeSystemOil: portPrice ? getBestPrice(portPrice.aeCrankcaseOil) : null,
      },
      priceDetails: {
        cylinderOil: portPrice ? { ...portPrice.cylinderOilLS, ...portPrice.cylinderOilHS } : {},
        meSystemOil: portPrice ? { ...portPrice.meCrankcaseOil } : {},
        aeSystemOil: portPrice ? { ...portPrice.aeCrankcaseOil } : {},
      },
    });
  }

  return portStops;
}
