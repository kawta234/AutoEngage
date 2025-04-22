// config/db.ts
import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();
const url = process.env.MONGODB_URI!;
const client = new MongoClient(url);
let db: Db;

export async function connectToDatabase(): Promise<{ db: Db }> {
  if (db) return { db };

  try {
    await client.connect();
    db = client.db(process.env.DB_NAME || 'riona');

    // ensure collections exist
    for (const name of ['users', 'comments', 'accounts']) {
      const exists = (await db.listCollections({ name }).toArray()).length > 0;
      if (!exists) {
        await db.createCollection(name);
        logger.info(`Created collection ${name}`);
      }
    }

    logger.info('Connected to MongoDB');
    return { db };
  } catch (error) {
    logger.error(`Failed to connect to database: ${error}`);
    throw error;
  }
}
export function getUserCollectionByUserId(userId: string): Collection<any> {
  if (!db) throw new Error('DB not initialized');
  return db.collection(`user_${userId}`);
}

export function getUsersCollection(): Collection<any> {
  if (!db) throw new Error('DB not initialized');
  return db.collection('users');
}

export function getCommentsCollection(): Collection<any> {
  if (!db) throw new Error('DB not initialized');
  return db.collection('comments');
}

export function getAccountsCollection(): Collection<any> {
  if (!db) throw new Error('DB not initialized');
  return db.collection('accounts');
}

/**
 * Create or retrieve an account document for this user/platform/username combo.
 * Returns the account's Mongo _id as a string.
 */
export async function upsertAccount(
  userId: string,
  platform: string,
  username: string
): Promise<string> {
  if (!db) await connectToDatabase();
  const accounts = getAccountsCollection();
  
  // MongoDB driver changed the return format in newer versions
  const result = await accounts.findOneAndUpdate(
    { userId, platform, username },
    { $set: { userId, platform, username, updatedAt: new Date() } },
    { upsert: true, returnDocument: 'after' }
  );
  
  // In newer MongoDB driver versions, the result might be directly the document
  // rather than being in a 'value' property
  const document = result.value || result;
  
  if (!document || !document._id) {
    throw new Error('Failed to upsert account');
  }
  
  return document._id.toString();
}