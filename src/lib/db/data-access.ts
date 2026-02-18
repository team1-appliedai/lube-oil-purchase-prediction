import { getDb } from './mongodb';
import { COLLECTIONS } from './collections';
import {
  DEFAULT_VESSEL_FIELDS,
  DEFAULT_CONSUMPTION_FIELDS,
  DEFAULT_PRICE_FIELDS,
  DEFAULT_SUPPLIER_MAP_FIELDS,
  mapField,
} from './field-mapper';
import type {
  Vessel,
  ConsumptionRecord,
  PortPrice,
  SchedulePort,
  VesselSupplierMapping,
  PurchasePlan,
} from '@/lib/optimizer/types';

// ============================================================
// READ-ONLY: Existing collections
// ============================================================

// Helper: IMO is stored as number in MongoDB but our app uses string IDs.
// Try both number and string when querying by IMO.
function imoQuery(field: string, vesselId: string): Record<string, unknown> {
  const numId = Number(vesselId);
  if (!isNaN(numId)) {
    return { $or: [{ [field]: numId }, { [field]: vesselId }] };
  }
  return { [field]: vesselId };
}

export async function getVessels(): Promise<Vessel[]> {
  const db = await getDb();
  const docs = await db.collection(COLLECTIONS.vessels).find({}).toArray();

  return docs.map((doc) => ({
    vesselId: String(mapField(doc, DEFAULT_VESSEL_FIELDS, 'vesselId') ?? ''),
    vesselName: String(mapField(doc, DEFAULT_VESSEL_FIELDS, 'vesselName') ?? ''),
    vesselCode: String(mapField(doc, DEFAULT_VESSEL_FIELDS, 'vesselCode') ?? ''),
    vesselType: String(mapField(doc, DEFAULT_VESSEL_FIELDS, 'vesselType') ?? ''),
    fleet: String(mapField(doc, DEFAULT_VESSEL_FIELDS, 'fleet') ?? ''),
    lubeSupplier: String(mapField(doc, DEFAULT_VESSEL_FIELDS, 'lubeSupplier') ?? ''),
    isActive: Boolean(mapField(doc, DEFAULT_VESSEL_FIELDS, 'isActive') ?? true),
  }));
}

export async function getVesselById(vesselId: string): Promise<Vessel | null> {
  const db = await getDb();
  const f = DEFAULT_VESSEL_FIELDS;
  const doc = await db.collection(COLLECTIONS.vessels).findOne(imoQuery(f.vesselId, vesselId));
  if (!doc) return null;

  return {
    vesselId: String(mapField(doc, f, 'vesselId') ?? ''),
    vesselName: String(mapField(doc, f, 'vesselName') ?? ''),
    vesselCode: String(mapField(doc, f, 'vesselCode') ?? ''),
    vesselType: String(mapField(doc, f, 'vesselType') ?? ''),
    fleet: String(mapField(doc, f, 'fleet') ?? ''),
    lubeSupplier: String(mapField(doc, f, 'lubeSupplier') ?? ''),
    isActive: Boolean(mapField(doc, f, 'isActive') ?? true),
  };
}

