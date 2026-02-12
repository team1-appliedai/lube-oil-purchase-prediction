# Lube Oil Purchase Optimizer - Technical Reference

Reference document for AI agents operating this application via browser automation (MCP) or direct API calls.

---

## System Overview

- **Stack:** Next.js 14 (App Router), TypeScript, MongoDB, Recharts
- **Base URL:** `http://localhost:3000` (dev) or deployed URL
- **Optimizer:** Pure functions, deterministic, no ML/AI. All computation is server-side in API routes.
- **Data source:** MongoDB collections for vessels, consumption logs, schedules, prices

---

## Data Model

### Oil Grade Categories

Three oil types, referenced throughout as `OilGradeCategory`:

| Category Key | Label | Typical Tank Capacity | Typical Min ROB | Typical Min Order Qty |
|-------------|-------|----------------------|-----------------|----------------------|
| `cylinderOil` | Cylinder Oil | 100,000 L | Dynamic (60 days x daily consumption) | 0 (no minimum) |
| `meSystemOil` | ME System Oil | 95,000 L | 30,000 L | 10,000 L |
| `aeSystemOil` | AE System Oil | 20,000 L | 5,000 L | 10,000 L |

### Core Data Structures

#### `OptimizerInput` (what goes into the optimizer)

| Field | Type | Description |
|-------|------|-------------|
| `vessel` | `Vessel` | `{ vesselId, vesselName, vesselCode, vesselType, fleet, lubeSupplier }` |
| `ports` | `PortStop[]` | Ordered list of future ports with prices, sea days, delivery charges |
| `currentRob` | `{ cylinderOil: number, meSystemOil: number, aeSystemOil: number }` | Current oil levels in liters, from latest noon report |
| `oilGrades` | `OilGradeConfig[]` | Tank config + consumption rate per grade |
| `windowSize` | `number` | Look-ahead ports (default: 5) |
| `safetyBufferPct` | `number` | Extra % on consumption estimates (default: 10) |
| `deliveryCharges` | `DeliveryChargeConfig` | `{ defaultCharge: number, portOverrides: Record<string, number> }` |
| `minOrderQty` | `MinOrderConfig` | `{ cylinderOil: 0, meSystemOil: 10000, aeSystemOil: 10000 }` |
| `reorderConfig` | `ReorderConfig` | `{ targetFillPct: 0.70, robTriggerMultiplier: 1.2, opportunityDiscountPct: 10 }` |

#### `PortStop` (one entry per port in the schedule)

| Field | Type | Description |
|-------|------|-------------|
| `portName` | `string` | e.g., "HAMBURG, HH" |
| `portCode` | `string` | e.g., "DEHAM" |
| `country` | `string` | e.g., "GERMANY" |
| `arrivalDate` | `string` | ISO date |
| `departureDate` | `string` | ISO date |
| `seaDaysToNext` | `number` | Calendar days from departure to next port arrival |
| `deliveryCharge` | `number` | USD flat fee per delivery event at this port |
| `prices.cylinderOil` | `number \| null` | Best price in USD/L for vessel's supplier, or null if unavailable |
| `prices.meSystemOil` | `number \| null` | Same |
| `prices.aeSystemOil` | `number \| null` | Same |

#### `OilGradeConfig` (per oil type)

| Field | Type | Description |
|-------|------|-------------|
| `category` | `OilGradeCategory` | `"cylinderOil"`, `"meSystemOil"`, or `"aeSystemOil"` |
| `label` | `string` | Human-readable name |
| `tankConfig.capacity` | `number` | Maximum tank capacity in liters |
| `tankConfig.minRob` | `number` | Minimum safe ROB in liters |
| `avgDailyConsumption` | `number` | Liters/day, weighted average from last 6 months of noon reports |

---

## API Endpoints

### 1. Standard Optimizer

```
POST /api/optimizer/run
```

