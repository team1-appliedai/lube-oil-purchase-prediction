# Lube Oil Purchase Optimizer - AI Agent Guide

Reference document for AI agents operating this dashboard via Chrome MCP browser automation or direct API calls.

---

## What This Dashboard Does

This is a **Lube Oil Purchase Optimizer** for maritime vessels. It helps fleet superintendents decide **when, where, and how much** lubricating oil to buy across a vessel's port rotation, minimizing total cost (oil price + delivery charges) while ensuring the vessel never runs out of oil.

Three oil types are tracked:

| Oil Type | Key | Typical Tank | Min ROB | Min Order |
|----------|-----|-------------|---------|-----------|
| Cylinder Oil | `cylinderOil` | 100,000 L | Dynamic (60 days supply) | 0 L |
| ME System Oil | `meSystemOil` | 95,000 L | 30,000 L | 10,000 L |
| AE System Oil | `aeSystemOil` | 20,000 L | 5,000 L | 10,000 L |

---

## System Architecture

- **Stack:** Next.js 14 (App Router), TypeScript, MongoDB, Recharts
- **Base URL:** `http://localhost:3000` (dev)
- **Optimizer:** Pure deterministic functions (no ML/AI). All computation server-side.
- **Data:** MongoDB collections for vessels, consumption logs, schedules, prices, supplier mappings

---

## Navigation Structure

The dashboard has a fixed top navigation bar with these pages:

| Nav Item | URL | Purpose |
|----------|-----|---------|
| Dashboard | `/` | Fleet overview with vessel count, active vessels, quick links |
| Vessels | `/vessels` | Grid of vessel cards showing name, code, type, fleet, supplier |
| Pricing | `/pricing` | Pricing matrix table (all ports, all suppliers, all oil types) |
| Plans | `/plans` | Saved purchase plans with approval workflow |
| Docs | `/documentation` | Business + technical documentation viewer |
| Settings | `/settings` | Optimizer configuration |
| Setup | `/setup` | Initial database setup |

### Vessel Sub-Pages

From `/vessels`, clicking a vessel card navigates to:

| URL | Purpose |
|-----|---------|
| `/vessels/[vesselId]` | Vessel detail: info, tank status, avg consumption, upcoming schedule, action buttons |
| `/vessels/[vesselId]/consumption` | Consumption history: ROB chart over time + filterable data table |
| `/vessels/[vesselId]/optimize` | Purchase optimizer with **Smart** (default) and **Standard** tabs |

---

## API Reference

All APIs are relative to the base URL. All responses are JSON.

### 1. Vessels

#### List All Vessels

```
GET /api/vessels
```

**Response:** Array of vessel objects.

```json
[
  {
    "vesselId": "9806079",
    "vesselName": "ONE HARBOUR",
    "vesselCode": "OHRB",
    "vesselType": "Container Ship",
    "fleet": "ONE",
    "lubeSupplier": "Total",
    "isActive": true
  }
]
```

**Caching:** 5 minutes.

---

#### Get Single Vessel

```
GET /api/vessels/[id]
```

**Path parameter:** `id` - The vessel ID (IMO number as string).

**Response:** Single vessel object (same shape as list item), or `404`.

**Caching:** 5 minutes.

---

### 2. Consumption Logs

```
GET /api/consumption/[vesselId]
```

**Path parameter:** `vesselId` - The vessel ID.

**Query parameters (optional):**

| Param | Type | Description |
|-------|------|-------------|
| `startDate` | ISO date string | Filter logs from this date |
| `endDate` | ISO date string | Filter logs up to this date |

**Example:** `GET /api/consumption/9806079?startDate=2025-01-01&endDate=2025-06-01`

**Response:** Array of consumption records sorted by report date ascending.

```json
[
  {
    "vesselId": "9806079",
    "vesselName": "ONE HARBOUR",
    "reportDate": "2025-05-15T12:00:00.000Z",
    "reportType": "Noon",
    "state": "At Sea",
    "cylinderOilRob": 47421,
    "meSystemOilRob": 69128,
    "aeSystemOilRob": 19000,
    "cylinderOilConsumption": 150,
    "meSystemOilConsumption": 35,
    "aeSystemOilConsumption": 12,
    "meRunningHours": 24,
    "aeRunningHours": 18,
    "portOfOrigin": "ROTTERDAM",
    "portOfDestination": "HAMBURG",
    "eta": "2025-05-16T08:00:00.000Z",
    "avgSpeed": 14.5
  }
]
```

