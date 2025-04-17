// config/db.ts

import { MongoClient, Db, Collection } from 'mongodb';
import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

const url = process.env.MONGODB_URI;
if (!url) {
  throw new Error("Erreur: MONGODB_URI n'est pas défini dans le fichier .env");
}

const client = new MongoClient(url);
let db: Db | null = null;

export async function connectToDatabase(): Promise<{ db: Db }> {
  if (db) {
    logger.info("La base de données est déjà connectée.");
    return { db };
  }

  try {
    await client.connect();
    db = client.db(process.env.DB_NAME || "riona");

    await db.createCollection('users');
    await db.createCollection('comments');

    logger.info("Connecté à MongoDB.");
    return { db };
  } catch (error) {
    logger.error("Erreur de connexion à MongoDB:", error);
    throw error;
  }
}

/**
 * Crée une collection spécifique à un utilisateur dans la base de données.
 * Le nom de la collection sera basé sur l'ID de l'utilisateur (userId).
 */
export async function getUserCollection(userId: string): Promise<Collection> {
  if (!db) throw new Error("La base de données n'est pas connectée. Appelez connectToDatabase() d'abord.");

  const userCollectionName = `user_${userId}`; // Collection spécifique à l'utilisateur
  let userCollection = await db.collection(userCollectionName);

  // Vérification si la collection existe déjà, sinon on la crée
  const collections = await db.listCollections().toArray();
  const collectionExists = collections.some(col => col.name === userCollectionName);

  if (!collectionExists) {
    userCollection = await db.createCollection(userCollectionName);
    logger.info(`Collection pour l'utilisateur ${userId} créée.`);
  }

  return userCollection;
}

export function getCommentsCollection(): Collection {
  if (!db) {
    throw new Error("La collection 'comments' n'est pas disponible. Appelez connectToDatabase() d'abord.");
  }
  return db.collection("comments");
}