**Request body:**
```json
{
  "vesselId": "string (MongoDB ObjectId)",
  "windowSize": 5,
  "safetyBufferPct": 10,
  "targetFillPct": 70,
  "opportunityDiscountPct": 10,
  "robTriggerMultiplier": 1.2,
  "deliveryChargeDefault": 500,
  "minOrderQtyMe": 10000,
  "minOrderQtyAe": 10000,
  "tankOverrides": {
    "cylinderOil": { "capacity": 100000, "minRob": 30000 },
    "meSystemOil": { "capacity": 95000, "minRob": 30000 },
    "aeSystemOil": { "capacity": 20000, "minRob": 5000 }
  }
}
```

Note: `targetFillPct` is sent as a percentage (70) but stored internally as a decimal (0.70).

**Response:**
```json
{
  "result": { /* OptimizerOutput */ },
  "oilGrades": [ /* OilGradeConfig[] */ ]
}
```

### 2. Smart Multi-Strategy Optimizer

```
POST /api/optimizer/smart
```

**Request body:**
```json
{
  "vesselId": "string (MongoDB ObjectId)",
  "safetyBufferPct": 10,
  "deliveryChargeDefault": 5000,
  "minOrderQtyMe": 10000,
  "minOrderQtyAe": 10000,
  "strategies": ["grid", "cheapest-port", "delivery-aware", "consolidated"],
  "topN": 5,
  "tankOverrides": { }
}
```

**Response:**
```json
{
  "result": {
    "plans": [
      {
        "rank": 1,
        "strategy": "delivery-aware",
        "strategyLabel": "Delivery-Aware",
        "output": { /* full OptimizerOutput */ },
        "allInCost": 19187,
        "baselineAllInCost": 19215,
        "savings": 28,
        "savingsPct": 0.1,
        "safe": true,
        "robBreaches": 0
      }
    ],
    "baseline": {
      "cost": 19215,
      "oilCost": 9215,
      "deliveryCharges": 10000,
      "purchaseEvents": 2
    },
    "combinationsEvaluated": 363,
    "elapsedMs": 8
  },
  "oilGrades": [ /* OilGradeConfig[] */ ]
}
```

### 3. Save a Purchase Plan

```
POST /api/plans
```

**Request body:**
```json
{
  "vesselId": "string",
  "vesselName": "string",
  "optimizerOutput": { /* OptimizerOutput */ },
  "notes": "optional string"
}
```

### 4. List Saved Plans

```
GET /api/plans?vesselId=<vesselId>
```

---

## OptimizerOutput Structure

The output from any optimizer run (standard or smart strategy):

```json
{
  "vesselId": "abc123",
  "vesselName": "ONE HARBOUR",
  "ports": [
    {
      "portName": "HAMBURG, HH",
      "portCode": "DEHAM",
      "country": "GERMANY",
      "arrivalDate": "2025-06-08",
      "departureDate": "2025-06-09",
      "seaDaysToNext": 2.1,
      "deliveryCharge": 5000,
      "actions": {
        "cylinderOil": {
          "action": "URGENT",
          "quantity": 22579,
          "cost": 7572,
          "pricePerLiter": 0.3354,
          "robOnArrival": 47421,
          "robOnDeparture": 70000,
          "robAtNextPort": 68500
        },
        "meSystemOil": {
          "action": "SKIP",
          "quantity": 0,
          "cost": 0,
          "pricePerLiter": 0,
          "robOnArrival": 69128,
          "robOnDeparture": 69128,
          "robAtNextPort": 68800
        },
        "aeSystemOil": {
          "action": "SKIP",
          "quantity": 0,
          "cost": 0,
          "pricePerLiter": 0,
          "robOnArrival": 19000,
          "robOnDeparture": 19000,
          "robAtNextPort": 18750
        }
      }
    }
  ],
  "totalCost": {
    "cylinderOil": 7572,
    "meSystemOil": 0,
    "aeSystemOil": 1615,
    "total": 9187
  },
  "totalDeliveryCharges": 10000,
  "purchaseEvents": 2,
  "baselineCost": {
    "cylinderOil": 7572,
    "meSystemOil": 0,
    "aeSystemOil": 1643,
    "total": 9215
  },
  "baselineDeliveryCharges": 10000,
  "baselinePurchaseEvents": 2,
  "savings": {
    "cylinderOil": 0,
    "meSystemOil": 0,
    "aeSystemOil": 28,
    "total": 28,
    "pct": 0.1
  },
  "generatedAt": "2025-06-01T12:00:00.000Z"
}
```