**Caching:** 5 minutes.

---

### 3. Voyages / Schedule

```
GET /api/voyages/[vesselId]
```

**Path parameter:** `vesselId` - The vessel ID.

**Response:** Array of scheduled port calls.

```json
[
  {
    "portName": "HAMBURG, HH",
    "portCode": "DEHAM",
    "country": "GERMANY",
    "arrivalDate": "2025-06-08T06:00:00.000Z",
    "departureDate": "2025-06-09T18:00:00.000Z",
    "isCurrentPort": false,
    "voyageNo": "025E"
  }
]
```

**Note:** The API tries two data sources: first a scraped nested collection (`onesea-vessel-schedule-scraped`), then falls back to a flat `voyage_schedule` collection.

**Caching:** 5 minutes.

---

### 4. Pricing

```
GET /api/pricing
```

**Query parameters (optional):**

| Param | Type | Description |
|-------|------|-------------|
| `supplier` | string | Filter by supplier name |

**Response:** Array of port price objects. Prices are in **USD per liter** (converted from USD/MT using a divisor of 1111).

```json
[
  {
    "country": "GERMANY",
    "port": "HAMBURG",
    "supplier": "TotalEnergies Marine Fuels",
    "cylinderOilLS": { "TALUSIA OPTIMA 4015": 0.3354 },
    "cylinderOilHS": { "TALUSIA UNIVERSAL 5015": 0.3150 },
    "meCrankcaseOil": { "AURELIA TI 4040": 0.2970 },
    "aeCrankcaseOil": { "AURELIA TI 4040": 0.2970 }
  }
]
```

Each oil category contains a map of `productName -> pricePerLiter`. The optimizer picks the lowest price per category.

**Caching:** 10 minutes.

---

### 5. Standard Optimizer

```
POST /api/optimizer/run
```

Runs a single optimization pass with user-specified parameters.

**Request body:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `vesselId` | string | **required** | Vessel ID (IMO) |
| `windowSize` | number | 5 | Look-ahead ports (3-10) |
| `safetyBufferPct` | number | 10 | Extra % on consumption (0-25) |
| `targetFillPct` | number | 70 | Target fill % (50-90). Sent as integer, converted to decimal internally. |
| `opportunityDiscountPct` | number | 10 | Price discount threshold % (5-25) |
| `robTriggerMultiplier` | number | 1.2 | Urgency trigger as multiplier of minROB (1.0-2.0) |
| `deliveryChargeDefault` | number | 500 | USD flat fee per delivery event |
| `minOrderQtyMe` | number | 10000 | ME system oil minimum order (L) |
| `minOrderQtyAe` | number | 10000 | AE system oil minimum order (L) |
| `tankOverrides` | object | null | Override tank configs (see below) |

**Tank overrides shape:**
```json
{
  "cylinderOil": { "capacity": 100000, "minRob": 30000 },
  "meSystemOil": { "capacity": 95000, "minRob": 30000 },
  "aeSystemOil": { "capacity": 20000, "minRob": 5000 }
}
```

**Response:**

```json
{
  "result": { /* OptimizerOutput - see structure below */ },
  "oilGrades": [ /* OilGradeConfig[] with tank configs and avg consumption */ ]
}
```

---

### 6. Smart Multi-Strategy Optimizer

```
POST /api/optimizer/smart
```

Runs **4 optimization strategies** (360+ parameter combinations) and returns the best plans ranked by cost.

**Request body:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `vesselId` | string | **required** | Vessel ID (IMO) |
| `safetyBufferPct` | number | 10 | Safety buffer % |
| `deliveryChargeDefault` | number | 500 | USD per delivery event |
| `minOrderQtyMe` | number | 10000 | ME min order (L) |
| `minOrderQtyAe` | number | 10000 | AE min order (L) |
| `strategies` | string[] | all 4 | Which strategies to run |
| `topN` | number | 5 | How many ranked plans to return |
| `tankOverrides` | object | null | Override tank configs |

**Available strategies:** `"grid"`, `"cheapest-port"`, `"delivery-aware"`, `"consolidated"`

**Response:**

