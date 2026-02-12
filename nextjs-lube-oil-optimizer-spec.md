# Vessel Lube Oil Procurement Optimization — Next.js App

## Complete Technical Specification for Claude Code

---

## 1. PROJECT OVERVIEW

### 1.1 What This App Does

A web-based decision support system for maritime fleet managers to optimize lube oil purchasing across vessel routes. The system takes vessel schedules, consumption data, pricing data, and inventory constraints — then produces optimal purchase plans that minimize cost while ensuring vessels never run critically low on oil.

### 1.2 The Core Problem

Maritime vessels travel through sequences of ports. At each port, lube oil can be purchased at different prices. Fleet managers face two problems:

1. **Buying too early at expensive ports** when a cheaper port is 2-4 stops ahead
2. **Waiting too long** for favorable pricing, causing ROB (Remaining On Board) to hit critical/unsafe levels

The app solves both problems simultaneously through forward-looking optimization.

### 1.3 Who Uses This

- Fleet operations managers / superintendents
- Procurement teams managing lube oil purchases for 5-100+ vessels
- Technical managers tracking consumption and inventory levels

### 1.4 Calculation vs AI — Architecture Decision

The app uses a **hybrid approach** with two distinct layers:

#### Layer 1: Deterministic Optimization Engine (Core — Must Build)

This is the primary decision engine. It uses dynamic programming / backward induction — a mathematical optimization technique, NOT an AI model. It's fully transparent, auditable, and deterministic (same inputs always produce same outputs).

The algorithm:
- Takes the full port sequence, prices, consumption rates, current ROB, and constraints
- Works backward from the last port to the first
- At each port, calculates whether buying here or waiting for a cheaper future port minimizes total cost
- Enforces safety constraints (minimum ROB) as hard boundaries
- Outputs: exact quantities to buy at each port with reasoning

This layer gives 85-90% of the optimization value and must work perfectly before adding any AI.

#### Layer 2: AI-Enhanced Features (Future Enhancement — Optional)

These features use AI/ML models to improve the INPUTS to the optimization engine:

| Feature | AI Technique | What It Does |
|---------|-------------|--------------|
| Consumption Forecasting | Time series (Prophet / LSTM) | Predicts daily consumption more accurately than simple averages, accounting for vessel speed, weather, engine load, oil condition |
| Price Prediction | Gradient boosted trees / regression | Forecasts port prices 30-90 days ahead based on base oil markets, historical patterns, seasonal trends |
| Anomaly Detection | Isolation forests / statistical | Flags unusual consumption spikes (possible leaks, purifier issues) that affect procurement planning |
| Smart Recommendations | LLM (Claude API) | Natural language explanations of why specific purchase decisions are recommended, answering "why buy here?" in plain English |

**Important: Build Layer 1 first and make it production-ready. Layer 2 features can be added incrementally.**

---

## 2. TECH STACK

```
Framework:        Next.js 14+ (App Router)
Language:         TypeScript
Database:         MongoDB (EXISTING — connect to user's existing database)
DB Driver:        MongoDB Native Driver (mongodb npm package)
Authentication:   NextAuth.js (email + SSO)
UI Framework:     Tailwind CSS + shadcn/ui
Charts:           Recharts
Maps:             Leaflet or Mapbox GL JS (for vessel route visualization)
State Management: Zustand (for complex client state like the optimizer)
API Layer:        Next.js API routes (REST)
AI/LLM:          Anthropic Claude API (for natural language insights — Layer 2)
Deployment:       Vercel or Docker
File Handling:    xlsx (for Excel import/export), Papa Parse (for CSV)
```

### 2.1 Why MongoDB Native Driver (Not Mongoose/Prisma)

- The user has an **existing MongoDB database** with established collections and data
- We are **reading from existing collections** — not designing a new schema
- Native driver gives us the most flexibility to query documents with unknown/varying structures
- No schema enforcement layer needed — the data already exists
- Lighter dependency footprint

---

## 3. DATABASE ARCHITECTURE

### 3.1 Connection Setup

```typescript
// lib/db/mongodb.ts

import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB!;

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db(MONGODB_DB);
  
  cachedClient = client;
  cachedDb = db;
  
  return { client, db };
}

export async function getCollection<T>(collectionName: string) {
  const { db } = await connectToDatabase();
  return db.collection<T>(collectionName);
}
```

### 3.2 Environment Variables

```env
# .env.local
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=your_database_name

# Collection name mapping — configure to match actual MongoDB collections
COLLECTION_VESSELS=vessels
COLLECTION_NOON_REPORTS=noon_reports
COLLECTION_VOYAGES=voyages
COLLECTION_PORTS=ports
COLLECTION_PRICING=pricing
COLLECTION_ROB=rob_data

# New collections created by this app (for optimizer output)
COLLECTION_PURCHASE_PLANS=purchase_plans
COLLECTION_PLAN_ITEMS=purchase_plan_items
COLLECTION_APP_CONFIG=optimizer_config
```

### 3.3 Data Source Strategy

The app reads from **TWO categories** of collections:

#### Category A: EXISTING Collections (READ-ONLY)
These are the user's existing MongoDB collections. The app will ONLY read from them. The actual collection names and field mappings will be configured at setup time.

| Data Needed | Purpose | Notes |
|-------------|---------|-------|
| **Vessels** | List of vessels in the fleet | Need: vessel name, IMO number, vessel type |
| **Noon Reports** | Daily consumption data + ROB levels | Need: date, vessel identifier, oil consumption per grade, ROB per grade, running hours |
| **Voyage Schedules** | Port call sequences with ETAs | Need: vessel identifier, port name, ETA, ETD, voyage number |
| **Pricing** | Lube oil prices at each port | Need: port name, oil grade, product price, bunkering charge, availability |
| **ROB / Tank Data** | Current remaining on board per vessel per grade | May be embedded in noon reports or separate |

#### Category B: NEW Collections (READ-WRITE)
These are created by this app to store optimizer outputs and configuration.