export async function getConsumptionLogs(
  vesselId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ConsumptionRecord[]> {
  const db = await getDb();
  const f = DEFAULT_CONSUMPTION_FIELDS;

  const query: Record<string, unknown> = imoQuery(f.vesselId, vesselId);
  if (startDate || endDate) {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.$gte = startDate.toISOString();
    if (endDate) dateFilter.$lte = endDate.toISOString();
    query[f.reportDate] = dateFilter;
  }

  const docs = await db
    .collection(COLLECTIONS.consumption)
    .find(query)
    .sort({ [f.reportDate]: 1 })
    .toArray();

  return docs.map((doc) => ({
    vesselId: String(mapField(doc, f, 'vesselId') ?? ''),
    vesselName: String(mapField(doc, f, 'vesselName') ?? ''),
    reportDate: String(mapField(doc, f, 'reportDate') ?? ''),
    reportType: String(mapField(doc, f, 'reportType') ?? ''),
    state: String(mapField(doc, f, 'state') ?? ''),
    cylinderOilRob: Number(mapField(doc, f, 'cylinderOilRob') ?? 0),
    meSystemOilRob: Number(mapField(doc, f, 'meSystemOilRob') ?? 0),
    aeSystemOilRob: Number(mapField(doc, f, 'aeSystemOilRob') ?? 0),
    cylinderOilConsumption: Number(mapField(doc, f, 'cylinderOilConsumption') ?? 0),
    meSystemOilConsumption: Number(mapField(doc, f, 'meSystemOilConsumption') ?? 0),
    aeSystemOilConsumption: Number(mapField(doc, f, 'aeSystemOilConsumption') ?? 0),
    meRunningHours: Number(mapField(doc, f, 'meRunningHours') ?? 0),
    aeRunningHours: Number(mapField(doc, f, 'aeRunningHours') ?? 0),
    portOfOrigin: String(mapField(doc, f, 'portOfOrigin') ?? ''),
    portOfDestination: String(mapField(doc, f, 'portOfDestination') ?? ''),
    eta: String(mapField(doc, f, 'eta') ?? ''),
    avgSpeed: Number(mapField(doc, f, 'avgSpeed') ?? 0),
  }));
}

export async function getVesselSchedule(vesselCode: string, vesselName?: string): Promise<SchedulePort[]> {
  const db = await getDb();

  // Strategy 1: Try scraped nested collection (direct website scraping, more accurate dates)
  const scrapedQuery = vesselName
    ? { $or: [{ vessel_code: vesselCode }, { vessel_name: { $regex: new RegExp(`^${vesselName}$`, 'i') } }] }
    : { vessel_code: vesselCode };
  const doc = await db.collection(COLLECTIONS.schedules).findOne(scrapedQuery);

  if (doc) {
    // Flatten nested voyages → sequential port list, deduplicated
    const ports: SchedulePort[] = [];
    const seen = new Set<string>();
    const voyages = (doc.voyages as Array<Record<string, unknown>>) || [];

    for (const voyage of voyages) {
      const portCalls = (voyage.port_calls as Array<Record<string, unknown>>) || [];
      for (const pc of portCalls) {
        const arrival = pc.arrival as Record<string, unknown> | undefined;
        const departure = pc.departure as Record<string, unknown> | undefined;
        const arrivalDate = arrival?.datetime ? String(arrival.datetime) : undefined;
        const portName = String(pc.port_name ?? '');

        // Deduplicate: overlapping voyages share port calls (same port + arrival date)
        const dedupKey = `${portName}|${arrivalDate ?? ''}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        ports.push({
          portName,
          portCode: String(pc.port_code ?? ''),
          country: String(pc.country ?? ''),
          arrivalDate,
          departureDate: departure?.datetime ? String(departure.datetime) : undefined,
          isCurrentPort: Boolean(pc.is_current_port ?? false),
          voyageNo: String(voyage.voyage_no ?? doc.current_voyage_no ?? ''),
        });
      }
    }

    if (ports.length > 0) return ports;
  }

  // Strategy 2: Fall back to flat voyage_schedule collection
  const flatQuery: Record<string, unknown> = vesselName
    ? { $or: [{ vesselCode }, { vesselName: { $regex: new RegExp(`^${vesselName}$`, 'i') } }] }
    : { vesselCode };
  const flatDocs = await db
    .collection(COLLECTIONS.voyageSchedule)
    .find(flatQuery)
    .sort({ arrivalDateTime: 1 })
    .toArray();

  return flatDocs.map((doc) => ({
    portName: String(doc.portName ?? ''),
    portCode: String(doc.portCode ?? ''),
    country: String(doc.portCountryName ?? ''),
    arrivalDate: doc.arrivalDateTime ? new Date(doc.arrivalDateTime as string | number).toISOString() : undefined,
    departureDate: doc.departureDateTime ? new Date(doc.departureDateTime as string | number).toISOString() : undefined,
    isCurrentPort: doc.currentFlag === 'Y' || doc.currentFlag === true,
    voyageNo: String(doc.scheduleVoyageNumber ?? ''),
  }));
}

export async function getPrices(supplier?: string): Promise<PortPrice[]> {
  const db = await getDb();
  const f = DEFAULT_PRICE_FIELDS;

  const query: Record<string, unknown> = {};
  if (supplier) query[f.supplier] = supplier;

  const docs = await db.collection(COLLECTIONS.prices).find(query).toArray();
  const divisor = Number(process.env.PRICE_MT_TO_L_DIVISOR) || 1111;

  return docs.map((doc) => {
    // Each price category is a map of product_name → price_usd_per_mt
    const convertPriceMap = (raw: unknown): Record<string, number> => {
      if (!raw || typeof raw !== 'object') return {};
      const result: Record<string, number> = {};
      for (const [product, pricePerMt] of Object.entries(raw as Record<string, unknown>)) {
        const numPrice = Number(pricePerMt);
        if (!isNaN(numPrice) && numPrice > 0) {
          result[product] = numPrice / divisor; // USD/MT → USD/L
        }
      }
      return result;
    };

    return {
      country: String(mapField(doc, f, 'country') ?? ''),
      port: String(mapField(doc, f, 'port') ?? ''),
      supplier: String(mapField(doc, f, 'supplier') ?? ''),
      cylinderOilLS: convertPriceMap(doc[f.cylinderOilLS]),
      cylinderOilHS: convertPriceMap(doc[f.cylinderOilHS]),
      meCrankcaseOil: convertPriceMap(doc[f.meCrankcaseOil]),
      aeCrankcaseOil: convertPriceMap(doc[f.aeCrankcaseOil]),
      // Delivery config fields (may be undefined if not seeded yet)
      ...(doc.differentialPer100L != null && {
        differentialPer100L: Number(doc.differentialPer100L),
        leadTimeDays: Number(doc.leadTimeDays ?? 5),
        smallOrderThresholdL: Number(doc.smallOrderThresholdL ?? 4000),
        smallOrderSurcharge: Number(doc.smallOrderSurcharge ?? 200),
        urgentOrderSurcharge: Number(doc.urgentOrderSurcharge ?? 200),
      }),
    };
  });
}

export async function getVesselSupplierMap(): Promise<VesselSupplierMapping[]> {
  const db = await getDb();
  const f = DEFAULT_SUPPLIER_MAP_FIELDS;
  const docs = await db.collection(COLLECTIONS.supplierMap).find({}).toArray();

  return docs.map((doc) => ({
    vesselName: String(mapField(doc, f, 'vesselName') ?? ''),
    supplier: String(mapField(doc, f, 'supplier') ?? ''),
  }));
}

export async function getSupplierForVessel(vesselName: string): Promise<string | null> {
  const db = await getDb();
  const f = DEFAULT_SUPPLIER_MAP_FIELDS;

  // Case-insensitive match since vessel names vary between collections
  const doc = await db
    .collection(COLLECTIONS.supplierMap)
    .findOne({ [f.vesselName]: { $regex: new RegExp(`^${vesselName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });

  if (!doc) return null;
  return String(mapField(doc, f, 'supplier') ?? '');
}

// ============================================================
// READ/WRITE: App-owned collections
// ============================================================

export async function savePurchasePlan(plan: PurchasePlan): Promise<string> {
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...planWithoutId } = plan;
  const result = await db.collection(COLLECTIONS.purchasePlans).insertOne({
    ...planWithoutId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return result.insertedId.toString();
}

export async function getPurchasePlans(vesselId?: string): Promise<PurchasePlan[]> {
  const db = await getDb();
  const query: Record<string, unknown> = {};
  if (vesselId) query.vesselId = vesselId;

  const docs = await db
    .collection(COLLECTIONS.purchasePlans)
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  return docs.map((doc) => ({
    ...doc,
    _id: doc._id.toString(),
  })) as unknown as PurchasePlan[];
}

export async function updatePlanStatus(
  planId: string,
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
): Promise<void> {
  const db = await getDb();
  const { ObjectId } = await import('mongodb');
  await db.collection(COLLECTIONS.purchasePlans).updateOne(
    { _id: new ObjectId(planId) },
    { $set: { status, updatedAt: new Date() } }
  );
}

export async function saveOptimizerConfig(config: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTIONS.optimizerConfig).updateOne(
    { _id: 'default' as unknown as import('mongodb').ObjectId },
    { $set: { ...config, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function getOptimizerConfig(): Promise<Record<string, unknown> | null> {
  const db = await getDb();
  const doc = await db
    .collection(COLLECTIONS.optimizerConfig)
    .findOne({ _id: 'default' as unknown as import('mongodb').ObjectId });
  return doc as Record<string, unknown> | null;
}

// ============================================================
// Utility: Test connection + list collections
// ============================================================

export async function testConnection(): Promise<{ ok: boolean; collections: string[] }> {
  try {
    const db = await getDb();
    const collections = await db.listCollections().toArray();
    return { ok: true, collections: collections.map((c) => c.name) };
  } catch (error) {
    console.error('MongoDB connection test failed:', error);
    return { ok: false, collections: [] };
  }
}

export async function getCollectionFields(
  collectionName: string,
  sampleSize = 5
): Promise<string[]> {
  const db = await getDb();
  const docs = await db.collection(collectionName).find({}).limit(sampleSize).toArray();

  const fieldSet = new Set<string>();
  for (const doc of docs) {
    for (const key of Object.keys(doc)) {
      fieldSet.add(key);
    }
  }
  return Array.from(fieldSet).sort();
}