```json
{
  "result": {
    "plans": [
      {
        "rank": 1,
        "strategy": "delivery-aware",
        "strategyLabel": "Delivery-Aware",
        "params": {},
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

---

### 7. Purchase Plans

#### List Plans

```
GET /api/optimizer/plans
```

**Query parameters (optional):**

| Param | Type | Description |
|-------|------|-------------|
| `vesselId` | string | Filter plans by vessel |

**Response:** Array of saved plans, sorted by `createdAt` descending.

---

#### Save Plan

```
POST /api/optimizer/plans
```

**Request body:**

```json
{
  "vesselId": "9806079",
  "vesselName": "ONE HARBOUR",
  "optimizerOutput": { /* OptimizerOutput from optimizer run */ },
  "notes": "Optional notes"
}
```

Plans are created with status `"draft"`.

**Response:** `{ "id": "mongo_object_id" }`

---

#### Update Plan Status

```
PATCH /api/optimizer/plans
```

**Request body:**

```json
{
  "planId": "mongo_object_id",
  "status": "submitted"
}
```

**Valid statuses:** `"draft"`, `"submitted"`, `"approved"`, `"rejected"`

---

### 8. Configuration

#### Get Config

```
GET /api/config
```

Returns merged environment defaults + saved config overrides.

**Response:**

```json
{
  "tankCapacityCylinder": 100000,
  "tankCapacityMeSystem": 95000,
  "tankCapacityAeSystem": 20000,
  "tankMaxFillPct": 85,
  "minRobMeSystem": 30000,
  "minRobAeSystem": 5000,
  "cylinderMinRobDays": 60,
  "windowSize": 5,
  "safetyBufferPct": 10,
  "priceMtToLDivisor": 1111
}
```

#### Save Config

```
POST /api/config
```

**Request body:** Any subset of config keys to override.

---

#### Test Connection

```
GET /api/config/test-connection
```

**Response:** `{ "ok": true, "collections": ["vessels", "prices", ...] }`

---

#### List Collections

```
GET /api/config/collections
```

**Response:** `{ "collections": ["common_vessel_details", "lube_oil_prices", ...] }`

---

#### Get Collection Fields

```
GET /api/config/fields/[collection]
```

**Path parameter:** `collection` - MongoDB collection name.

**Response:** `{ "fields": ["_id", "vesselName", "vesselCode", ...] }`

---

### 9. Documentation

```
GET /api/documentation
```

Returns the raw markdown content of the two documentation files.

**Response:**

```json
{
  "business": "# Lube Oil Purchase Optimizer - How It Works\n...",
  "technical": "# Lube Oil Purchase Optimizer - Technical Reference\n..."
}
```

---

## OptimizerOutput Structure

This is the core output from any optimizer run:

```json
{
  "vesselId": "9806079",
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
        "aeSystemOil": { "..." }
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
  "baselineCost": { "cylinderOil": 7572, "meSystemOil": 0, "aeSystemOil": 1643, "total": 9215 },
  "baselineDeliveryCharges": 10000,
  "baselinePurchaseEvents": 2,
  "savings": { "cylinderOil": 0, "meSystemOil": 0, "aeSystemOil": 28, "total": 28, "pct": 0.1 },
  "generatedAt": "2025-06-01T12:00:00.000Z"
}
```

### Action Types

| Action | Meaning | When |
|--------|---------|------|
| `ORDER` | Standard purchase | Price is below route average by opportunity discount % |
| `URGENT` | Must-buy | ROB will drop below minRob before next priced port |
| `SKIP` | No purchase | ROB is adequate or no price advantage |
| `ALERT` | Warning | ROB will breach minimum AND no price available at this port |

---

## Optimizer Logic Summary

### The Problem

A vessel needs 3 types of lube oil, visits multiple ports with varying prices, and each delivery incurs a flat fee ($500-$10,000). Goal: minimize total cost (oil + delivery charges) while never running out.

### Baseline (What to Compare Against)

A "reactive superintendent" who only buys when oil level will drop below minimum at the next port. This is the do-nothing-smart scenario. Savings are measured against this baseline.

### Key Formulas

```
buffer = 1 + safetyBufferPct / 100
consumptionToNext = seaDaysToNext * avgDailyConsumption * buffer
targetFill = tankCapacity * targetFillPct
purchaseQty = min(targetFill - robOnArrival, tankCapacity - robOnArrival)
robAtNextPort = robOnDeparture - consumptionToNext
urgencyThreshold = minRob * robTriggerMultiplier
isOpportunity = priceAtPort <= routeAvgPrice * (1 - opportunityDiscountPct / 100)
allInCost = totalOilCost + totalDeliveryCharges
savings = baselineAllInCost - allInCost
```

### Smart Optimizer: 4 Strategies

| # | Strategy | How It Works |
|---|----------|-------------|
| 1 | **Grid Search** | Tries 360 combinations of targetFillPct, opportunityDiscount, robTrigger, windowSize. Keeps best. |
| 2 | **Cheapest Port** | Finds where oil will run out ("breach points"), then buys at the cheapest port in each breach window. |
| 3 | **Delivery-Aware** | Runs standard optimizer, then post-processes to eliminate wasteful delivery events. |
| 4 | **Consolidated** | Scores each port by combined value across all oil types, minimizes total delivery events. |

### Delivery Consolidation (All Strategies)

Post-processing step applied to every strategy:

1. **Worthiness check:** If oil value at a port < 2x delivery charge, move the purchase to the nearest existing delivery port.
2. **Proximity merge:** If two delivery events are within 10 sea-days, merge the smaller into the larger if extra oil cost < 90% of saved delivery charge.

### Plan Ranking

1. Safe plans (no ROB breaches) always rank above unsafe plans
2. Among safe plans: sorted by all-in cost ascending
3. Among unsafe plans: sorted by breach count, then cost
4. Deduplicated by fingerprint. Top N returned (default 5).

---

## Browser Navigation Guide (Chrome MCP)

### Getting Started

1. Call `tabs_context_mcp` to get current browser state
2. Create a new tab with `tabs_create_mcp`
3. Navigate to `http://localhost:3000`

