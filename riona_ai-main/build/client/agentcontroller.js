"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTargetUsernameMatch = checkTargetUsernameMatch;
exports.getTargetUsernamesForAccount = getTargetUsernamesForAccount;
exports.updateLastChecked = updateLastChecked;
exports.getInstagramCookiesByUsername = getInstagramCookiesByUsername;
exports.getCookies = getCookies;
const db_1 = require("../config/db");
const logger_1 = __importDefault(require("../config/logger"));
async function checkTargetUsernameMatch(postUsername) {
    try {
        await (0, db_1.connectToDatabase)();
        const accounts = (0, db_1.getAccountsCollection)();
        logger_1.default.info(`Checking if post username "${postUsername}" matches any target usernames in our database`);
        // Find an account that has the post username in its filteredUsers.targetUsername array
        // and where the filteredUser is active
        const account = await accounts.findOne({
            "filteredUsers": {
                $elemMatch: {
                    "targetUsername": postUsername,
                    "isActive": true
                }
            }
        });
        if (account) {
            logger_1.default.info(`Found a match! Post username "${postUsername}" is in our target list`);
            return {
                matched: true,
                accountData: account
            };
        }
        else {
            logger_1.default.info(`No match found for post username "${postUsername}" in our target list`);
            return { matched: false };
        }
    }
    catch (error) {
        logger_1.default.error(`Database error when checking target username match for "${postUsername}":`, error);
        return { matched: false };
    }
}
/**
 * Get all target usernames for a specific Instagram account
 */
async function getTargetUsernamesForAccount(accountUsername) {
    try {
        await (0, db_1.connectToDatabase)();
        const accounts = (0, db_1.getAccountsCollection)();
        const account = await accounts.findOne({
            username: accountUsername,
            platform: "instagram"
        });
        if (!account) {
            logger_1.default.warn(`No account found with username ${accountUsername}`);
            return [];
        }
        // Extract all active target usernames with proper typing
        const targetUsernames = account.filteredUsers
            .filter((user) => user.isActive)
            .map((user) => user.targetUsername);
        logger_1.default.info(`Found ${targetUsernames.length} active target usernames for account ${accountUsername}`);
        return targetUsernames;
    }
    catch (error) {
        logger_1.default.error(`Error getting target usernames for account ${accountUsername}:`, error);
        return [];
    }
}
/**
 * Update the lastChecked timestamp for a target username
 */
async function updateLastChecked(accountUsername, targetUsername) {
    try {
        await (0, db_1.connectToDatabase)();
        const accounts = (0, db_1.getAccountsCollection)();
        const result = await accounts.updateOne({
            username: accountUsername,
            "filteredUsers.targetUsername": targetUsername
        }, {
            $set: {
                "filteredUsers.$.lastChecked": new Date(),
                "filteredUsers.$.updatedAt": new Date()
            }
        });
        if (result.modifiedCount > 0) {
            logger_1.default.info(`Updated lastChecked timestamp for target username ${targetUsername}`);
            return true;
        }
        else {
            logger_1.default.warn(`Failed to update lastChecked timestamp for target username ${targetUsername}`);
            return false;
        }
    }
    catch (error) {
        logger_1.default.error(`Error updating lastChecked for target username ${targetUsername}:`, error);
        return false;
    }
}
async function getInstagramCookiesByUsername(username) {
    try {
        if (!username) {
            console.error('No Instagram username provided');
            return null;
        }
        await (0, db_1.connectToDatabase)();
        const accounts = (0, db_1.getAccountsCollection)();
        const account = await accounts.findOne({
            platform: 'instagram',
            username: username
        });
        if (!account || !account.instagramCookies || account.instagramCookies.length === 0) {
            console.error(`No Instagram cookies found for username: ${username}`);
            return null;
        }
        console.log(`Found ${account.instagramCookies.length} raw cookies for ${username}`);
        // Transform MongoDB extended JSON cookies to Puppeteer CookieParam[]
        const cookies = account.instagramCookies.map((c) => {
            // Parse expires from Extended JSON
            let expires;
            if (c.expires) {
                if (c.expires.$numberInt) {
                    expires = parseInt(c.expires.$numberInt, 10);
                }
                else if (c.expires.$numberDouble) {
                    expires = Math.floor(parseFloat(c.expires.$numberDouble));
                }
            }
            // Determine SameSite
            let sameSite;
            if (c.sameSite === 'Strict' || c.sameSite === 'Lax' || c.sameSite === 'None') {
                sameSite = c.sameSite;
            }
            return {
                name: c.name,
                value: c.value,
                // You can use either url or domain + path
                url: 'https://www.instagram.com',
                // domain: c.domain,
                // path: c.path,
                expires,
                httpOnly: Boolean(c.httpOnly),
                secure: Boolean(c.secure),
                sameSite
            };
        });
        console.log(`Transformed ${cookies.length} cookies for Puppeteer`);
        return { cookies, username };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error retrieving Instagram cookies:', errorMessage);
        return null;
    }
}
async function getCookies(_req, res) {
    try {
        const username = localStorage.getItem('username');
        if (!username) {
            console.error('No Instagram username found in localStorage');
            res.status(400).json({ message: 'No Instagram username found in localStorage' });
            return;
        }
        await (0, db_1.connectToDatabase)();
        const accounts = (0, db_1.getAccountsCollection)();
        const account = await accounts.findOne({
            platform: 'instagram',
            username: username
        });
        if (!account || !account.instagramCookies || account.instagramCookies.length === 0) {
            console.error(`No Instagram cookies found for username: ${username}`);
            res.status(404).json({ message: `No Instagram cookies found for username: ${username}` });
            return;
        }
        console.log(`Found ${account.instagramCookies.length} raw cookies for ${username}`);
        const cookies = account.instagramCookies.map((c) => {
            let expires;
            if (c.expires) {
                if (c.expires.$numberInt) {
                    expires = parseInt(c.expires.$numberInt, 10);
                }
                else if (c.expires.$numberDouble) {
                    expires = Math.floor(parseFloat(c.expires.$numberDouble));
                }
            }
            let sameSite;
            if (c.sameSite === 'Strict' || c.sameSite === 'Lax' || c.sameSite === 'None') {
                sameSite = c.sameSite;
            }
            return {
                name: c.name,
                value: c.value,
                url: 'https://www.instagram.com',
                expires,
                httpOnly: Boolean(c.httpOnly),
                secure: Boolean(c.secure),
                sameSite
            };
        });
        console.log(`Transformed ${cookies.length} cookies for Puppeteer`);
        res.status(200).json({ cookies }); // Return the cookies as a JSON response
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error retrieving Instagram cookies:', errorMessage);
        res.status(500).json({ message: 'Error retrieving Instagram cookies', error: errorMessage });
    }
}
