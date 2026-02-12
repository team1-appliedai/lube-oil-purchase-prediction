// ============================================================
// Core Domain Types
// ============================================================

export interface Vessel {
  vesselId: string;
  vesselName: string;
  vesselCode: string;
  vesselType: string;
  fleet: string;
  lubeSupplier: string;
  isActive: boolean;
}

export interface ConsumptionRecord {
  vesselId: string;
  vesselName: string;
  reportDate: string;
  reportType: string;
  state: string;
  cylinderOilRob: number;
  meSystemOilRob: number;
  aeSystemOilRob: number;
  cylinderOilConsumption: number;
  meSystemOilConsumption: number;
  aeSystemOilConsumption: number;
  meRunningHours: number;
  aeRunningHours: number;
  portOfOrigin: string;
  portOfDestination: string;
  eta: string;
  avgSpeed: number;
}

export interface SchedulePort {
  portName: string;
  portCode: string;
  country: string;
  arrivalDate?: string;
  departureDate?: string;
  isCurrentPort: boolean;
  voyageNo: string;
}

export interface PortPrice {
  country: string;
  port: string;
  supplier: string;
  cylinderOilLS: Record<string, number>;   // product -> USD/L
  cylinderOilHS: Record<string, number>;
  meCrankcaseOil: Record<string, number>;
  aeCrankcaseOil: Record<string, number>;
}

export interface VesselSupplierMapping {
  vesselName: string;
  supplier: string;
}

// ============================================================
// Oil Grade Types
// ============================================================

export type OilGradeCategory = 'cylinderOil' | 'meSystemOil' | 'aeSystemOil';

export interface TankConfig {
  capacity: number;       // total tank capacity (L)
  maxFillPct: number;     // max fill percentage (0.85 = 85%)
  minRob: number;         // minimum ROB (L) — for cylinder oil, this is dynamic
}

export interface OilGradeConfig {
  category: OilGradeCategory;
  label: string;
  tankConfig: TankConfig;
  avgDailyConsumption: number;  // L/day (computed from noon reports)
}

// ============================================================
// New Config Types — Realistic Maritime Procurement
// ============================================================

export interface DeliveryChargeConfig {
  defaultCharge: number;                    // USD per bunkering event (default: 500)
  portOverrides: Record<string, number>;    // portCode -> charge
}

export interface MinOrderConfig {
  cylinderOil: number;    // 0 (no minimum for cylinder)
  meSystemOil: number;    // 10,000 L
  aeSystemOil: number;    // 10,000 L
}

export interface ReorderConfig {
  targetFillPct: number;              // 0.70 = fill to 70% of capacity
  robTriggerMultiplier: number;       // 1.2 = order when ROB < 1.2x minROB
  opportunityDiscountPct: number;     // 10 = buy if price 10%+ below route average
}

// ============================================================
// Optimizer Input/Output
// ============================================================

export interface PortStop {
  portName: string;
  portCode: string;
  country: string;
  arrivalDate: string;
  departureDate: string;
  seaDaysToNext: number;           // days at sea to next port
  deliveryCharge: number;          // USD per bunkering event at this port
  prices: {
    cylinderOil: number | null;     // best price in USD/L for vessel's supplier
    meSystemOil: number | null;
    aeSystemOil: number | null;
  };
  priceDetails: {
    cylinderOil: Record<string, number>;
    meSystemOil: Record<string, number>;
    aeSystemOil: Record<string, number>;
  };
}

export interface OptimizerInput {
  vessel: Vessel;
  ports: PortStop[];
  currentRob: {
    cylinderOil: number;
    meSystemOil: number;
    aeSystemOil: number;
  };
  oilGrades: OilGradeConfig[];
  windowSize: number;               // how many ports to look ahead (default 5)
  safetyBufferPct: number;           // extra buffer % (default 10)
  deliveryCharges: DeliveryChargeConfig;
  minOrderQty: MinOrderConfig;
  reorderConfig: ReorderConfig;
}

export type PurchaseAction =
  | 'ORDER'     // Standard order — triggered by need or opportunity
  | 'URGENT'    // ROB critically low, must buy immediately
  | 'SKIP'      // Don't buy — adequate ROB
  | 'ALERT';    // ROB will breach minimum — no price available

export interface PortPlan {
  portName: string;
  portCode: string;
  country: string;
  arrivalDate: string;
  departureDate: string;
  seaDaysToNext: number;
  deliveryCharge: number;           // charge incurred if any grade ordered at this port
  actions: {
    [grade in OilGradeCategory]: {
      action: PurchaseAction;
      quantity: number;          // liters to buy
      cost: number;              // USD
      pricePerLiter: number;     // USD/L
      robOnArrival: number;      // projected ROB at arrival
      robOnDeparture: number;    // ROB after purchase
      robAtNextPort: number;     // projected ROB at next port arrival
    };
  };
}

export interface OptimizerOutput {
  vesselId: string;
  vesselName: string;
  ports: PortPlan[];
  totalCost: {
    cylinderOil: number;
    meSystemOil: number;
    aeSystemOil: number;
    total: number;
  };
  totalDeliveryCharges: number;
  purchaseEvents: number;            // count of ports where orders were placed
  baselineCost: {
    cylinderOil: number;
    meSystemOil: number;
    aeSystemOil: number;
    total: number;
  };
  baselineDeliveryCharges: number;
  baselinePurchaseEvents: number;
  savings: {
    cylinderOil: number;
    meSystemOil: number;
    aeSystemOil: number;
    total: number;
    pct: number;
  };
  generatedAt: string;
}

// ============================================================
// Purchase Plan (persisted)
// ============================================================

export interface PurchasePlan {
  _id?: string;
  vesselId: string;
  vesselName: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  optimizerOutput: OptimizerOutput;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}

// ============================================================
// Smart Multi-Strategy Optimizer Types
// ============================================================

export type StrategyName = 'grid' | 'cheapest-port' | 'delivery-aware' | 'consolidated';

export interface SmartOptimizerConfig {
  strategies: StrategyName[];
  topN: number;                       // how many ranked plans to return (default 5)
  deliveryChargeDefault: number;      // USD per event — used by strategies
  grid: {
    targetFillPcts: number[];         // e.g. [0.55, 0.60, 0.65, 0.70, 0.75, 0.80]
    opportunityDiscountPcts: number[]; // e.g. [5, 10, 15, 20, 25]
    robTriggerMultipliers: number[];  // e.g. [1.0, 1.2, 1.4, 1.6]
    windowSizes: number[];            // e.g. [3, 5, 7]
  };
}

export interface RankedPlan {
  rank: number;
  strategy: StrategyName;
  strategyLabel: string;              // human-readable label (e.g. "Grid: Fill 60%, Disc 20%")
  params?: Record<string, number>;    // strategy parameters used
  output: OptimizerOutput;
  allInCost: number;                  // oil cost + delivery charges
  baselineAllInCost: number;          // baseline oil + delivery for comparison
  savings: number;                    // baselineAllInCost - allInCost
  savingsPct: number;                 // savings as percentage of baseline
  safe: boolean;                      // true if ROB never breaches minRob for any grade
  robBreaches: number;                // count of ports where ROB goes below minRob
}

export interface SmartOptimizerResult {
  plans: RankedPlan[];
  baseline: {
    cost: number;                     // total oil + delivery
    oilCost: number;
    deliveryCharges: number;
    purchaseEvents: number;
  };
  combinationsEvaluated: number;      // total strategies/combos tried
  elapsedMs: number;                  // wall-clock time
}
