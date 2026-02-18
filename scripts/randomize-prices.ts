/**
 * One-time script to adjust lube oil prices for demo use.
 *
 * 1. Backs up `lube_oil_prices` → `lube_oil_prices_actual`
 * 2. Multiplies every price value by 1.02 (+2%), rounded to nearest integer
 *
 * Usage: npx tsx scripts/randomize-prices.ts
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local without requiring dotenv
const envPath = resolve(__dirname, '../.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn(`Could not read ${envPath}, relying on existing env vars`);
}

const PRICE_CATEGORIES = ['MECYL LS', 'MECYL HS', 'MECC', 'AECC'] as const;
const MULTIPLIER = 1.02;
const SOURCE_COLLECTION = 'lube_oil_prices';
const BACKUP_COLLECTION = 'lube_oil_prices_actual';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set. Check .env.local');
    process.exit(1);
  }

  const dbName = process.env.MONGODB_DB || 'one-sea-etl';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    // --- Step 1: Backup ---
    const source = db.collection(SOURCE_COLLECTION);
    const originalDocs = await source.find({}).toArray();
    console.log(`Found ${originalDocs.length} documents in ${SOURCE_COLLECTION}`);

    if (originalDocs.length === 0) {
      console.error('No documents found — aborting.');
      process.exit(1);
    }

    const backup = db.collection(BACKUP_COLLECTION);
    const existingBackup = await backup.countDocuments();
    if (existingBackup > 0) {
      console.error(
        `Backup collection "${BACKUP_COLLECTION}" already has ${existingBackup} docs. ` +
        `Drop it manually first if you want to re-run: db.${BACKUP_COLLECTION}.drop()`
      );
      process.exit(1);
    }

    await backup.insertMany(originalDocs);
    const backupCount = await backup.countDocuments();
    console.log(`Backed up ${backupCount} documents to ${BACKUP_COLLECTION}`);

    if (backupCount !== originalDocs.length) {
      console.error('Backup count mismatch — aborting without modifying prices.');
      process.exit(1);
    }

    // --- Step 2: Apply +2% to all prices ---
    let updatedCount = 0;

    for (const doc of originalDocs) {
      const updates: Record<string, number> = {};

      for (const category of PRICE_CATEGORIES) {
        const priceMap = doc[category];
        if (!priceMap || typeof priceMap !== 'object') continue;

        for (const [product, price] of Object.entries(priceMap as Record<string, unknown>)) {
          const num = Number(price);
          if (!isNaN(num) && num > 0) {
            updates[`${category}.${product}`] = Math.round(num * MULTIPLIER);
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await source.updateOne({ _id: doc._id }, { $set: updates });
        updatedCount++;
      }
    }

    console.log(`Updated prices in ${updatedCount}/${originalDocs.length} documents (+${(MULTIPLIER - 1) * 100}%)`);
    console.log('Done.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
