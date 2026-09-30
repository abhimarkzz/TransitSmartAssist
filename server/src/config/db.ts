import { MongoClient, Db, ClientSession, TransactionOptions } from 'mongodb';
import { config } from './env';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (client && db) {
    return { client, db };
  }

  try {
    console.log(`[MongoDB] Connecting to MongoDB instance...`);
    client = new MongoClient(config.mongodbUri, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });

    await client.connect();
    db = client.db(config.mongodbDbName);

    console.log(`[MongoDB] Connected successfully to database: "${config.mongodbDbName}"`);
    return { client, db };
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    throw error;
  }
}

export function getDb(): Db {
  if (!db) {
    throw new Error('Database not initialized. Call connectToDatabase() first.');
  }
  return db;
}

export function getClient(): MongoClient {
  if (!client) {
    throw new Error('MongoClient not initialized. Call connectToDatabase() first.');
  }
  return client;
}

export async function closeDatabaseConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[MongoDB] Connection closed gracefully.');
  }
}

/**
 * Execute work inside a MongoDB multi-document ACID transaction
 */
export async function withTransaction<T>(
  work: (session: ClientSession, db: Db) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  const mongoClient = getClient();
  const session = mongoClient.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      const database = getDb();
      result = await work(session, database);
    }, options);
    return result!;
  } finally {
    await session.endSession();
  }
}
