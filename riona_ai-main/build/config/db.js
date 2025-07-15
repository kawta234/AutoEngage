"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToDatabase = connectToDatabase;
exports.getUserCollectionByUserId = getUserCollectionByUserId;
exports.getUsersCollection = getUsersCollection;
exports.getCommentsCollection = getCommentsCollection;
exports.getAccountsCollection = getAccountsCollection;
exports.upsertAccount = upsertAccount;
// config/db.ts
const mongodb_1 = require("mongodb");
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = __importDefault(require("./logger"));
dotenv_1.default.config();
const url = process.env.MONGODB_URI;
const client = new mongodb_1.MongoClient(url);
let db;
async function connectToDatabase() {
    if (db)
        return { db };
    try {
        await client.connect();
        db = client.db(process.env.DB_NAME || 'riona');
        // ensure collections exist
        for (const name of ['users', 'comments', 'accounts']) {
            const exists = (await db.listCollections({ name }).toArray()).length > 0;
            if (!exists) {
                await db.createCollection(name);
                logger_1.default.info(`Created collection ${name}`);
            }
        }
        logger_1.default.info('Connected to MongoDB');
        return { db };
    }
    catch (error) {
        logger_1.default.error(`Failed to connect to database: ${error}`);
        throw error;
    }
}
function getUserCollectionByUserId(userId) {
    if (!db)
        throw new Error('DB not initialized');
    return db.collection(`user_${userId}`);
}
function getUsersCollection() {
    if (!db)
        throw new Error('DB not initialized');
    return db.collection('users');
}
function getCommentsCollection() {
    if (!db)
        throw new Error('DB not initialized');
    return db.collection('comments');
}
function getAccountsCollection() {
    if (!db)
        throw new Error('DB not initialized');
    return db.collection('accounts');
}
/**
 * Create or retrieve an account document for this user/platform/username combo.
 * Returns the account's Mongo _id as a string.
 */
async function upsertAccount(userId, platform, username) {
    if (!db)
        await connectToDatabase();
    const accounts = getAccountsCollection();
    // MongoDB driver changed the return format in newer versions
    const result = await accounts.findOneAndUpdate({ userId, platform, username }, { $set: { userId, platform, username, updatedAt: new Date() } }, { upsert: true, returnDocument: 'after' });
    // In newer MongoDB driver versions, the result might be directly the document
    // rather than being in a 'value' property
    const document = result.value || result;
    if (!document || !document._id) {
        throw new Error('Failed to upsert account');
    }
    return document._id.toString();
}