```typescript
// ─── PURCHASE PLANS (created by optimizer) ───────────────

interface PurchasePlan {
  _id: ObjectId;
  vesselId: string;
  vesselName: string;
  planName: string;
  status: 'DRAFT' | 'APPROVED' | 'IN_EXECUTION' | 'COMPLETED' | 'CANCELLED';
  planHorizonFrom: Date;
  planHorizonTo: Date;
  totalEstCost: number;
  baselineCost: number;
  estimatedSaving: number;
  windowSize: number;
  safetyBuffer: number;
  generatedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
  items: PurchasePlanItem[];  // Embedded array — one per port × grade
}

interface PurchasePlanItem {
  portName: string;
  portId?: string;
  eta: Date;
  legOrder: number;
  oilGrade: string;
  oilCategory: 'CYLINDER' | 'ME_SYSTEM' | 'AE_SYSTEM' | 'OTHER';
  robOnArrival: number;
  legConsumption: number;
  projectedROBAtNext: number;
  pricePerLiter: number | null;
  action: 'BUY_MAX' | 'BUY_MIN' | 'BUY_BRIDGE' | 'SKIP' | 'ALERT' | 'NO_ACTION';
  recommendedQty: number;
  estimatedCost: number | null;
  reasoning: string;
  cheapestPortInWindow: string | null;
  cheapestPriceInWindow: number | null;
  runway: number | null;
  isCheapestInWindow: boolean;
  isCritical: boolean;
  actualQtyPurchased?: number;
  actualPrice?: number;
  purchaseOrderNo?: string;
  executionStatus: 'PENDING' | 'ORDERED' | 'DELIVERED' | 'SKIPPED' | 'CANCELLED';
  executionNotes?: string;
}

// ─── APP CONFIGURATION ───────────────────────────────────

interface OptimizerAppConfig {
  _id: ObjectId;
  companyId: string;
  
  // Field mapping — maps our expected fields to actual MongoDB field names
  fieldMappings: {
    vessels: {
      collectionName: string;
      fields: {
        name: string;         // Their field for vessel name
        imo: string;          // Their field for IMO number
        type: string;         // Their field for vessel type
      };
    };
    noonReports: {
      collectionName: string;
      fields: {
        date: string;
        vesselIdentifier: string;
        cylOilConsumption: string;
        cylOilROB: string;
        meSysOilConsumption: string;
        meSysOilROB: string;
        aeSysOilConsumption: string;
        aeSysOilROB: string;
        meRunningHours: string;
        aeRunningHours: string;
        avgSpeed?: string;
        position?: string;
      };
    };
    voyages: {
      collectionName: string;
      fields: {
        vesselIdentifier: string;
        portName: string;
        eta: string;
        etd: string;
        voyageNumber?: string;
        unlocode?: string;
      };
    };
    pricing: {
      collectionName: string;
      fields: {
        portName: string;
        oilGrade: string;
        productPrice: string;
        bunkeringCharge?: string;
        surcharges?: string;
        isAvailable: string;
        minOrderQty?: string;
        leadTimeDays?: string;
        validFrom?: string;
        supplier?: string;
      };
    };
  };
  
  // Oil grade definitions
  oilGrades: {
    id: string;
    name: string;
    shortName: string;
    category: 'CYLINDER' | 'ME_SYSTEM' | 'AE_SYSTEM' | 'OTHER';
    brand?: string;
  }[];
  
  // Vessel tank configurations
  vesselConfigs: {
    vesselIdentifier: string;
    tanks: {
      gradeId: string;
      capacity: number;
      minimumROB: number;
    }[];
  }[];
  
  // Default optimizer settings
  defaultWindowSize: number;
  defaultSafetyBuffer: number;
  defaultRoundToNearest: number;
}
```

### 3.4 Field Mapping Architecture

**This is critical.** Since we're connecting to an existing MongoDB, every company's field names will be different. The app includes a **one-time setup wizard** where the user:

1. Selects which MongoDB collection contains each data type
2. Maps their actual field names to our expected fields
3. Tests the mapping with a sample query
4. Saves the mapping to the `optimizer_config` collection

```typescript
// lib/db/field-mapper.ts

export async function queryWithMapping<T>(
  collectionName: string,
  fieldMap: Record<string, string>,
  filter: Record<string, any> = {},
  options: { limit?: number; sort?: Record<string, 1 | -1> } = {}
): Promise<T[]> {
  const collection = await getCollection(collectionName);
  
  const projection: Record<string, 1> = {};
  Object.values(fieldMap).forEach(theirField => {
    if (theirField) projection[theirField] = 1;
  });
  
  const cursor = collection.find(filter, { projection });
  if (options.sort) cursor.sort(options.sort);
  if (options.limit) cursor.limit(options.limit);
  
  const rawDocs = await cursor.toArray();
  
  const reverseMap: Record<string, string> = {};
  Object.entries(fieldMap).forEach(([ourField, theirField]) => {
    if (theirField) reverseMap[theirField] = ourField;
  });
  
  return rawDocs.map(doc => {
    const mapped: any = { _id: doc._id };
    Object.entries(doc).forEach(([key, value]) => {
      const ourKey = reverseMap[key] || key;
      mapped[ourKey] = value;
    });
    return mapped as T;
  });
}
```

### 3.5 Data Access Layer

```typescript
// lib/db/data-access.ts

// ─── READ FROM EXISTING COLLECTIONS ──────────────────────

export async function getVessels(config: OptimizerAppConfig) {
  const { collectionName, fields } = config.fieldMappings.vessels;
  return queryWithMapping(collectionName, fields);
}

export async function getNoonReports(
  config: OptimizerAppConfig,
  vesselIdentifier: string,
  dateRange?: { from: Date; to: Date }
) {
  const { collectionName, fields } = config.fieldMappings.noonReports;
  const filter: any = { [fields.vesselIdentifier]: vesselIdentifier };
  if (dateRange) {
    filter[fields.date] = { $gte: dateRange.from, $lte: dateRange.to };
  }
  return queryWithMapping(collectionName, fields, filter, {
    sort: { [fields.date]: -1 }
  });
}

export async function getVoyageSchedule(
  config: OptimizerAppConfig,
  vesselIdentifier: string
) {
  const { collectionName, fields } = config.fieldMappings.voyages;
  return queryWithMapping(collectionName, fields, {
    [fields.vesselIdentifier]: vesselIdentifier
  }, {
    sort: { [fields.eta]: 1 }
  });
}

export async function getPricingForPorts(
  config: OptimizerAppConfig,
  portNames: string[]
) {
  const { collectionName, fields } = config.fieldMappings.pricing;
  return queryWithMapping(collectionName, fields, {
    [fields.portName]: { $in: portNames }
  });
}

// ─── WRITE TO NEW COLLECTIONS (app-owned) ────────────────

export async function savePurchasePlan(plan: PurchasePlan) {
  const { db } = await connectToDatabase();
  return db.collection('purchase_plans').insertOne(plan);
}

export async function getPurchasePlans(vesselId: string) {
  const { db } = await connectToDatabase();
  return db.collection('purchase_plans')
    .find({ vesselId })
    .sort({ generatedAt: -1 })
    .toArray();
}

export async function saveAppConfig(config: OptimizerAppConfig) {
  const { db } = await connectToDatabase();
  return db.collection('optimizer_config').updateOne(
    { companyId: config.companyId },
    { $set: config },
    { upsert: true }
  );
}

export async function getAppConfig(companyId: string) {
  const { db } = await connectToDatabase();
  return db.collection('optimizer_config').findOne({ companyId });
}
```

---

## 4. THE OPTIMIZATION ENGINE

### 4.1 Algorithm: Forward-Looking Dynamic Programming

Implement as a standalone, **pure function** with ZERO database dependencies. The data access layer transforms raw MongoDB documents into these normalized types before passing to the engine.

#### File: `lib/optimizer/engine.ts`