### Action Types

| Action | Meaning | When It Triggers |
|--------|---------|-----------------|
| `ORDER` | Standard purchase | Price is below route average by opportunity discount % |
| `URGENT` | Must-buy purchase | ROB will drop below minRob before next priced port |
| `SKIP` | No purchase | ROB is adequate, or no price advantage |
| `ALERT` | Warning flag | ROB will breach minRob AND no price available at this port |

---

## Calculation Logic - Step by Step

### Step 0: Data Preparation (`buildOptimizerInput`)

**File:** `src/lib/optimizer/transform.ts`

1. Fetch vessel, consumption records, schedule, prices, supplier mapping from MongoDB
2. Compute `avgDailyConsumption` per grade:
   - Parse noon reports into daily consumption values
   - Compute weighted average (last 6 months, recent months weighted higher)
3. Get `currentRob` from the most recent noon report
4. Build `TankConfig` per grade:
   - Cylinder oil minRob = `avgDailyConsumption.cylinderOil * 60` (60 days of supply)
   - ME/AE system oil minRob = fixed values from environment or defaults
5. Filter prices to vessel's contracted supplier (fuzzy match on supplier name)
6. Build `PortStop[]` from schedule:
   - `seaDaysToNext` = (next port arrival - this port departure) in days
   - `deliveryCharge` = port override or default
   - `prices` = lowest price per grade from supplier's price list at that port

### Step 1: Compute Route Average Price

**Function:** `computeRouteAveragePrice(ports, oilGrades)`

```
For each grade:
  routeAvgPrice[grade] = average of all non-null prices across all ports
```

Used by the standard optimizer for opportunity detection and by strategies for scoring.

### Step 2: Compute Safety Buffer

```
buffer = 1 + safetyBufferPct / 100
// Example: safetyBufferPct = 10 → buffer = 1.10
```

All consumption calculations multiply by `buffer`:
```
consumptionToNext = port.seaDaysToNext * avgDailyConsumption * buffer
```

### Step 3: ROB Simulation (Forward Walk)

The core calculation that ALL strategies share. For each port in sequence:

```
robOnArrival = previous port's robAtNextPort (or currentRob for first port)
robOnDeparture = robOnArrival + purchaseQuantity
robAtNextPort = robOnDeparture - (seaDaysToNext * avgDailyConsumption * buffer)
```

### Step 4: Standard Optimizer Decision Logic

**File:** `src/lib/optimizer/engine.ts`, function `determineAction()`

For each port, for each grade:

```
1. If no price at this port:
   - Check if ROB will breach minRob before next priced port
   - If yes → ALERT
   - If no → SKIP

2. If voyage is safe (ROB stays above minRob for entire remaining voyage without buying):
   - Skip urgency check, only consider opportunity buys

3. Urgency check (if voyage NOT safe):
   - urgencyThreshold = minRob * robTriggerMultiplier
   - If ROB will drop below urgencyThreshold before next priced port → URGENT
   - Quantity = max(0, targetFill - robOnArrival), capped by tank capacity

4. Opportunity check:
   - If priceAtPort <= routeAvgPrice * (1 - opportunityDiscountPct / 100) → ORDER
   - Quantity = max(0, targetFill - robOnArrival), subject to minimum order qty

5. Otherwise → SKIP
```

Where:
```
targetFill = tankConfig.capacity * targetFillPct
```

### Step 5: Baseline Calculation

**Function:** `computeBaseline(input, buffer)`

Simulates a reactive superintendent:
```
For each port, for each grade:
  robAtNextIfNoBuy = robOnArrival - consumptionToNext
  if robAtNextIfNoBuy < minRob AND priceAvailable:
    Buy: quantity = max(0, targetFill - robOnArrival)
    Cost += quantity * priceAtPort
  Delivery charge added once per port if any grade purchased
```