### Page-by-Page Navigation

#### Dashboard (`/`)

- Shows stat cards: Total Vessels, Active Vessels, Needs Attention
- Fleet Overview: clickable vessel rows linking to `/vessels/[vesselId]`
- Quick Links: "All Vessels", "Configuration"

**To navigate:** Click a vessel name in the Fleet Overview list, or click "All Vessels" quick link.

#### Vessels List (`/vessels`)

- Grid of vessel cards with name, code, type, fleet, supplier, active status
- Each card is a link to `/vessels/[vesselId]`

**To navigate:** Click any vessel card to view vessel detail.

#### Vessel Detail (`/vessels/[vesselId]`)

Sections displayed:
- **Vessel Information** card (left): Code, Type, Fleet, Supplier
- **Tank Status** card (right): Visual bars for each oil type showing current ROB vs capacity vs min ROB
- **Average Daily Consumption**: Cylinder, ME, AE in L/day
- **Action Buttons**: "Run Optimizer" and "View Consumption"
- **Upcoming Schedule**: Port call list with arrival/departure dates

**Key actions:**
- Click "Run Optimizer" button to go to `/vessels/[vesselId]/optimize`
- Click "View Consumption" button to go to `/vessels/[vesselId]/consumption`

#### Consumption History (`/vessels/[vesselId]/consumption`)

- **ROB Over Time chart**: Line chart with 3 lines (Cylinder, ME, AE ROB)
- **Consumption Log table**: Sortable columns with filters
  - **Date column**: Has a date range filter popover (click filter icon)
  - **Numeric columns**: Each has a filter popover with operator (>, >=, =, <=, <) and value
  - All columns are sortable (click sort icon to cycle asc/desc/none)
  - Pagination at bottom (25/50/75/100 rows per page)

#### Optimize Page (`/vessels/[vesselId]/optimize`)

This page has **two tabs**: "Smart" (default) and "Standard".

##### Smart Tab (Default)

1. **Delivery Charge input field**: Enter USD amount (default 500)
2. **Strategy toggles**: Click chip buttons to enable/disable strategies:
   - Grid Search, Cheapest Port, Delivery-Aware, Consolidated
   - At least one must be enabled
3. Click **"Run Smart Optimizer"** button
4. Results appear as a **Ranked Plans table** showing:
   - Rank, Strategy badge, All-in Cost, Savings, Savings %, Events, Safety badge
   - Each row is expandable to show full plan detail
   - "Save This Plan" button on each expanded plan (disabled for unsafe plans)

##### Standard Tab