```typescript
// ─── INPUT TYPES (normalized — NOT raw MongoDB shapes) ────

interface OptimizerInput {
  vessel: {
    name: string;
    tanks: TankState[];
  };
  route: PortStop[];
  prices: PriceMatrix;
  config: OptimizerConfig;
}

interface TankState {
  gradeId: string;
  gradeName: string;
  category: 'CYLINDER' | 'ME_SYSTEM' | 'AE_SYSTEM' | 'OTHER';
  currentROB: number;
  minimumROB: number;
  tankCapacity: number;
  avgDailyConsumption: number;
  consumptionPer1000hrs: number;
  avgDailyRunningHours: number;
}

interface PortStop {
  portId: string;
  portName: string;
  eta: Date;
  etd: Date;
  seaDaysToNext: number;
  legOrder: number;
}

interface PriceMatrix {
  [portId: string]: {
    [gradeId: string]: {
      landedCost: number;
      isAvailable: boolean;
      minOrderQty?: number;
      leadTimeDays?: number;
    };
  };
}

interface OptimizerConfig {
  windowSize: number;
  safetyBuffer: number;
  roundToNearest: number;
  systemOilAggressiveness: number;
}

// ─── OUTPUT TYPES ─────────────────────────────────────────

interface OptimizerOutput {
  vesselName: string;
  generatedAt: Date;
  totalEstimatedCost: number;
  totalQuantity: { [gradeId: string]: number };
  portDecisions: PortDecision[];
  alerts: Alert[];
  savingsEstimate: {
    optimizedCost: number;
    naiveCost: number;
    savingsPercent: number;
  };
}

interface PortDecision {
  portId: string;
  portName: string;
  eta: Date;
  legOrder: number;
  seaDaysToNext: number;
  grades: { [gradeId: string]: GradeDecision };
}

interface GradeDecision {
  robOnArrival: number;
  legConsumption: number;
  projectedROBAtNextPort: number;
  pricePerLiter: number | null;
  isAvailable: boolean;
  action: 'BUY_MAX' | 'BUY_MIN' | 'BUY_BRIDGE' | 'SKIP' | 'ALERT' | 'NO_ACTION';
  recommendedQty: number;
  estimatedCost: number;
  reasoning: string;
  runway: number;
  isCheapestInWindow: boolean;
  isCritical: boolean;
  cheapestPortInWindow: string | null;
  cheapestPriceInWindow: number | null;
}

interface Alert {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  portName: string;
  gradeId: string;
  message: string;
}
```

### 4.2 Data Transformation Layer

**Transforms raw MongoDB documents → normalized OptimizerInput**

```typescript
// lib/optimizer/transform.ts

export function buildOptimizerInput(
  vesselName: string,
  tankConfigs: TankConfig[],
  noonReports: any[],       // Already field-mapped
  voyageLegs: any[],        // Already field-mapped
  pricing: any[],           // Already field-mapped
  config: OptimizerConfig
): OptimizerInput {
  const tanks = buildTankStates(tankConfigs, noonReports);
  const route = buildRoute(voyageLegs);
  const prices = buildPriceMatrix(pricing, route);
  return { vessel: { name: vesselName, tanks }, route, prices, config };
}
```

### 4.3 The Algorithm — Step by Step

```
FUNCTION optimize(input: OptimizerInput) -> OptimizerOutput:

  FOR EACH oil grade independently:
    
    SET rob = currentROB for this grade
    SET route = full port sequence
    SET window = config.windowSize (default 5)
    
    FOR EACH port P[i] in route (index 0 to N-1):
      
      // STEP 1: Calculate consumption on this leg
      IF grade is CYLINDER:
        legConsumption = avgDailyConsumption × seaDaysToNext
      ELSE (system oil):
        dailyRate = consumptionPer1000hrs × avgDailyRunningHours / 1000
        legConsumption = dailyRate × seaDaysToNext
      
      // STEP 2: Project ROB at next port
      projectedROBNextPort = rob - legConsumption
      
      // STEP 3: Calculate runway
      runway = 0
      testROB = rob
      FOR j = i TO N-2:
        testROB -= consumption(j)
        IF testROB < minimumROB × safetyBuffer: BREAK
        runway += 1
      
      // STEP 4: Feasibility check
      mustBuy = (projectedROBNextPort < minimumROB × safetyBuffer) AND (i < N-1)
      isCritical = mustBuy
      
      // STEP 5: Find cheapest in forward window
      windowEnd = min(i + windowSize, N-1)
      cheapest = { port: null, price: Infinity, index: -1 }
      FOR j = i TO windowEnd:
        IF price at P[j] exists AND < cheapest.price:
          cheapest = { port: P[j].name, price: price[P[j]], index: j }
      
      isCheapestInWindow = (price at P[i] exists) AND (price at P[i] <= cheapest.price)
      
      // STEP 6: Check if cheaper port is reachable
      canReachCheaper = TRUE
      IF cheapest.index > i:
        testROB = rob
        FOR j = i TO cheapest.index - 1:
          testROB -= consumption(j)
          IF testROB < minimumROB × safetyBuffer:
            canReachCheaper = FALSE
            BREAK
      
      // STEP 7: Decision logic
      
      IF i == N-1 (last port):
        action = NO_ACTION, qty = 0
      
      ELSE IF grade not available at P[i]:
        IF mustBuy:
          action = ALERT, qty = 0
          ADD ALERT (severity: CRITICAL)
        ELSE:
          action = SKIP, qty = 0
      
      ELSE IF isCheapestInWindow:
        forwardDemand = SUM of consumption for next `windowSize` legs
        maxBuy = tankCapacity - rob
        optimalQty = min(maxBuy, forwardDemand - (rob - minimumROB))
        qty = max(0, round(optimalQty, roundToNearest))
        action = BUY_MAX
      
      ELSE IF mustBuy AND NOT canReachCheaper:
        minNeeded = (minimumROB × safetyBuffer) + legConsumption - rob
        qty = max(0, round(minNeeded, roundToNearest))
        action = BUY_MIN
      
      ELSE IF NOT canReachCheaper AND runway <= 1:
        consumptionToCheaper = SUM consumption from i to cheapest.index
        bridgeQty = consumptionToCheaper + (minimumROB × safetyBuffer) - rob
        qty = max(0, min(round(bridgeQty, roundToNearest), tankCapacity - rob))
        action = BUY_BRIDGE
      
      ELSE:
        qty = 0
        action = SKIP
      
      // STEP 8: System oil adjustment
      IF grade.category in [ME_SYSTEM, AE_SYSTEM]:
        IF action == SKIP AND runway <= 2:
          qty = round(legConsumption × 1.5, roundToNearest)
          action = BUY_MIN
      
      // STEP 9: Update ROB for next iteration
      rob = rob + qty - legConsumption
      
      STORE decision for P[i] × grade
    
  RETURN all decisions + summary + alerts
```

### 4.4 Savings Estimation