### Step 6: Savings Calculation

```
totalOptimized = sum(oilCosts per grade) + totalDeliveryCharges
totalBaseline = sum(baselineCosts per grade) + baselineDeliveryCharges

savings.total = totalBaseline - totalOptimized
savings.pct = (savings.total / totalBaseline) * 100
```

Per-grade savings:
```
savings[grade] = baselineCost[grade] - totalCost[grade]
```

---

## Smart Optimizer Strategies - Detailed Logic

**File:** `src/lib/optimizer/smart-optimizer.ts`

### Strategy 1: Grid Search

**File:** `smart-optimizer.ts`, function `runGridSearch()`

```
For each combination of:
  targetFillPct in [0.55, 0.60, 0.65, 0.70, 0.75, 0.80]
  opportunityDiscountPct in [5, 10, 15, 20, 25]
  robTriggerMultiplier in [1.0, 1.2, 1.4, 1.6]
  windowSize in [3, 5, 7]

  1. Create modifiedInput with these parameters
  2. Run standard optimizer: baseOutput = runOptimizer(modifiedInput)
  3. Extract allocations: allocs = extractAllocations(baseOutput)
  4. Consolidate deliveries: consolidateDeliveries(modifiedInput, allocs, buffer)
  5. Rebuild output: output = buildOutputWithAlerts(modifiedInput, allocs, buffer)
  6. Validate safety: { safe, robBreaches } = validatePlanSafety(output)
  7. Record: allInCost = output.totalCost.total + output.totalDeliveryCharges
```

Total combinations: 6 x 5 x 4 x 3 = 360

### Strategy 2: Cheapest Port

**File:** `src/lib/optimizer/strategies/cheapest-port.ts`

```
Phase 1: Independent grade planning (for each grade):
  allocations[grade] = empty map

  Repeat until no more breaches:
    1. Simulate ROB forward with current allocations → robAtPort[]
    2. Find first breach: port where robAtPort[i] - consumption < minRob
    3. If no breach → done for this grade
    4. Define window: [lastPurchasePort+1 .. breachPort]
    5. Find cheapest priced port in window
    6. Allocate: quantity = min(targetFill - robAtPort, tankCapacity - robAtPort)

Phase 2: Cross-grade consolidation
  For each port with existing allocation:
    For each grade NOT buying at this port:
      If grade has a future solo delivery (only grade buying at another port):
        priceDiff = priceHere - priceThere
        extraOilCost = qty * priceDiff
        If extraOilCost < futureDeliveryCharge * 0.8:
          Piggyback: add purchase here, reduce/remove future purchase

Phase 3: Delivery consolidation (consolidateDeliveries)

Phase 4: Build output (buildOutputWithAlerts)
```

### Strategy 3: Delivery-Aware

**File:** `src/lib/optimizer/strategies/delivery-aware.ts`

```
1. Run standard optimizer → baseResult
2. Extract allocations from baseResult
3. Apply consolidateDeliveries() (worthiness + proximity)
4. Build output with buildOutputWithAlerts()
```

### Strategy 4: Consolidated

**File:** `src/lib/optimizer/strategies/consolidated.ts`

```
Phase 1: Score each port
  For each port with any price:
    score = -deliveryCharge  (penalty)
    For each grade with price at this port:
      priceDiff = routeAvgPrice[grade] - portPrice
      estimatedQty = tankCapacity * targetFillPct * 0.5
      score += priceDiff * estimatedQty
    Sort ports by score descending

Phase 2: Safety-driven allocation
  For each grade:
    Walk forward, find where ROB breaches minRob
    In each breach window, pick the highest-scored port
    Allocate: quantity = min(targetFill - robAtPort, capacity - robAtPort)

Phase 3: Piggyback pass
  For each selected port:
    For each grade not yet buying there:
      If portPrice <= routeAvgPrice * 1.05:
        Add purchase (fill to target)

Phase 4: Delivery consolidation (consolidateDeliveries)

Phase 5: Build output (buildOutputWithAlerts)
```

