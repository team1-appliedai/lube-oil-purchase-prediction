# Lube Oil Purchase Optimizer - How It Works

A step-by-step guide to how the optimizer decides when, where, and how much oil to buy for a vessel.

---

## What Problem Does This Solve?

A vessel sailing a route needs three types of lubricating oil:
- **Cylinder Oil** - for the main engine cylinders
- **ME System Oil** - for the main engine crankcase/system
- **AE System Oil** - for the auxiliary engine crankcase/system

Each oil type has its own tank, its own consumption rate, and its own minimum safe level. The vessel visits multiple ports, and oil prices vary by port. Every time oil is delivered to a vessel at a port, there is a flat delivery charge (e.g., $500-$10,000) regardless of how much oil is delivered.

The challenge: **Buy the right oil, at the right port, in the right quantity, to minimize total cost (oil price + delivery charges) while never running out.**

---

## Data the Optimizer Uses

### 1. Vessel Information
- Which vessel we are planning for
- Which oil supplier the vessel is contracted with (e.g., Total, Shell)

### 2. Current Oil Levels (ROB - Remaining On Board)
- How many liters of each oil type are currently in the tanks
- Taken from the most recent noon report submitted by the vessel

### 3. Consumption Rates
- How many liters per day the vessel uses of each oil type
- Calculated as a weighted average from the last 6 months of noon reports
- More recent reports have higher weight than older ones

### 4. Tank Specifications (per oil type)
| Parameter | Meaning | Typical Values |
|-----------|---------|----------------|
| Tank Capacity | Maximum the tank can hold | 20,000 - 100,000 L |
| Minimum ROB | Lowest safe level - vessel cannot operate below this | 5,000 - 30,000 L |
| Target Fill | How full we aim to fill the tank when ordering (not 100% to leave margin) | 70% of capacity |

### 5. Port Schedule
- List of upcoming ports the vessel will visit
- Arrival and departure dates at each port
- Sea days between consecutive ports (calculated from the dates)

