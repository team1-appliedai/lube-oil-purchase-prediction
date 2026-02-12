// Collection name constants from env
export const COLLECTIONS = {
  // Existing collections (READ ONLY)
  vessels: process.env.COLLECTION_VESSELS || 'common_vessel_details',
  consumption: process.env.COLLECTION_CONSUMPTION || 'common_consumption_log_data_demo1',
  schedules: process.env.COLLECTION_SCHEDULES || 'onesea-vessel-schedule-scraped',
  voyageSchedule: process.env.COLLECTION_VOYAGE_SCHEDULE || 'voyage_schedule',
  prices: process.env.COLLECTION_PRICES || 'lube_oil_prices',
  supplierMap: process.env.COLLECTION_SUPPLIER_MAP || 'vessel_lubeSupplier',
  // App-owned collections (READ/WRITE)
  purchasePlans: process.env.COLLECTION_PURCHASE_PLANS || 'purchase_plans',
  optimizerConfig: process.env.COLLECTION_OPTIMIZER_CONFIG || 'optimizer_config',
} as const;