```
naiveCost: At each port where available, buy exactly enough for next leg.
optimizedCost: Sum of recommended purchases × prices.
savingsPercent = (naiveCost - optimizedCost) / naiveCost × 100
```

### 4.5 Consumption Forecasting

#### Cylinder Oil (daily):
```
Weighted rolling average from last 90 days:
weightedAvg = SUM(consumption[i] × weight[i]) / SUM(weight[i])
where weight[i] = 1 / (daysSinceReport[i] + 1)
```

#### System Oils (periodic):
```
consumptionPer1000hrs = SUM(topUpQty) / (totalRunningHours / 1000)
dailyRate = consumptionPer1000hrs × avgDailyRunningHours / 1000
Apply 20-30% safety buffer.
```

---

## 4A. OPTIMIZER V2 — PRACTICAL MARITIME PROCUREMENT MODEL

### 4A.1 Why V2 Was Needed

The original V1 optimizer (Section 4) used a greedy "cheapest port in window → BUY_MAX" approach. This produced unrealistic plans:

| V1 Problem | Real-World Reality |
|------------|-------------------|
| Bought at every cheap port | Deliveries have fixed charges ($300-1000+) regardless of volume |
| Filled tanks to 85% max | Nobody maximizes ROB — superintendents target ~70% fill |
| No minimum order quantities | Suppliers won't deliver less than 10,000L for system oils |
| BUY_MAX/BUY_MIN/BRIDGE actions | Real decisions are: "Do I need oil?" and "Is this a good price?" |
| "Naive" baseline (buy everywhere) | Real alternative is a reactive superintendent who buys only when forced |

**V2 Philosophy: "Skip by default. Buy only when urgent or opportunistic."**

### 4A.2 V2 Algorithm — Urgency + Opportunity Triggers

The V2 engine processes each port and makes a binary decision: **buy or skip**. The only reasons to buy are:

#### Trigger 1: URGENCY (Must Buy)
```
IF projected ROB at next priced port < minRob × robTriggerMultiplier (default 1.2x):
  → ACTION: URGENT
  → QUANTITY: Fill to targetFillPct × tankCapacity (default 70%)
  → This is a forced purchase — price doesn't matter
```

The urgency check looks ahead not just to the next port, but to the **next port where oil is actually available** for purchase. If there are 5 ports ahead but only 2 have pricing, the engine calculates whether ROB can survive the consumption across all intervening sea days.

#### Trigger 2: OPPORTUNITY (Good Price)
```
IF port price ≤ routeAveragePrice × (1 - opportunityDiscountPct/100) (default 10% below avg):
  AND computed quantity ≥ minOrderQty for that grade:
  → ACTION: ORDER
  → QUANTITY: Fill to targetFillPct × tankCapacity (default 70%)
  → This is a voluntary purchase — price is attractive enough to justify delivery charge
```

The route average price is computed across **all ports in the schedule** that have pricing for each grade. Only ports with non-null, positive prices are included.

#### Default: SKIP
```
IF neither urgency nor opportunity triggers:
  → ACTION: SKIP
  → QUANTITY: 0
  → No delivery charge incurred
```

#### Alert: ALERT
```
IF ROB will breach minRob AND no price available at this port:
  → ACTION: ALERT
  → QUANTITY: 0
  → Flag for superintendent attention
```

### 4A.3 Delivery Charges

**Core concept**: Every bunkering event (oil delivery to a vessel in port) incurs a **fixed delivery charge**, regardless of volume. Whether you order 500L or 50,000L, the delivery charge is the same.

```
Delivery Charge Rules:
- ONE charge per port where ANY purchase is made (shared across all grades)
- Default: $500 per event (configurable per port)
- If ordering multiple grades at the same port → ONE delivery charge total
- Delivery charge is added to total optimized cost
- Baseline comparison also includes delivery charges for baseline purchases
```

**Configuration:**
```typescript
interface DeliveryChargeConfig {
  defaultCharge: number;                    // USD per bunkering event (default: 500)
  portOverrides: Record<string, number>;    // portCode → custom charge
}
```

**Why this matters**: Without delivery charges, the optimizer might suggest buying small quantities at 10 different ports. With delivery charges, it consolidates into 2-3 larger purchases — matching real-world behavior.

### 4A.4 Minimum Order Quantities

Suppliers enforce minimum order quantities. It's not practical to order 500L of system oil.

| Oil Grade | Minimum Order | Rationale |
|-----------|--------------|-----------|
| Cylinder Oil | 0 (no minimum) | Consumed continuously, high volume |
| ME System Oil (Circulating) | 10,000 L | Supplier minimum for crankcase oil |
| AE System Oil (Circulating) | 10,000 L | Supplier minimum for crankcase oil |

**Enforcement logic:**
```
IF computed quantity < minOrderQty for a grade:
  IF trigger was URGENT:
    → Round UP to minOrderQty (must buy, even if it means buying more)
    → Cap at available tank space (targetFillPct × capacity - currentROB)
  IF trigger was OPPORTUNITY:
    → SKIP this grade (opportunity not worth it for sub-minimum quantity)
```

### 4A.5 Target Fill Percentage

**V1** filled to 85% (max fill).
**V2** fills to 70% (target fill) — configurable via slider (50-90%).

```
targetQuantity = (targetFillPct × tankCapacity) - robOnArrival
actualQuantity = max(targetQuantity, minOrderQty)  // for URGENT
actualQuantity = min(actualQuantity, tankCapacity × maxFillPct - robOnArrival)  // never exceed max
```

The difference between `targetFillPct` (70%) and `maxFillPct` (85%) provides headroom for emergency purchases.

### 4A.6 ROB Trigger Multiplier

Controls how early the urgency trigger fires.

| Multiplier | Meaning | Behavior |
|------------|---------|----------|
| 1.0x | Trigger at exactly minRob | Aggressive — buys only at last possible moment |
| 1.2x (default) | Trigger at 120% of minRob | Balanced — small buffer above minimum |
| 1.5x | Trigger at 150% of minRob | Conservative — more headroom |
| 2.0x | Trigger at 200% of minRob | Very conservative |

### 4A.7 Opportunity Discount Threshold

Controls what qualifies as a "good price" for voluntary purchases.

| Discount % | Meaning | Behavior |
|-----------|---------|----------|
| 5% | Buy if 5% below route average | More frequent purchases |
| 10% (default) | Buy if 10% below route average | Balanced |
| 15% | Buy if 15% below route average | Selective — only deep discounts |
| 25% | Buy if 25% below route average | Very selective — rare purchases |

### 4A.8 Baseline Comparison (Replaces "Naive Cost")

**V1** compared against "naive cost" = buy at every port to max fill. This was unrealistic.

**V2** compares against a "reactive superintendent" baseline:

```
BASELINE ALGORITHM (reactive superintendent):
  FOR EACH port:
    FOR EACH grade:
      IF ROB < 1.0x minRob AND price available:
        → Buy to targetFillPct × capacity
        → Incur delivery charge (once per port)
      ELSE:
        → SKIP
```