1. **Sliders:**
   - Look-ahead Window: 3-10 ports
   - Safety Buffer: 0-25%
   - Target Fill: 50-90%
   - Opportunity Discount: 5-25%
   - ROB Trigger: 1.0-2.0x
2. **Delivery Charge input**: USD amount
3. Click **"Run Optimizer"** button
4. Results show:
   - **Savings Summary**: 4 stat cards (total cost, delivery charges, savings, savings %)
   - **Purchase Plan Table**: Per-port actions for each oil type
   - **ROB Projection Chart**: Line chart showing projected ROB across the voyage
   - **Price Comparison Chart**: Bar chart showing prices at each port
5. **"Save Plan"** button in top-right to save the result

#### Pricing Matrix (`/pricing`)

- Large table showing all port prices
- **Column headers have interactive controls:**
  - **Port**: Text search popover + sort
  - **Country**: Checkbox filter popover + sort
  - **Supplier**: Checkbox filter popover + sort
  - **Cylinder Oil, ME Crankcase, AE Crankcase**: Sort by price (asc/desc)
- Prices color-coded: green (cheap), amber (mid), red (expensive)
- Pagination at bottom

**Filtering steps:**
1. Click the search/filter icon next to a column header
2. Enter search text or check/uncheck filter options
3. Click "Apply"
4. Active filter count shown as badge

#### Plans (`/plans`)

- Table of saved plans with columns: Vessel, Status, Total Cost, Savings, Created, Actions
- Status badges: DRAFT (gray), SUBMITTED (blue), APPROVED (green), REJECTED (red)
- **Workflow actions:**
  - Draft plans have "Submit" button
  - Submitted plans have "Approve" and "Reject" buttons
  - Eye icon to view plan detail at `/plans/[planId]`

### Common Browser Automation Workflows

#### Workflow 1: Run Smart Optimizer for a Vessel

```
1. Navigate to http://localhost:3000/vessels
2. Click the vessel card for the target vessel
3. Click "Run Optimizer" button
4. On the optimize page, the Smart tab is already selected
5. Set delivery charge if needed (find and fill the input field)
6. Toggle strategy chips if needed
7. Click "Run Smart Optimizer" button
8. Wait for results to load
9. Read the ranked plans table
```

#### Workflow 2: Check Vessel Tank Status

```
1. Navigate to http://localhost:3000/vessels/[vesselId]
2. Read the Tank Status card on the right
3. Each bar shows: current ROB (purple fill), min ROB (red line), capacity
```

#### Workflow 3: View Consumption Trends

```
1. Navigate to http://localhost:3000/vessels/[vesselId]/consumption
2. The ROB Over Time chart shows historical oil levels
3. Use the table filters to drill into specific date ranges or threshold values
```

#### Workflow 4: Compare Prices Across Ports

```
1. Navigate to http://localhost:3000/pricing
2. Use the Supplier checkbox filter to select a specific supplier
3. Sort by Cylinder Oil price (click sort arrow) to find cheapest ports
4. Use Country filter to narrow to a region
```

#### Workflow 5: Save and Manage Plans

```
1. Run the optimizer (standard or smart)
2. Click "Save Plan" or "Save This Plan" on a ranked plan
3. Navigate to /plans to see saved plans
4. Use Submit/Approve/Reject buttons for workflow management
```

### Browser Element Identification Tips

- **Navigation pills**: Fixed at top center of page, look for pill-shaped buttons
- **Vessel cards**: Cards with ship icon, vessel name, and status badge
- **Optimizer tabs**: TabsList with "Smart" and "Standard" text
- **Strategy chips**: Colored toggle buttons labeled "Grid Search", "Cheapest Port", etc.
- **Run buttons**: Primary buttons with text "Run Optimizer" or "Run Smart Optimizer"
- **Sort icons**: Small arrow icons (up/down/updown) next to column headers in tables
- **Filter icons**: Small search or filter icons next to column headers, open popovers
- **Save buttons**: "Save Plan" or "Save This Plan" buttons, may be disabled if plan is unsafe

---

## MongoDB Collections

