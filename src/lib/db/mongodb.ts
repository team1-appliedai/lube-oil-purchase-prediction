import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set');
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'one-sea-etl';

let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Cache the connection in both development AND production.
// In Next.js, module-level variables are reset on hot reload in dev
// but persist across requests in production — however the global
// cache pattern is safer for both environments.
if (!global._mongoClientPromise) {
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 60_000,
    connectTimeoutMS: 10_000,
  });
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

export async function getClient(): Promise<MongoClient> {
  return clientPromise;
}

export default clientPromise;