This models what happens **without** the optimizer: a superintendent who waits until ROB hits the minimum, then buys whatever is available at the current port at whatever price. No forward-looking, no price comparison.

The optimizer's advantage comes from:
1. **Buying at cheaper ports** (opportunity trigger catches low prices)
2. **Fewer delivery events** (strategic consolidation)
3. **Better timing** (urgency trigger fires slightly above minimum, giving more port choices)

### 4A.9 V2 Purchase Actions

| Action | Badge Color | When | Quantity |
|--------|------------|------|----------|
| `ORDER` | Green | Price is ≥10% below route average AND min order met | Fill to 70% target |
| `URGENT` | Orange | ROB will breach 1.2x minimum before next priced port | Fill to 70% target |
| `SKIP` | Gray | No urgency, no opportunity | 0 |
| `ALERT` | Red (pulsing) | ROB will breach minimum AND no price available | 0 (needs attention) |

### 4A.10 V2 Type Changes

```typescript
// New types added to types.ts

export interface DeliveryChargeConfig {
  defaultCharge: number;          // USD per bunkering event (default: 500)
  portOverrides: Record<string, number>;  // portCode → charge
}

export interface MinOrderConfig {
  cylinderOil: number;    // 0 (no minimum)
  meSystemOil: number;    // 10,000 L
  aeSystemOil: number;    // 10,000 L
}

export interface ReorderConfig {
  targetFillPct: number;              // 0.70 = fill to 70% of capacity
  robTriggerMultiplier: number;       // 1.2 = trigger when ROB < 1.2x minROB
  opportunityDiscountPct: number;     // 10 = buy if price 10%+ below route avg
}

// Updated PurchaseAction (V2)
export type PurchaseAction =
  | 'ORDER'     // Opportunity buy — good price
  | 'URGENT'    // Must buy — ROB critically low
  | 'SKIP'      // Don't buy — adequate ROB, no price opportunity
  | 'ALERT';    // ROB will breach minimum — no price available

// Updated OptimizerInput (V2)
export interface OptimizerInput {
  vessel: Vessel;
  ports: PortStop[];
  currentRob: Record<OilGradeCategory, number>;
  oilGrades: OilGradeConfig[];
  windowSize: number;
  safetyBufferPct: number;
  deliveryCharges: DeliveryChargeConfig;
  minOrderQty: MinOrderConfig;
  reorderConfig: ReorderConfig;
}

// Updated PortStop (V2 — adds delivery charge)
export interface PortStop {
  // ... existing fields ...
  deliveryCharge: number;           // USD — fixed charge for bunkering at this port
}

// Updated PortPlan (V2 — adds delivery charge)
export interface PortPlan {
  // ... existing fields ...
  deliveryCharge: number;           // USD — charged once if any grade purchased here
  hasPurchase: boolean;             // true if any grade has ORDER or URGENT
}

// Updated OptimizerOutput (V2)
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
  totalDeliveryCharges: number;     // sum of delivery charges for purchase events
  purchaseEvents: number;           // count of ports where purchases were made
  baselineCost: {                   // renamed from naiveCost
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
```

### 4A.11 V2 Environment Variables

```env
# Delivery Charges
DELIVERY_CHARGE_DEFAULT=500

# Minimum Order Quantities (liters)
MIN_ORDER_QTY_ME_SYSTEM=10000
MIN_ORDER_QTY_AE_SYSTEM=10000

# Reorder Triggers
REORDER_ROB_TRIGGER_MULTIPLIER=1.2
OPPORTUNITY_DISCOUNT_PCT=10
TARGET_FILL_PCT=70
```

### 4A.12 V2 Settings UI

Three new configuration cards added to `/settings`:

1. **Delivery Charges** — Default charge (USD), per-port overrides (future)
2. **Minimum Order Quantities** — ME System Oil (L), AE System Oil (L)
3. **Reorder Triggers** — Target Fill %, ROB Trigger Multiplier, Opportunity Discount %

### 4A.13 V2 Optimizer UI Controls

| Control | Type | Default | Range | Description |
|---------|------|---------|-------|-------------|
| Look-ahead Window | Slider | 5 | 3-10 | Ports to scan for price comparison |
| Safety Buffer | Slider | 10% | 0-25% | Extra consumption buffer on forecasts |
| Target Fill | Slider | 70% | 50-90% | How full to fill tanks when ordering |
| Opportunity Discount | Slider | 10% | 5-25% | Price threshold for voluntary purchase |
| ROB Trigger | Slider | 1.2x | 1.0-2.0x | When urgency kicks in (multiplier on minRob) |
| Delivery Charge | Input | $500 | number | Fixed cost per bunkering event |

### 4A.14 Expected V2 Results

For a vessel with 27 future ports (real ONE HARBOUR data):

| Metric | V1 (Old) | V2 (New) |
|--------|----------|----------|
| Purchase events | ~15-20 | 2-4 |
| Actions shown | BUY_MAX at most ports | SKIP at most ports, ORDER/URGENT at 2-4 |
| Delivery charges | Not modeled | $1,000-2,000 (2-4 events × $500) |
| Behavior | "Buy everywhere cheap" | "Buy only when needed or price is very good" |
| Baseline | "Buy everywhere to max fill" | "Reactive superintendent buys when forced" |

---

## 4B. OPTIMIZER V3 — SMART MULTI-STRATEGY OPTIMIZER

### 4B.1 Problem Statement

The V2 optimizer uses a single-pass greedy approach that decides ORDER/SKIP at each port independently. This can produce negative savings for certain voyages because:

1. **Opportunity buys ignore delivery economics** — buying at a marginally cheaper port triggers a $500 delivery charge that exceeds the price savings
2. **Grades decide independently** — one grade can trigger a solo delivery event when it could piggyback on another grade's delivery at a different port
3. **No global planning** — the engine never evaluates whether waiting for a cheaper future port is safer and cheaper

### 4B.2 Solution: Multi-Strategy Approach

Run **4 strategies** in parallel, rank all results by total all-in cost (oil + delivery charges), return top 5 plans.

### 4B.3 Strategies

#### Strategy 1: Grid Search (parametric sweep)
Run existing `runOptimizer()` with ~360 parameter combinations:
- `targetFillPct`: [0.55, 0.60, 0.65, 0.70, 0.75, 0.80]
- `opportunityDiscountPct`: [5, 10, 15, 20, 25]
- `robTriggerMultiplier`: [1.0, 1.2, 1.4, 1.6]
- `windowSize`: [3, 5, 7]

Pure math, <50ms total. The grid naturally discovers parameter combos where unnecessary buys are suppressed.

#### Strategy 2: Cheapest-Port (backward planning)
New algorithm that plans like a human superintendent:
1. Walk forward to find "need windows" — stretches where a purchase MUST happen to stay above minROB
2. Within each window, pick the port with the **lowest price**
3. Buy enough to reach the NEXT need window
4. Cross-grade consolidation: if Port X already has a delivery, check if other grades should piggyback