---

## Delivery Consolidation Logic

**File:** `src/lib/optimizer/strategies/consolidate-deliveries.ts`

Applied as a post-processing step to ALL strategies.

```
Repeat until no changes (max 10 iterations):

  Pass A — Worthiness check:
    deliveryPorts = ports with any allocation
    For each delivery port:
      oilValue = sum(quantity * price) across all grades
      ratio = oilValue / deliveryCharge
    Find port with worst (lowest) ratio
    If worstRatio < 2.0:
      Sort other delivery ports by proximity (sea-days)
      For each candidate (nearest first):
        Try to move ALL purchases from worst port → candidate
        If merge succeeds (safety verified) → apply and restart

  Pass B — Proximity merge:
    For each consecutive pair of delivery ports (A, B):
      seaDays = sum of seaDaysToNext from A to B
      If seaDays > 10: skip
      Determine smaller/larger by oil value
      extraCost = sum((priceAtDest - priceAtSource) * qty) per grade
      If extraCost < savedDeliveryCharge * 0.9:
        Try full merge (move all from smaller → larger)
        If merge succeeds → apply and restart
```

### Merge Verification (`verifyAllocations`)

Before applying any merge, verify the resulting allocations:

```
For each grade:
  rob = currentRob[grade]
  For each port (0 to N):
    qty = allocation at this port (or 0)
    If rob + qty > tankCapacity * 1.01: FAIL (overflow)
    rob = rob + qty - (seaDaysToNext * avgDailyConsumption * buffer)
    If rob < minRob AND seaDaysToNext > 0 AND not last port: FAIL (safety breach)
Return PASS
```

### Extract Allocations (`extractAllocations`)

Converts an `OptimizerOutput` into allocation maps:

```
For each port index i:
  For each grade:
    If output.ports[i].actions[grade].quantity > 0:
      allocations[grade].set(i, quantity)
```

---

## Plan Safety Validation

**File:** `src/lib/optimizer/strategies/build-output.ts`, function `validatePlanSafety()`

```
robBreaches = 0
For each port in output.ports:
  For each grade:
    If action.robAtNextPort < minRob AND seaDaysToNext > 0:
      robBreaches += 1
    If action.robAtNextPort < 0:
      robBreaches += 5  (heavy penalty for negative ROB)

safe = (robBreaches === 0)
```

---

## Plan Ranking

**File:** `smart-optimizer.ts`

```
Sort all plans:
  1. Safe plans (robBreaches = 0) always rank above unsafe plans
  2. Among safe plans: sort by allInCost ascending (cheapest first)
  3. Among unsafe plans: sort by robBreaches ascending, then allInCost ascending

Deduplicate by fingerprint:
  fingerprint = round(allInCost*100) + purchaseEvents + round(deliveryCharges*100) + safe

Return top N plans (default 5), assign rank 1..N
```

---

## UI Navigation (for browser automation)

### Page: Vessel List
- **URL:** `/vessels`
- **Elements:** Table rows with vessel names, click to navigate to vessel detail

### Page: Vessel Detail
- **URL:** `/vessels/[vesselId]`
- **Elements:** Tabs for Overview, Consumption, Schedule, Optimize

### Page: Optimize
- **URL:** `/vessels/[vesselId]/optimize`
- **Tabs:** "Standard" and "Smart"

**Standard tab:**
- Sliders: Window Size (1-10), Safety Buffer (0-25%), Target Fill (50-95%), Opportunity Discount (0-30%), ROB Trigger (1.0-2.0x)
- Input: Delivery Charge (USD)
- Button: "Run Optimizer"
- Results: Savings summary, purchase plan table, ROB projection chart, price comparison chart

