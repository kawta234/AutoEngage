"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configurePassport = configurePassport;
exports.initializePassport = initializePassport;
const passport_1 = __importDefault(require("passport"));
const passport_local_1 = require("passport-local");
const user_1 = require("../models/user");
const mongodb_1 = require("mongodb");
const logger_1 = __importDefault(require("./logger"));
const db_1 = require("./db");
async function configurePassport() {
    // Ensure database is connected before configuring passport
    await (0, db_1.connectToDatabase)();
    // Local Strategy
    passport_1.default.use(new passport_local_1.Strategy(async (username, password, done) => {
        try {
            const collection = (0, db_1.getUsersCollection)();
            // Find user by username or email
            const user = await collection.findOne({
                $or: [{ username }, { email: username }],
            });
            if (!user) {
                return done(null, false, { message: 'Incorrect username or password' });
            }
            // Check if user is active
            if (!user.isActive) {
                return done(null, false, { message: 'Account is disabled' });
            }
            // Make sure we have a proper hash to compare against
            const passwordHash = user.password;
            if (typeof passwordHash !== 'string') {
                logger_1.default.error('Invalid password hash format in database');
                return done(null, false, { message: 'Authentication error' });
            }
            // Make sure password is a string
            if (typeof password !== 'string') {
                logger_1.default.error('Invalid password format provided');
                return done(null, false, { message: 'Authentication error' });
            }
            // Use the static comparePassword method
            try {
                const isMatch = await user_1.User.comparePassword(password, passwordHash);
                if (!isMatch) {
                    return done(null, false, { message: 'Incorrect username or password' });
                }
                return done(null, user);
            }
            catch (bcryptError) {
                logger_1.default.error('Password comparison error:', bcryptError);
                return done(null, false, { message: 'Authentication error' });
            }
        }
        catch (error) {
            logger_1.default.error('Passport authentication error:', error);
            return done(error);
        }
    }));
    // Serialization
    passport_1.default.serializeUser((user, done) => {
        const userId = user._id?.toString();
        done(null, userId);
    });
    // Deserialization
    passport_1.default.deserializeUser(async (id, done) => {
        try {
            if (!mongodb_1.ObjectId.isValid(id)) {
                return done(null, false);
            }
            const collection = (0, db_1.getUsersCollection)();
            const user = await collection.findOne({ _id: new mongodb_1.ObjectId(id) });
            if (!user) {
                return done(null, false);
            }
            done(null, user);
        }
        catch (error) {
            logger_1.default.error('Passport deserialization error:', error);
            done(error);
        }
    });
}
// Function to initialize passport in your app
async function initializePassport(app) {
    await configurePassport();
    app.use(passport_1.default.initialize());
    app.use(passport_1.default.session());
    logger_1.default.info('Passport initialized successfully');
}