#### Strategy 3: Delivery-Aware (post-processing gate)
Run existing optimizer, then filter: for each OPPORTUNITY buy, check `(routeAvgPrice - portPrice) × quantity > deliveryCharge`. Reject buys that don't justify the delivery cost. Re-simulate ROB forward to fix projections.

#### Strategy 4: Consolidated (minimize delivery events)
Score each port by combined value across all 3 grades: `sum_grades((avgPrice - portPrice) × estimatedQty) - deliveryCharge`. Greedily select highest-score ports until all grades are covered for entire voyage. Ensures ROB stays above minROB throughout.

### 4B.4 Architecture

```
runSmartOptimizer(baseInput, config) → SmartOptimizerResult
  ├─ Grid search: loop over param combos, call runOptimizer() each time
  ├─ Cheapest-port: call runCheapestPortStrategy()
  ├─ Delivery-aware: call runDeliveryAwareStrategy()
  ├─ Consolidated: call runConsolidatedStrategy()
  ├─ Sort all results by totalAllInCost ascending
  ├─ Deduplicate (same cost + events = same plan)
  └─ Return top N
```

### 4B.5 Types

```typescript
type StrategyName = 'grid' | 'cheapest-port' | 'delivery-aware' | 'consolidated';

interface SmartOptimizerConfig {
  strategies: StrategyName[];
  topN: number;
  deliveryChargeDefault: number;
  grid: {
    targetFillPcts: number[];
    opportunityDiscountPcts: number[];
    robTriggerMultipliers: number[];
    windowSizes: number[];
  };
}

interface RankedPlan {
  rank: number;
  strategy: StrategyName;
  strategyLabel: string;
  params?: Record<string, number>;
  output: OptimizerOutput;
  allInCost: number;
  baselineAllInCost: number;
  savings: number;
  savingsPct: number;
}

interface SmartOptimizerResult {
  plans: RankedPlan[];
  baseline: { cost: number; oilCost: number; deliveryCharges: number; purchaseEvents: number };
  combinationsEvaluated: number;
  elapsedMs: number;
}
```

### 4B.6 API Endpoint

```
POST /api/optimizer/smart
Body: { vesselId, deliveryChargeDefault?, strategies?, topN? }
Response: { result: SmartOptimizerResult, oilGrades: OilGradeConfig[] }
```

### 4B.7 UI

The optimize page adds a **Smart** tab alongside the existing **Standard** tab:
- Standard tab: preserved exactly as-is (sliders + single run)
- Smart tab: delivery charge input, strategy checkboxes, "Run Smart Optimizer" button
- Results: `RankedPlansTable` showing top 5 plans ranked by cost
- Clicking [View] on a plan expands to show full detail (reuses existing SavingsSummary, PurchasePlanTable, ROBProjectionChart, PriceComparisonChart)
- "Save This Plan" button on expanded plan view

### 4B.8 Performance

- Grid search: 360 calls × ~0.1ms each = ~36ms
- Cheapest-port: ~5ms
- Delivery-aware: ~2ms
- Consolidated: ~5ms
- **Total server-side: <100ms**

### 4B.9 Files

| File | Purpose |
|------|---------|
| `src/lib/optimizer/types.ts` | Added StrategyName, SmartOptimizerConfig, RankedPlan, SmartOptimizerResult |
| `src/lib/optimizer/engine.ts` | Exported computeBaseline, computeRouteAveragePrice, getPortPrice |
| `src/lib/optimizer/smart-optimizer.ts` | Orchestrator — runs all strategies, ranks, deduplicates |
| `src/lib/optimizer/strategies/cheapest-port.ts` | Backward-planning algorithm with cross-grade consolidation |
| `src/lib/optimizer/strategies/delivery-aware.ts` | Post-processing delivery gate on existing optimizer |
| `src/lib/optimizer/strategies/consolidated.ts` | Delivery-minimizing strategy |
| `src/app/api/optimizer/smart/route.ts` | Smart optimizer API endpoint |
| `src/components/optimizer/ranked-plans-table.tsx` | Ranked plans table with expandable detail |
| `src/components/optimizer/strategy-badge.tsx` | Color-coded strategy badges |
| `src/app/vessels/[vesselId]/optimize/page.tsx` | Added Smart tab with strategy controls |

---

## 5. APP STRUCTURE & PAGES