**Smart tab:**
- Input: Delivery Charge (USD)
- Strategy toggles: Grid Search, Cheapest Port, Delivery-Aware, Consolidated
- Button: "Run Smart Optimizer"
- Results: Ranked plans table with Safety badge, strategy badge, all-in cost, savings, events
- Each plan expandable to show full detail (same components as standard)
- "Save This Plan" button on expanded plan (disabled for unsafe plans)

---

## File Map

```
src/lib/optimizer/
  types.ts              — All type definitions
  engine.ts             — Standard optimizer + baseline + helpers
  transform.ts          — MongoDB data → OptimizerInput
  smart-optimizer.ts    — Multi-strategy orchestrator + grid search
  consumption-forecast.ts — Daily consumption calculation from noon reports
  strategies/
    cheapest-port.ts    — Backward-planning cheapest port strategy
    delivery-aware.ts   — Standard optimizer + delivery consolidation
    consolidated.ts     — Minimize delivery events strategy
    consolidate-deliveries.ts — Shared delivery consolidation post-processor
    build-output.ts     — Shared output builder + safety validation

src/app/api/optimizer/
  run/route.ts          — POST endpoint for standard optimizer
  smart/route.ts        — POST endpoint for smart multi-strategy optimizer

src/app/api/plans/
  route.ts              — GET (list) and POST (save) purchase plans

src/app/vessels/[vesselId]/optimize/
  page.tsx              — Optimizer UI page (Standard + Smart tabs)

src/components/optimizer/
  ranked-plans-table.tsx  — Smart optimizer results table
  strategy-badge.tsx      — Color-coded strategy badges
  savings-summary.tsx     — Cost comparison summary cards
  purchase-plan-table.tsx — Per-port action table
  rob-projection-chart.tsx — ROB line chart across voyage
  price-comparison-chart.tsx — Price bar chart across ports
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPTIMIZER_WINDOW_SIZE` | 5 | Look-ahead ports |
| `OPTIMIZER_SAFETY_BUFFER_PCT` | 10 | Consumption buffer % |
| `DELIVERY_CHARGE_DEFAULT` | 500 | USD per delivery event |
| `TARGET_FILL_PCT` | 70 | Target fill percentage |
| `OPPORTUNITY_DISCOUNT_PCT` | 10 | Price discount threshold % |
| `REORDER_ROB_TRIGGER_MULTIPLIER` | 1.2 | Urgency trigger multiplier |
| `TANK_CAPACITY_CYLINDER` | 100000 | Cylinder oil tank (L) |
| `TANK_CAPACITY_ME_SYSTEM` | 95000 | ME system oil tank (L) |
| `TANK_CAPACITY_AE_SYSTEM` | 20000 | AE system oil tank (L) |
| `CYLINDER_MIN_ROB_DAYS` | 60 | Days of supply for cylinder min ROB |
| `MIN_ROB_ME_SYSTEM` | 30000 | ME system oil min ROB (L) |
| `MIN_ROB_AE_SYSTEM` | 5000 | AE system oil min ROB (L) |
| `MIN_ORDER_QTY_ME_SYSTEM` | 10000 | ME system oil minimum order (L) |
| `MIN_ORDER_QTY_AE_SYSTEM` | 10000 | AE system oil minimum order (L) |

---

## Quick Reference: Key Formulas

```
buffer = 1 + safetyBufferPct / 100

consumptionToNext = seaDaysToNext * avgDailyConsumption * buffer

targetFill = tankCapacity * targetFillPct

purchaseQuantity = min(targetFill - robOnArrival, tankCapacity - robOnArrival)

robOnDeparture = robOnArrival + purchaseQuantity

robAtNextPort = robOnDeparture - consumptionToNext

urgencyThreshold = minRob * robTriggerMultiplier

isOpportunity = priceAtPort <= routeAvgPrice * (1 - opportunityDiscountPct / 100)

deliveryWorthRatio = totalOilValueAtPort / deliveryCharge  (must be >= 2.0)

mergeSavings = savedDeliveryCharge - extraOilCost  (merge if > 10% of delivery charge)

allInCost = totalOilCost + totalDeliveryCharges

savings = baselineAllInCost - allInCost
```
