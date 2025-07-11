import { ObjectId } from 'mongodb';

// Define the AccountDocument interface for LinkedIn
export interface LinkedInAccountDocument {
    _id: ObjectId;
    userId: string;
    platform: string;
    username: string;
    updatedAt: Date;
    filteredUsers: {
      targetUsername: string;
      isActive: boolean;
      lastChecked?: Date;
      updatedAt?: Date;
    }[];
  }

import {
    connectToDatabase,
    getAccountsCollection,
} from '../../config/db';
import logger from '../../config/logger';

/**
 * Check if a LinkedIn post username matches any target usernames in our database
 */
/**
 * Check if a LinkedIn post username matches any target usernames in our database
 * Fixed to handle case-insensitive matching
 */
export async function checkTargetUsernameMatch(
    postAuthor: string
): Promise<{ matched: boolean; accountData?: LinkedInAccountDocument }> {
    try {
        await connectToDatabase();
        const accounts = getAccountsCollection();
        
        logger.info(`Checking if post username "${postAuthor}" matches any target usernames in our database`);
        
        // Use case-insensitive regex matching to find the account
        const account = await accounts.findOne({
            "filteredUsers": {
                $elemMatch: {
                    "targetUsername": { 
                        $regex: new RegExp(`^${postAuthor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') 
                    },
                    "isActive": true
                }
            }
        });
        
        if (account) {
            logger.info(`Found a match! Post username "${postAuthor}" is in our target list`);
            return { 
                matched: true,
                accountData: account
            };
        } else {
            logger.info(`No match found for post username "${postAuthor}" in our target list`);
            return { matched: false };
        }
    } catch (error) {
        logger.error(`Database error when checking target username match for "${postAuthor}":`, error);
        return { matched: false };
    }
}
  
  
  /**
   * Get all target usernames for a specific Instagram account
   */
  export async function getTargetUsernamesForAccount(accountUsername: string): Promise<string[]> {
    try {
      await connectToDatabase();
      const accounts = getAccountsCollection();
      
      const account = await accounts.findOne({ 
        username: accountUsername,
        platform: "linkedin"
      });
      
      if (!account) {
        logger.warn(`No account found with username ${accountUsername}`);
        return [];
      }
      
      // Extract all active target usernames with proper typing
      const targetUsernames = account.filteredUsers
        .filter((user: { isActive: boolean }) => user.isActive)
        .map((user: { targetUsername: string }) => user.targetUsername);
      
      logger.info(`Found ${targetUsernames.length} active target usernames for account ${accountUsername}`);
      return targetUsernames;
    } catch (error) {
      logger.error(`Error getting target usernames for account ${accountUsername}:`, error);
      return [];
    }
  }

/**
 * Update the lastChecked timestamp for a target username on LinkedIn
 */
export async function updateLastCheckedLinkedIn(accountUsername: string, targetUsername: string): Promise<boolean> {
    try {
        await connectToDatabase();
        const accounts = getAccountsCollection();
        
        const result = await accounts.updateOne(
            { 
                username: accountUsername,
                platform: "linkedin",
                "filteredUsers.targetUsername": targetUsername
            },
            { 
                $set: { 
                    "filteredUsers.$.lastChecked": new Date(),
                    "filteredUsers.$.updatedAt": new Date()
                }
            }
        );
        
        if (result.modifiedCount > 0) {
            logger.info(`Updated lastChecked timestamp for LinkedIn target username ${targetUsername}`);
            return true;
        } else {
            logger.warn(`Failed to update lastChecked timestamp for LinkedIn target username ${targetUsername}`);
            return false;
        }
    } catch (error) {
        logger.error(`Error updating lastChecked for LinkedIn target username ${targetUsername}:`, error);
        return false;
    }
}

import { CookieParam } from 'puppeteer';

/**
 * Get LinkedIn cookies by username for automation
 */
export async function getLinkedInCookiesByUsername(username: string): Promise<{ cookies: CookieParam[]; username: string } | null> {
    try {
        if (!username) {
            console.error('No LinkedIn username provided');
            return null;
        }

        await connectToDatabase();
        const accounts = getAccountsCollection();

        const account = await accounts.findOne({
            platform: 'linkedin',
            username: username
        });

        if (!account || !account.linkedinCookies || account.linkedinCookies.length === 0) {
            console.error(`No LinkedIn cookies found for username: ${username}`);
            return null;
        }

        console.log(`Found ${account.linkedinCookies.length} raw LinkedIn cookies for ${username}`);

        // Check if cookies are fresh (not expired)
        const currentTime = Math.floor(Date.now() / 1000);
        const freshCookies = account.linkedinCookies.filter((c: any) => {
            if (!c.expires) return true; // Session cookies are always valid
            
            let expires: number;
            if (c.expires.$numberInt) {
                expires = parseInt(c.expires.$numberInt, 10);
            } else if (c.expires.$numberDouble) {
                expires = Math.floor(parseFloat(c.expires.$numberDouble));
            } else if (typeof c.expires === 'number') {
                expires = c.expires;
            } else {
                return true; // Unknown format, assume valid
            }
            
            return expires > currentTime;
        });

        if (freshCookies.length === 0) {
            console.error(`All LinkedIn cookies for ${username} have expired`);
            return null;
        }

        // Check for essential LinkedIn cookies
        const essentialCookies = ['li_at', 'JSESSIONID'];
        const cookieNames = freshCookies.map((c: any) => c.name);
        const hasEssentialCookies = essentialCookies.every(essential => 
            cookieNames.includes(essential)
        );

        if (!hasEssentialCookies) {
            console.error(`Missing essential LinkedIn cookies for ${username}. Found: ${cookieNames.join(', ')}`);
            return null;
        }

        // Transform MongoDB extended JSON cookies to Puppeteer CookieParam[]
        const cookies: CookieParam[] = freshCookies.map((c: any) => {
            // Parse expires from Extended JSON
            let expires: number | undefined;
            if (c.expires) {
                if (c.expires.$numberInt) {
                    expires = parseInt(c.expires.$numberInt, 10);
                } else if (c.expires.$numberDouble) {
                    expires = Math.floor(parseFloat(c.expires.$numberDouble));
                } else if (typeof c.expires === 'number') {
                    expires = c.expires;
                }
            }

            // Determine SameSite
            let sameSite: 'Strict' | 'Lax' | 'None' | undefined;
            if (c.sameSite === 'Strict' || c.sameSite === 'Lax' || c.sameSite === 'None') {
                sameSite = c.sameSite;
            }

            // Keep the original domain and path - this is crucial for LinkedIn
            const cookieParam: CookieParam = {
                name: c.name,
                value: c.value,
                domain: c.domain, // Keep original domain
                path: c.path || '/', // Keep original path
                expires,
                httpOnly: Boolean(c.httpOnly),
                secure: Boolean(c.secure),
                sameSite
            };

            return cookieParam;
        });

        console.log(`Transformed ${cookies.length} fresh LinkedIn cookies for Puppeteer`);
        
        // Log cookie details for debugging
        console.log('Cookie details:');
        cookies.forEach(cookie => {
            console.log(`- ${cookie.name}: domain=${cookie.domain}, expires=${cookie.expires ? new Date(cookie.expires * 1000).toISOString() : 'session'}`);
        });

        return { cookies, username };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error retrieving LinkedIn cookies:', errorMessage);
        return null;
    }
}

// Client-side version (runs in browser) - Express route handler
import { Request, Response } from 'express';

/**
 * Express route handler to get LinkedIn cookies
 */
export async function getLinkedInCookies(req: Request, res: Response): Promise<void> {
    try {
        // Get username from request headers instead of localStorage
        const username = req.headers['x-linkedin-username'] as string;
        
        if (!username) {
            console.error('No LinkedIn username found in request headers');
            res.status(400).json({ 
                success: false,
                message: 'No LinkedIn username found in request headers',
                cookies: null
            });
            return;
        }

        await connectToDatabase();
        const accounts = getAccountsCollection();

        const account = await accounts.findOne({
            platform: 'linkedin',
            username: username
        });

        if (!account || !account.linkedinCookies || account.linkedinCookies.length === 0) {
            console.error(`No LinkedIn cookies found for username: ${username}`);
            res.status(404).json({ 
                success: false,
                message: `No LinkedIn cookies found for username: ${username}`,
                cookies: null
            });
            return;
        }

        console.log(`Found ${account.linkedinCookies.length} raw LinkedIn cookies for ${username}`);

        const cookies: CookieParam[] = account.linkedinCookies.map((c: any) => {
            let expires: number | undefined;
            if (c.expires) {
                if (c.expires.$numberInt) {
                    expires = parseInt(c.expires.$numberInt, 10);
                } else if (c.expires.$numberDouble) {
                    expires = Math.floor(parseFloat(c.expires.$numberDouble));
                } else if (typeof c.expires === 'number') {
                    expires = c.expires;
                }
            }

            let sameSite: 'Strict' | 'Lax' | 'None' | undefined;
            if (c.sameSite === 'Strict' || c.sameSite === 'Lax' || c.sameSite === 'None') {
                sameSite = c.sameSite;
            }

            return {
                name: c.name,
                value: c.value,
                url: 'https://www.linkedin.com',
                expires,
                httpOnly: Boolean(c.httpOnly),
                secure: Boolean(c.secure),
                sameSite
            };
        });

        console.log(`Transformed ${cookies.length} LinkedIn cookies for Puppeteer`);
        res.status(200).json({ 
            success: true,
            message: `Found ${cookies.length} LinkedIn cookies for ${username}`,
            cookies: cookies
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error retrieving LinkedIn cookies:', errorMessage);
        res.status(500).json({ 
            success: false,
            message: 'Error retrieving LinkedIn cookies', 
            error: errorMessage,
            cookies: null
        });
    }
}

/**
 * Add a new target username to a LinkedIn account
 */
/**
 * Add a new target username to a LinkedIn account
 * Updated to preserve original case and prevent case-sensitive duplicates
 */
export async function addTargetUsernameToLinkedIn(
    accountUsername: string, 
    targetUsername: string
): Promise<boolean> {
    try {
        await connectToDatabase();
        const accounts = getAccountsCollection();
        
        // Add the username exactly as provided, without any case changes
        const result = await accounts.updateOne(
            { 
                username: accountUsername,
                platform: "linkedin",
                // Check for exact match only (not case-insensitive) to avoid duplicates
                "filteredUsers.targetUsername": { $ne: targetUsername }
            },
            { 
                $push: { 
                    filteredUsers: {
                        _id: new ObjectId(),
                        targetUsername: targetUsername, // Preserve exact case as provided
                        isActive: true,
                        lastChecked: null,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                } as any
            }
        );
        
        if (result.modifiedCount > 0) {
            logger.info(`Added target username "${targetUsername}" to LinkedIn account ${accountUsername}`);
            return true;
        } else {
            logger.warn(`Failed to add target username "${targetUsername}" - LinkedIn account ${accountUsername} not found`);
            return false;
        }
    } catch (error) {
        logger.error(`Error adding target username "${targetUsername}" to LinkedIn account ${accountUsername}:`, error);
        return false;
    }
}

/**
 * Remove a target username from a LinkedIn account
 */
export async function removeTargetUsernameFromLinkedIn(
    accountUsername: string, 
    targetUsername: string
): Promise<boolean> {
    try {
        await connectToDatabase();
        const accounts = getAccountsCollection();
        
        const result = await accounts.updateOne(
            { 
                username: accountUsername,
                platform: "linkedin"
            },
            { 
                $pull: { 
                    filteredUsers: {
                        targetUsername: targetUsername
                    }
                } as any
            }
        );
        
        if (result.modifiedCount > 0) {
            logger.info(`Removed target username ${targetUsername} from LinkedIn account ${accountUsername}`);
            return true;
        } else {
            logger.warn(`Target username ${targetUsername} not found for LinkedIn account ${accountUsername}`);
            return false;
        }
    } catch (error) {
        logger.error(`Error removing target username ${targetUsername} from LinkedIn account ${accountUsername}:`, error);
        return false;
    }
}

/**
 * Toggle active status of a target username for a LinkedIn account
 */
export async function toggleTargetUsernameStatusLinkedIn(
    accountUsername: string, 
    targetUsername: string,
    isActive: boolean
): Promise<boolean> {
    try {
        await connectToDatabase();
        const accounts = getAccountsCollection();
        
        const result = await accounts.updateOne(
            { 
                username: accountUsername,
                platform: "linkedin",
                "filteredUsers.targetUsername": targetUsername
            },
            { 
                $set: { 
                    "filteredUsers.$.isActive": isActive,
                    "filteredUsers.$.updatedAt": new Date()
                }
            }
        );
        
        if (result.modifiedCount > 0) {
            logger.info(`Updated target username ${targetUsername} status to ${isActive} for LinkedIn account ${accountUsername}`);
            return true;
        } else {
            logger.warn(`Target username ${targetUsername} not found for LinkedIn account ${accountUsername}`);
            return false;
        }
    } catch (error) {
        logger.error(`Error updating target username ${targetUsername} status for LinkedIn account ${accountUsername}:`, error);
        return false;
    }
}

/**
 * Get LinkedIn account statistics
 */
export async function getLinkedInAccountStats(accountUsername: string): Promise<{
    totalTargets: number;
    activeTargets: number;
    lastActivity?: Date;
} | null> {
    try {
        await connectToDatabase();
        const accounts = getAccountsCollection();
        
        const account = await accounts.findOne({
            username: accountUsername,
            platform: "linkedin"
        });
        
        if (!account) {
            logger.warn(`No LinkedIn account found with username ${accountUsername}`);
            return null;
        }
        
        const totalTargets = account.filteredUsers.length;
        const activeTargets = account.filteredUsers.filter((user: { isActive: boolean }) => user.isActive).length;
        
        // Find the most recent lastChecked date
        const lastActivity = account.filteredUsers
            .filter((user: { lastChecked?: Date }) => user.lastChecked)
            .map((user: { lastChecked: Date }) => user.lastChecked)
            .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
        
        return {
            totalTargets,
            activeTargets,
            lastActivity
        };
    } catch (error) {
        logger.error(`Error getting LinkedIn account stats for ${accountUsername}:`, error);
        return null;
    }
}