| Collection Name | Purpose | Access |
|-----------------|---------|--------|
| `common_vessel_details` | Vessel master data | Read-only |
| `common_consumption_log_data_demo1` | Noon report consumption logs | Read-only |
| `onesea-vessel-schedule-scraped` | Scraped vessel schedules (nested) | Read-only |
| `voyage_schedule` | Flat voyage schedule (fallback) | Read-only |
| `lube_oil_prices` | Oil prices per port per supplier | Read-only |
| `vessel_lubeSupplier` | Vessel-to-supplier mapping | Read-only |
| `purchase_plans` | Saved optimizer plans | Read/Write |
| `optimizer_config` | Saved config overrides | Read/Write |

Collection names can be overridden via environment variables (see `COLLECTION_*` vars).

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URI` | - | MongoDB connection string |
| `MONGODB_DB` | - | Database name |
| `TANK_CAPACITY_CYLINDER` | 100000 | Cylinder oil tank capacity (L) |
| `TANK_CAPACITY_ME_SYSTEM` | 95000 | ME system oil tank capacity (L) |
| `TANK_CAPACITY_AE_SYSTEM` | 20000 | AE system oil tank capacity (L) |
| `TANK_MAX_FILL_PCT` | 85 | Max fill percentage |
| `MIN_ROB_ME_SYSTEM` | 30000 | ME system oil min ROB (L) |
| `MIN_ROB_AE_SYSTEM` | 5000 | AE system oil min ROB (L) |
| `CYLINDER_MIN_ROB_DAYS` | 60 | Days of supply for cylinder min ROB |
| `MIN_ORDER_QTY_ME_SYSTEM` | 10000 | ME system oil minimum order (L) |
| `MIN_ORDER_QTY_AE_SYSTEM` | 10000 | AE system oil minimum order (L) |
| `OPTIMIZER_WINDOW_SIZE` | 5 | Default look-ahead ports |
| `OPTIMIZER_SAFETY_BUFFER_PCT` | 10 | Default consumption buffer % |
| `DELIVERY_CHARGE_DEFAULT` | 500 | Default USD per delivery event |
| `TARGET_FILL_PCT` | 70 | Default target fill % |
| `OPPORTUNITY_DISCOUNT_PCT` | 10 | Default price discount threshold % |
| `REORDER_ROB_TRIGGER_MULTIPLIER` | 1.2 | Default urgency trigger multiplier |
| `PRICE_MT_TO_L_DIVISOR` | 1111 | Price conversion: USD/MT to USD/L |
| `COLLECTION_VESSELS` | `common_vessel_details` | Vessels collection name |
| `COLLECTION_CONSUMPTION` | `common_consumption_log_data_demo1` | Consumption collection name |
| `COLLECTION_SCHEDULES` | `onesea-vessel-schedule-scraped` | Scraped schedules collection |
| `COLLECTION_VOYAGE_SCHEDULE` | `voyage_schedule` | Flat schedule collection |
| `COLLECTION_PRICES` | `lube_oil_prices` | Prices collection name |
| `COLLECTION_SUPPLIER_MAP` | `vessel_lubeSupplier` | Supplier mapping collection |
| `COLLECTION_PURCHASE_PLANS` | `purchase_plans` | Plans collection name |
| `COLLECTION_OPTIMIZER_CONFIG` | `optimizer_config` | Config collection name |

---

## Key Assumptions

1. **Consumption is constant** at historical weighted average (real consumption varies with weather/speed/load)
2. **Prices don't change** (current quotes used; may differ when vessel arrives)
3. **Schedule is fixed** (changes require re-running optimizer)
4. **One supplier per vessel** (contracted supplier only)
5. **Delivery charge is flat** per event regardless of quantity
6. **Safety buffer** (default 10%) accounts for uncertainty
7. **No partial deliveries** or lead times modeled

---

## Glossary

| Term | Definition |
|------|-----------|
| **ROB** | Remaining On Board - current oil level in the tank (liters) |
| **Min ROB** | Minimum safe oil level - vessel cannot operate below this |
| **Target Fill** | How full to fill the tank when ordering (% of capacity) |
| **Delivery Charge** | Flat USD fee per bunkering event at a port |
| **Safety Buffer** | Extra % added to consumption estimates |
| **All-In Cost** | Total oil purchase cost + total delivery charges |
| **Baseline** | Cost under reactive (non-optimized) purchasing |
| **Breach** | When projected ROB drops below min ROB |
| **Purchase Event** | A port where at least one oil type is ordered |
| **Route Average** | Average price for an oil type across all ports on the route |
| **Opportunity Buy** | Buying when price is significantly below route average |