### 6. Oil Prices at Each Port
- Price per liter for each oil type at each port
- Filtered to the vessel's contracted supplier only
- Some ports may not have prices (supplier doesn't operate there)
- The lowest available price per oil type is used

### 7. Delivery Charge
- A flat fee charged every time oil is delivered to the vessel at a port
- This fee is the same whether you deliver 100 liters or 50,000 liters
- This fee is charged once per port visit, regardless of how many oil types are delivered
- User can set this (default $500, typically $500-$10,000)

### 8. Safety Buffer
- An extra percentage added to consumption estimates to account for uncertainty
- Default: 10% (if the vessel uses 100 L/day, we plan as if it uses 110 L/day)

---

## The Baseline: How a Reactive Superintendent Operates

Before we can measure "savings", we need something to compare against. The **baseline** simulates a superintendent who only reacts when things get critical:

1. Walk through each port on the schedule
2. For each oil type, check: "After sailing to the next port, will my oil level drop below the minimum safe level?"
3. If YES and oil is available at this port: buy enough to fill the tank to 70%
4. If NO: do nothing (skip this port)
5. Every port where oil is purchased incurs the delivery charge

This is the "do nothing smart" scenario. The optimizer tries to beat this.

---

## How the Smart Optimizer Works

The optimizer doesn't just run one calculation. It runs **4 different strategies**, each approaching the problem differently, then ranks all results by total cost.

### Overview of All 4 Strategies

| Strategy | Approach | Strength |
|----------|----------|----------|
| Grid Search | Try 360+ combinations of parameters | Finds the best tuning of the standard approach |
| Cheapest Port | Plan backwards from "when do we NEED oil?" | Picks the cheapest port in each need window |
| Delivery-Aware | Start with standard plan, then optimize deliveries | Eliminates wasteful delivery events |
| Consolidated | Minimize the number of delivery events | Best when delivery charges are high |

---

### Strategy 1: Grid Search

**Idea:** The standard optimizer has adjustable settings. What if we tried hundreds of different setting combinations and kept the best one?

**Settings it varies:**
- Target fill level: 55%, 60%, 65%, 70%, 75%, 80%
- Opportunity discount threshold: 5%, 10%, 15%, 20%, 25%
- Urgency trigger: 1.0x, 1.2x, 1.4x, 1.6x of minimum ROB
- Look-ahead window: 3, 5, or 7 ports

**Process:**
1. For each combination (6 x 5 x 4 x 3 = 360 combinations):
   a. Run the standard optimizer with those settings
   b. Apply delivery consolidation (see below)
   c. Record the total cost (oil + delivery charges)
2. Keep the best results

---

### Strategy 2: Cheapest Port

**Idea:** A smart superintendent thinks: "I need to buy cylinder oil somewhere in the next 5 ports. Which one is cheapest? Let me buy there."

**Process (for each oil type independently):**

1. **Find breach points:** Simulate the voyage forward WITHOUT buying anything. Mark every point where the oil level would drop below the minimum safe level. These are "breach points."

2. **Define need windows:** For each breach point, look backward to find the window of ports where a purchase could prevent the breach. Example: if oil runs out at port 5, and the last purchase was at port 2, then ports 3-5 are the "need window."

3. **Pick the cheapest port in each window:** Within the need window, find the port with the lowest price for this oil type. Allocate the purchase there.

4. **Determine quantity:** Buy enough to fill the tank to the target level (70% of capacity), but never exceed the tank's maximum.

5. **Cross-grade consolidation:** After planning all 3 oil types independently, look for opportunities to piggyback. If port A already has a cylinder oil delivery, check if ME system oil or AE system oil could also be purchased there to avoid a separate delivery at another port.

6. **Delivery consolidation:** Merge nearby delivery events to save delivery charges (see below).

---

### Strategy 3: Delivery-Aware

**Idea:** Start with the standard optimizer's plan, then apply the superintendent's delivery economics.

**Process:**
1. Run the standard optimizer to get a base purchase plan
2. Extract all the purchase decisions from that plan
3. Apply delivery consolidation (see below) to eliminate wasteful deliveries
4. Rebuild the plan with corrected numbers

---

### Strategy 4: Consolidated

**Idea:** Minimize the total number of delivery events by scoring each port's combined value across all oil types.

**Process:**

1. **Score each port:** For every port that has prices, calculate:
   - For each oil type: (route average price - this port's price) x estimated quantity
   - Sum across all oil types
   - Subtract the delivery charge
   - A high score means this port is cheap for multiple oil types and worth visiting

2. **Select must-buy ports:** Walk forward through the schedule and find where each oil type would breach minimum ROB. Allocate purchases at the highest-scored port in each breach window.

3. **Piggyback check:** For ports already selected, check if other oil types can be added (even if not strictly needed yet) if the price is reasonable.

4. **Delivery consolidation:** Merge nearby delivery events (see below).

---

## Delivery Consolidation (Applied to All Strategies)

This is the post-processing step that implements two common-sense rules every superintendent follows:

### Rule 1: Delivery Worthiness Check

**The question:** "Is this delivery event worth the delivery charge?"

**The rule:** If the total oil value being purchased at a port is less than 2x the delivery charge, the delivery is not worth it.

**Example:**
- Port: Le Havre, Delivery charge: $5,000
- Only purchasing AE system oil worth $1,600
- Ratio: $1,600 / $5,000 = 0.32 (far below 2.0)
- Verdict: NOT WORTH IT — try to move this purchase elsewhere

**What happens:** The system looks for the nearest port that already has a delivery happening, and moves the purchase there (if that port has a price for this oil type and the tank has room).

### Rule 2: Proximity Merge

**The question:** "Are there two delivery events at nearby ports that could be combined?"

**The rule:** If two delivery events are within 10 sea-days of each other, check if merging the smaller into the larger saves money.

**Example:**
- Hamburg (Jun 8): Cylinder oil delivery ($7,000 oil + $5,000 delivery)
- Le Havre (Jun 12): AE system oil delivery ($1,600 oil + $5,000 delivery)
- Distance: 4 sea-days (within 10-day threshold)
- Can AE oil be purchased at Hamburg? YES
- Extra cost of buying AE oil at Hamburg vs Le Havre: small price difference
- Saved: $5,000 delivery charge
- Verdict: MERGE — buy both oils at Hamburg

**The merge calculation:**
- Extra oil cost = (price at new port - price at original port) x quantity
- Saved delivery charge = delivery charge at the port being eliminated
- If extra oil cost < 90% of saved delivery charge: DO THE MERGE

### Safety Checks

Before any merge is applied, the system verifies:
1. **Tank capacity:** The tank at the destination port has room for the additional oil
2. **ROB safety:** Oil levels never drop below the minimum safe level at any point after the change
3. **Price availability:** The destination port actually has a price for the oil type being moved

If any check fails, the merge is rejected and the original plan is kept.

---

## How Plans Are Ranked

After all 4 strategies run, the results are collected and ranked:

1. **Safety first:** Plans where oil levels stay above minimum at ALL ports are ranked above plans with any breaches
2. **Among safe plans:** Sorted by total all-in cost (oil cost + delivery charges), lowest first
3. **Among unsafe plans:** Sorted by number of breaches (fewer is better), then by cost

The top 5 plans are presented to the user.

---

## What Each Action Means

| Action | Meaning |
|--------|---------|
| ORDER | Buy oil at this port — good price or strategic opportunity |
| URGENT | Buy oil at this port — oil level critically low, must buy now |
| SKIP | Don't buy — oil level is adequate, will buy elsewhere |
| ALERT | Warning — oil level will drop below safe minimum and no oil is available at this port |

---

## Key Assumptions

1. **Consumption is constant:** The optimizer assumes daily consumption remains steady at the historical weighted average. Real consumption varies with weather, speed, and engine load.

2. **Prices don't change:** The prices used are current quotes. By the time the vessel arrives, prices may have changed.

3. **Schedule is fixed:** The port rotation and dates are assumed to be accurate. Schedule changes (port additions, delays) would require re-running the optimizer.

4. **One supplier:** The vessel buys from one contracted supplier. The optimizer only considers prices from that supplier.

5. **Delivery charge is flat:** The same delivery charge applies regardless of quantity or number of oil types delivered. In reality, some ports may have variable charges.

6. **Safety buffer accounts for uncertainty:** The 10% buffer on consumption is meant to cover the uncertainty in assumptions 1-3.

7. **No partial deliveries:** When oil is ordered, it arrives at the port. There is no modeling of delivery lead times or supply shortages.

---

## Savings Calculation

For each plan:

```
Total All-In Cost = Oil Purchase Cost + Total Delivery Charges

Savings = Baseline All-In Cost - Plan All-In Cost

Savings % = (Savings / Baseline All-In Cost) x 100
```

Where:
- **Oil Purchase Cost** = sum of (quantity x price) for all oils at all ports
- **Total Delivery Charges** = delivery charge x number of ports where oil was ordered
- **Baseline** = what the reactive superintendent would have spent (see above)

---

## Worked Example

**Vessel:** ONE HARBOUR, Delivery charge: $5,000

**Before optimization:**
- Rotterdam Jun 4: SKIP (no need)
- Hamburg Jun 8: Buy cylinder oil ($7,000) — delivery charge $5,000
- Le Havre Jun 12: Buy AE oil ($1,600) — delivery charge $5,000
- Singapore Jul 15: Buy as needed — delivery charge $5,000
- Total delivery charges: $15,000 (3 events)

**After optimization (with delivery consolidation):**
- Rotterdam Jun 4: SKIP
- Hamburg Jun 8: Buy cylinder oil AND AE oil ($8,600) — delivery charge $5,000
- Le Havre Jun 12: SKIP (AE oil moved to Hamburg)
- Singapore Jul 15: Buy as needed — delivery charge $5,000
- Total delivery charges: $10,000 (2 events)
- **Saved: $5,000** by consolidating nearby deliveries
