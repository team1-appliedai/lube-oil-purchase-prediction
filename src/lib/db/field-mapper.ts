// Maps our internal field names to MongoDB field names
// This allows the setup wizard to remap fields without changing application code

export interface FieldMapping {
  [internalName: string]: string;
}

export const DEFAULT_VESSEL_FIELDS: FieldMapping = {
  vesselId: 'imo',
  vesselName: 'vesselName',
  vesselCode: 'vesselCode',
  vesselType: 'vesselType',
  fleet: 'fleet',
  lubeSupplier: 'lubeOilSupplier',
  isActive: 'isActive',
};

export const DEFAULT_CONSUMPTION_FIELDS: FieldMapping = {
  vesselId: 'imo',
  vesselName: 'vesselName',
  reportDate: 'timestamp(Utc)',
  reportType: 'event',
  state: 'state',
  cylinderOilRob: 'cylinderLubOilRob(Litres)',
  meSystemOilRob: 'circulationLubOilMeRob(Litres)',
  aeSystemOilRob: 'circulationLubOilAeRob(Litres)',
  cylinderOilConsumption: 'totalCylinderLubOilConsumption(Litres)',
  meSystemOilConsumption: 'totalCirculationLubOilConsumptionMe(Litres)',
  aeSystemOilConsumption: 'totalCirculationLubOilConsumptionAe(Litres)',
  meRunningHours: 'totalRunningHoursMe(Hours)',
  aeRunningHours: 'totalRunningHoursAe(Hours)',
  portOfOrigin: 'portOfOrigin',
  portOfDestination: 'portOfDestination',
  eta: 'eta(Utc)',
  avgSpeed: 'averageSpeedOverGround(Kn)',
};

export const DEFAULT_PRICE_FIELDS: FieldMapping = {
  country: 'Country',
  port: 'Port',
  supplier: 'supplier',
  cylinderOilLS: 'MECYL LS',
  cylinderOilHS: 'MECYL HS',
  meCrankcaseOil: 'MECC',
  aeCrankcaseOil: 'AECC',
};

export const DEFAULT_SUPPLIER_MAP_FIELDS: FieldMapping = {
  vesselName: 'Vessel',
  supplier: 'Supplier',
};

// Helper to get a value from a doc using our field mapping
export function mapField<T = unknown>(
  doc: Record<string, unknown>,
  mapping: FieldMapping,
  internalName: string
): T | undefined {
  const dbField = mapping[internalName];
  if (!dbField) return undefined;
  return doc[dbField] as T | undefined;
}

// Helper to create a MongoDB projection from field mapping
export function toProjection(mapping: FieldMapping): Record<string, 1> {
  const projection: Record<string, 1> = {};
  for (const dbField of Object.values(mapping)) {
    projection[dbField] = 1;
  }
  return projection;
}
