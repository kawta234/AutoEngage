// config/db.ts

import { MongoClient, Db, Collection } from 'mongodb';
import dotenv from 'dotenv';
import logger from './logger';
import { IUser } from '../models/user';

// Charger les variables d'environnement
dotenv.config();

const url = process.env.MONGODB_URI;
if (!url) {
  throw new Error("Erreur: MONGODB_URI n'est pas défini dans le fichier .env");
}

// Création d'une instance MongoClient unique
const client = new MongoClient(url);

// Variables de stockage de la connexion et des collections
let db: Db | null = null;
let usersCollection: Collection<IUser> | null = null;
let commentsCollection: Collection | null = null;

/**
 * Connecte à la base MongoDB, initialise les collections et crée les index.
 * Vous pouvez spécifier le nom de la base de données via la variable DB_NAME dans le .env.
 */
export async function connectToDatabase(): Promise<{ db: Db; usersCollection: Collection<IUser>; commentsCollection: Collection }> {
  if (db && usersCollection && commentsCollection) {
    logger.info("La base de données est déjà connectée.");
    return { db, usersCollection, commentsCollection };
  }

  try {
    await client.connect();
    // Utilisez le nom de base défini dans DB_NAME ou "instagram-manager" par défaut
    db = client.db(process.env.DB_NAME || "instagram-manager");
    usersCollection = db.collection<IUser>("users");
    db = client.db(process.env.DB_NAME || "riona");
    commentsCollection = db.collection("comments");
    
    // Création d'index pour la collection des utilisateurs
    await usersCollection.createIndex({ username: 1 }, { unique: true });
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    
    logger.info("Connecté à MongoDB.");
    return { db, usersCollection, commentsCollection };
  } catch (error) {
    logger.error("Erreur de connexion à MongoDB:", error);
    throw error;
  }
}

/**
 * Retourne la base de données (Db) après connexion.
 */
export function getDb(): Db {
  if (!db) throw new Error("La base de données n'est pas connectée. Appelez connectToDatabase() d'abord.");
  return db;
}

/**
 * Retourne la collection 'users' typée en IUser.
 */
export function getUsersCollection(): Collection<IUser> {
  if (!usersCollection) {
    throw new Error("La collection 'users' n'est pas disponible. Appelez connectToDatabase() d'abord.");
  }
  return usersCollection;
}

/**
 * Retourne la collection 'comments'.
 */
export function getCommentsCollection(): Collection {
  if (!commentsCollection) {
    throw new Error("La collection 'comments' n'est pas disponible. Appelez connectToDatabase() d'abord.");
  }
  return commentsCollection;
}

/**
 * Ferme la connexion à la base MongoDB.
 */
export function closeConnection(): void {
  if (client) {
    client.close();
    logger.info("Connexion à MongoDB fermée.");
  }
}