### 5.1 Directory Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout with sidebar
│   ├── page.tsx                      # Dashboard (fleet overview)
│   ├── vessels/
│   │   ├── page.tsx                  # Vessel list
│   │   └── [vesselId]/
│   │       ├── page.tsx              # Vessel detail + ROB
│   │       ├── schedule/page.tsx     # Voyage schedule
│   │       ├── consumption/page.tsx  # Consumption history
│   │       └── optimize/page.tsx     # ⭐ MAIN OPTIMIZER PAGE
│   ├── ports/
│   │   ├── page.tsx                  # Port list
│   │   └── [portId]/page.tsx         # Port detail
│   ├── pricing/
│   │   └── page.tsx                  # Price matrix
│   ├── plans/
│   │   ├── page.tsx                  # All purchase plans
│   │   └── [planId]/page.tsx         # Plan detail
│   ├── import/
│   │   └── page.tsx                  # Data import
│   ├── reports/
│   │   └── page.tsx                  # Analytics
│   ├── setup/
│   │   └── page.tsx                  # ⭐ SETUP WIZARD
│   ├── settings/
│   │   └── page.tsx                  # Settings
│   └── api/
│       ├── vessels/route.ts
│       ├── vessels/[id]/route.ts
│       ├── voyages/[vesselId]/route.ts
│       ├── pricing/route.ts
│       ├── optimizer/
│       │   ├── run/route.ts          # POST — run optimization
│       │   ├── smart/route.ts        # POST — smart multi-strategy optimizer
│       │   └── plans/route.ts        # GET/POST — plans
│       ├── consumption/[vesselId]/route.ts
│       ├── import/route.ts
│       ├── reports/route.ts
│       └── config/
│           ├── route.ts              # GET/POST config
│           ├── test-connection/route.ts
│           ├── collections/route.ts  # List MongoDB collections
│           └── fields/[collection]/route.ts  # Get field names
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Breadcrumb.tsx
│   ├── optimizer/
│   │   ├── OptimizerDashboard.tsx
│   │   ├── PurchasePlanTable.tsx
│   │   ├── RouteTimeline.tsx
│   │   ├── PriceComparisonChart.tsx
│   │   ├── ROBProjectionChart.tsx
│   │   ├── ActionBadge.tsx
│   │   ├── SavingsSummary.tsx
│   │   ├── RankedPlansTable.tsx       # Smart optimizer ranked results
│   │   └── StrategyBadge.tsx          # Color-coded strategy badges
│   ├── vessels/
│   │   ├── VesselCard.tsx
│   │   ├── TankStatusBar.tsx
│   │   └── ConsumptionChart.tsx
│   ├── setup/
│   │   ├── SetupWizard.tsx
│   │   ├── CollectionPicker.tsx
│   │   ├── FieldMapper.tsx
│   │   └── ConnectionTester.tsx
│   ├── data-import/
│   │   ├── ExcelUploader.tsx
│   │   ├── ColumnMapper.tsx
│   │   └── ImportPreview.tsx
│   └── common/
│       ├── DataTable.tsx
│       ├── DateRangePicker.tsx
│       └── StatCard.tsx
├── lib/
│   ├── db/
│   │   ├── mongodb.ts                # Connection singleton
│   │   ├── field-mapper.ts           # Field mapping query helper
│   │   └── data-access.ts            # All MongoDB queries
│   ├── optimizer/
│   │   ├── engine.ts                 # ⭐ Core algorithm (PURE FUNCTION)
│   │   ├── smart-optimizer.ts        # Multi-strategy orchestrator
│   │   ├── transform.ts              # MongoDB docs → OptimizerInput
│   │   ├── consumption-forecast.ts
│   │   ├── types.ts
│   │   ├── strategies/
│   │   │   ├── cheapest-port.ts      # Backward-planning strategy
│   │   │   ├── delivery-aware.ts     # Post-processing delivery gate
│   │   │   └── consolidated.ts       # Delivery-minimizing strategy
│   │   └── __tests__/
│   │       ├── engine.test.ts
│   │       └── fixtures.ts
│   ├── import/
│   │   ├── noon-report-parser.ts
│   │   ├── schedule-parser.ts
│   │   └── price-parser.ts
│   └── utils/
│       ├── date.ts
│       └── format.ts
└── public/
```

### 5.2 Page Descriptions

#### ⭐ Setup Wizard (`/setup`) — BUILD FIRST

Step-by-step MongoDB configuration:

1. **Test Connection** — Verify MONGODB_URI works, run `db.admin().ping()`
2. **Select Collections** — Run `db.listCollections()`, user picks which has vessels, noon reports, voyages, pricing
3. **Map Fields** — Run `collection.findOne()` to show field names, user maps each to expected fields. Supports nested fields (dot notation like `engine.cylinder.consumption`)
4. **Configure Oil Grades** — Define grades to track (cylinder, ME system, AE system)
5. **Configure Vessels** — Query vessel collection, user sets tank capacity + minimum ROB per grade per vessel
6. **Validation Run** — Test query, show counts, run sample optimization
7. **Save** — Store all config in `optimizer_config` collection

#### Dashboard (`/`)
- All vessels with ROB status (green/amber/red)
- Upcoming purchases from active plans
- Alerts (critical ROB, price changes)
- Fleet spending summary

#### ⭐ Optimizer Page (`/vessels/[id]/optimize`)
Three tabs:

**Tab 1: Purchase Plan Table**
| Port | ETA | Sea Days | ROB | Leg Consumption | ROB @ Next | Price | Action | Qty | Cost | Reasoning |
- Color-coded ROB, action badges, editable overrides with downstream recalculation

**Tab 2: Route Timeline**
- Horizontal port timeline with ROB bars, consumption connectors, price chart

**Tab 3: ROB Projection Chart**
- Recharts line chart, minimum ROB line, saw-tooth pattern

**Controls:** Window size slider, safety buffer slider, grade selector, save/export/recalculate

#### Price Matrix (`/pricing`)
- Port × grade grid, color-coded, editable, bulk import

---

## 6. API ROUTES

```typescript
// ─── CONFIG ──────────────────────────────────────────────
GET  /api/config                       // Get app config
POST /api/config                       // Save config
POST /api/config/test-connection       // Test MongoDB
GET  /api/config/collections           // List all collections
GET  /api/config/fields/:collection    // Get field names from collection

// ─── VESSELS (reads EXISTING collection) ─────────────────
GET  /api/vessels                      // List vessels
GET  /api/vessels/:id                  // Vessel detail + ROB

// ─── VOYAGES (reads EXISTING collection) ─────────────────
GET  /api/voyages/:vesselId            // Voyage schedule

// ─── PRICING (reads EXISTING collection) ─────────────────
GET  /api/pricing                      // Full price matrix
POST /api/pricing                      // Manual override (writes to app collection)

// ─── CONSUMPTION (reads EXISTING collection) ─────────────
GET  /api/consumption/:vesselId        // Noon reports + trends
GET  /api/consumption/:vesselId/forecast // Consumption forecast

// ─── OPTIMIZER ───────────────────────────────────────────
POST /api/optimizer/run                // ⭐ Run optimization
POST /api/optimizer/plans              // Save plan
GET  /api/optimizer/plans              // List plans
GET  /api/optimizer/plans/:planId      // Get plan
PATCH /api/optimizer/plans/:planId     // Update plan

// ─── IMPORT / REPORTS ────────────────────────────────────
POST /api/import/parse                 // Parse Excel → preview
POST /api/import/commit                // Write to MongoDB
GET  /api/reports/spending             // Spending analysis
GET  /api/reports/savings              // Savings report
GET  /api/reports/export               // Export Excel
```

### 6.1 Example: Main Optimizer Endpoint

```typescript
// app/api/optimizer/run/route.ts

import { NextResponse } from 'next/server';
import { getAppConfig, getNoonReports, getVoyageSchedule, getPricingForPorts } from '@/lib/db/data-access';
import { buildOptimizerInput } from '@/lib/optimizer/transform';
import { optimize } from '@/lib/optimizer/engine';

