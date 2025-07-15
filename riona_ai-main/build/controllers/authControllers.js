"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserProfile = exports.logoutUser = exports.getCurrentUser = exports.loginUser = exports.registerUser = void 0;
const db_1 = require("../config/db");
const user_1 = require("../models/user");
const mongodb_1 = require("mongodb");
const logger_1 = __importDefault(require("../config/logger"));
// Register a new user
const registerUser = async (req, res) => {
    try {
        const { username, email, password, firstName, familyName, displayName, phone, country } = req.body;
        // Validate input
        if (!username || !email || !password) {
            res.status(400).json({ message: 'Username, email, and password are required' });
            return;
        }
        const collection = await (0, db_1.getUsersCollection)();
        // Check if username or email already exists
        const existingUser = await collection.findOne({
            $or: [{ username }, { email }]
        });
        if (existingUser) {
            res.status(400).json({ message: 'Username or email already exists' });
            return;
        }
        // Hash password and create user
        const hashedPassword = await user_1.User.hashPassword(password);
        const userData = {
            username,
            email,
            password: hashedPassword,
            firstName,
            familyName,
            displayName: displayName || username,
            phone,
            country,
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
        };
        // Create a new User instance and insert into the collection
        const newUser = new user_1.User(userData);
        const result = await collection.insertOne(newUser);
        // Exclude the password when returning the new user data
        const { password: _, ...userWithoutPassword } = newUser;
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                ...userWithoutPassword,
                _id: result.insertedId
            }
        });
    }
    catch (error) {
        logger_1.default.error('Error registering user:', error);
        res.status(500).json({ message: 'Failed to register user' });
    }
};
exports.registerUser = registerUser;
// Login user (handled by Passport, this is a callback)
const loginUser = async (req, res) => {
    try {
        // Update last login time
        const collection = await (0, db_1.getUsersCollection)();
        await collection.updateOne({ _id: new mongodb_1.ObjectId(req.user._id) }, { $set: { lastLogin: new Date() } });
        res.status(200).json({
            message: 'Login successful',
            user: {
                id: req.user._id,
                username: req.user.username,
                displayName: req.user.displayName,
                firstName: req.user.firstName,
                familyName: req.user.familyName,
                email: req.user.email,
                role: req.user.role
            }
        });
    }
    catch (err) {
        logger_1.default.error('Error updating last login:', err);
        // Still return success even if updating last login fails
        res.status(200).json({
            message: 'Login successful',
            user: {
                id: req.user._id,
                username: req.user.username,
                displayName: req.user.displayName,
                firstName: req.user.firstName,
                familyName: req.user.familyName,
                email: req.user.email,
                role: req.user.role
            }
        });
    }
};
exports.loginUser = loginUser;
// Get current user
const getCurrentUser = (req, res) => {
    if (!req.isAuthenticated()) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }
    res.status(200).json({
        user: {
            id: req.user._id,
            username: req.user.username,
            displayName: req.user.displayName,
            firstName: req.user.firstName,
            familyName: req.user.familyName,
            email: req.user.email,
            role: req.user.role
        }
    });
};
exports.getCurrentUser = getCurrentUser;
const logoutUser = (req, res) => {
    req.logout((err) => {
        if (err) {
            logger_1.default.error('Error during logout:', err);
            return res.status(500).json({ message: 'Failed to logout' });
        }
        return res.redirect('/login');
    });
};
exports.logoutUser = logoutUser;
// Update user profile
const updateUserProfile = async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const userId = req.user._id;
        const { firstName, familyName, displayName, phone, country } = req.body;
        const collection = await (0, db_1.getUsersCollection)();
        await collection.updateOne({ _id: new mongodb_1.ObjectId(userId) }, {
            $set: {
                firstName,
                familyName,
                displayName: displayName || req.user.displayName,
                phone,
                country,
                updatedAt: new Date()
            }
        });
        res.status(200).json({ message: 'Profile updated successfully' });
    }
    catch (error) {
        logger_1.default.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Failed to update profile' });
    }
};
exports.updateUserProfile = updateUserProfile;