export async function POST(request: Request) {
  const { vesselName, windowSize, safetyBuffer } = await request.json();
  
  // 1. Get field mapping config
  const config = await getAppConfig('default');
  if (!config) return NextResponse.json({ error: 'Run setup wizard first.' }, { status: 400 });
  
  // 2. Get vessel tank config
  const vesselConfig = config.vesselConfigs.find(v => v.vesselIdentifier === vesselName);
  if (!vesselConfig) return NextResponse.json({ error: 'Vessel not configured.' }, { status: 400 });
  
  // 3. Fetch from EXISTING MongoDB collections
  const noonReports = await getNoonReports(config, vesselName, {
    from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    to: new Date()
  });
  const voyageLegs = await getVoyageSchedule(config, vesselName);
  const portNames = voyageLegs.map(leg => leg.portName);
  const pricing = await getPricingForPorts(config, portNames);
  
  // 4. Transform MongoDB docs → OptimizerInput
  const optimizerInput = buildOptimizerInput(
    vesselName, vesselConfig.tanks, noonReports, voyageLegs, pricing,
    { windowSize: windowSize || 5, safetyBuffer: safetyBuffer || 1.1,
      roundToNearest: 100, systemOilAggressiveness: 0.6 }
  );
  
  // 5. Run pure optimization engine
  const result = optimize(optimizerInput);
  return NextResponse.json(result);
}
```

---

## 7. DATA IMPORT FORMATS

### 7.1 Noon Report Excel

| Column | Type | Required | Example |
|--------|------|----------|---------|
| Date | Date | Yes | 2026-03-15 |
| Vessel Name | String | Yes | MV Alpha |
| ME Cyl Oil Consumption (L) | Number | Yes | 120 |
| ME Cyl Oil ROB (L) | Number | Yes | 4500 |
| ME System Oil Consumption (L) | Number | No | 0 |
| ME System Oil ROB (L) | Number | Yes | 3200 |
| AE System Oil Consumption (L) | Number | No | 0 |
| AE System Oil ROB (L) | Number | Yes | 2000 |
| ME Running Hours | Number | Recommended | 18.5 |
| AE Running Hours | Number | Recommended | 22.0 |

### 7.2 Voyage Schedule Excel

| Column | Type | Required | Example |
|--------|------|----------|---------|
| Vessel Name | String | Yes | MV Alpha |
| Port | String | Yes | Singapore |
| ETA | DateTime | Yes | 2026-03-01 08:00 |
| ETD | DateTime | Yes | 2026-03-03 14:00 |

### 7.3 Pricing Excel

| Column | Type | Required | Example |
|--------|------|----------|---------|
| Port | String | Yes | Singapore |
| Oil Grade | String | Yes | ME Cylinder Oil 100BN |
| Product Price ($/L) | Number | Yes | 1.85 |
| Bunkering Charge ($/L) | Number | No | 0.15 |
| Available | Boolean | Yes | Yes |

---

## 8. UI/UX SPECIFICATIONS

### 8.1 Design System

- **Theme:** Dark maritime / operations dashboard
- **Primary:** Blue (#3b82f6)
- **Accents:** Amber (#f59e0b), Purple (#8b5cf6), Green (#10b981), Red (#ef4444)
- **Background:** Dark navy (#020617 → #0f172a → #1e293b)
- **Typography:** JetBrains Mono for data, Geist for UI
- **Data density:** High

### 8.2 Key Components

- **Action Badges:** BUY MAX (green), BUY MIN (amber), BRIDGE (orange), SKIP (gray), ALERT (red pulsing)
- **Tank Level Bars:** Fill %, red/amber/green zones, minimum ROB line
- **Price Heat Map:** Green = cheapest, Red = most expensive, Gray = unavailable

---

## 9. AI INTEGRATION (LAYER 2 — FUTURE)

### 9.1 Claude API for Plan Insights

```typescript
// lib/ai/insights.ts
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

async function generatePlanInsights(plan: OptimizerOutput): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: `Analyze this lube oil purchase plan...${JSON.stringify(plan)}` }]
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}
```

### 9.2 Future AI Roadmap

| Phase | Feature | Complexity |
|-------|---------|------------|
| 1 | Natural Language Insights (Claude) | Low |
| 2 | Consumption Anomaly Detection | Medium |
| 3 | Price Trend Prediction | High |
| 4 | What-if Scenario Modeling | Medium |
| 5 | Multi-Vessel Fleet Optimization | High |

---

## 10. TESTING

### 10.1 Optimizer Engine Tests

```typescript
describe('Optimization Engine', () => {
  test('buys at cheapest port when ROB allows skipping');
  test('forces purchase when ROB below minimum');
  test('ALERT when oil unavailable but critical');
  test('NO_ACTION at last port');
  test('applies safety buffer');
  test('system oils get conservative treatment');
  test('savings calculation correct');
  test('rounds to nearest 100L');
  test('never exceeds tank capacity');
  test('full 10+ port route works end-to-end');
});
```

### 10.2 MongoDB Integration Tests

```typescript
describe('Data Access', () => {
  test('connects to MongoDB');
  test('field mapper translates correctly');
  test('queries return expected shapes');
  test('transform layer produces valid OptimizerInput');
});
```

---

## 11. DEPLOYMENT

```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=your_database_name
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://app.example.com
ANTHROPIC_API_KEY=sk-ant-xxx  # Optional, Layer 2
```

---

## 12. BUILD PRIORITY

### Phase 1: Foundation + Setup (Week 1)
1. Next.js project + MongoDB native driver connection
2. Field mapper utility
3. **Setup wizard** — collection picker, field mapper, connection tester
4. App config collection + data access layer
5. Vessel tank configuration UI

### Phase 2: Core Optimizer (Week 2)
6. Optimization engine (pure function) + full test suite
7. Data transformation layer
8. `/api/optimizer/run` endpoint
9. Optimizer page with purchase plan table

### Phase 3: Visualization (Week 3)
10. Route timeline, ROB chart, price charts
11. Vessel list + detail pages
12. Dashboard

### Phase 4: Plan Management (Week 4)
13. Save/load plans, approval workflow, execution tracking
14. Excel import/export

### Phase 5: AI & Analytics (Week 5+)
15. Claude API insights, savings reports, consumption trends

---

## 13. IMPORTANT IMPLEMENTATION NOTES

1. **Optimizer engine = pure function.** No database calls. Data access layer fetches + transforms BEFORE passing to engine.
2. **Field mapping is the critical bridge.** Never hardcode MongoDB field names. Always use mapping from `optimizer_config`.
3. **READ-ONLY on existing collections.** NEVER write to user's existing data. All writes go to new app-owned collections (`purchase_plans`, `optimizer_config`).
4. **Prices per-liter in USD.** Convert $/MT using density (~0.9 kg/L → 1 MT ≈ 1111L).
5. **ROB in liters.** Convert other units at transformation layer.
6. **Sea days = ETD current port → ETA next port** (not ETA to ETA).
7. **Window size default 5**, configurable 3-10.
8. **Manual overrides** recalculate downstream but don't auto-change other ports.
9. **Flag expired prices** as "estimated" for future voyages.
10. **Consumption weighted rolling average** from 90 days of noon reports.
11. **Naive cost baseline** = buy at every port for next leg only.
12. **Suggest MongoDB indexes** to user but don't create on their collections.

---

## 14. GLOSSARY

| Term | Definition |
|------|-----------|
| ROB | Remaining On Board — oil quantity in vessel's tanks (liters) |
| Minimum ROB | Company policy minimum to maintain at all times |
| Landed Cost | Product price + bunkering charge + surcharges per liter |
| Leg | Voyage segment between two consecutive ports |
| Sea Days | Days at sea between ports (ETD to next ETA) |
| Cylinder Oil | ME cylinder lubricant — consumed daily, predictable |
| System Oil | Engine crankcase lubricant — periodic top-up, less predictable |
| Noon Report | Daily vessel report with position, speed, consumption, ROB |
| Window Size | Forward ports evaluated for price comparison |
| Runway | Ports/legs vessel can survive without purchasing |
| Field Mapping | Config translating user's MongoDB fields to app's expected names |

---

*End of specification. Hand this to Claude Code along with your MongoDB connection string, database name, and collection names. During setup, you'll map your actual field names through the setup wizard.*
