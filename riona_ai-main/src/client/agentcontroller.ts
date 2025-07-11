import {  ObjectId } from 'mongodb';

// Define the AccountDocument interface if it is not imported from elsewhere
export interface AccountDocument {
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
    
  } from '../config/db';
  import logger from '../config/logger';
  export async function checkTargetUsernameMatch(
    postUsername: string
  ): Promise<{ matched: boolean; accountData?: AccountDocument }> {
    try {
      await connectToDatabase();
      const accounts = getAccountsCollection();
      
      logger.info(`Checking if post username "${postUsername}" matches any target usernames in our database`);
      
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
        logger.info(`Found a match! Post username "${postUsername}" is in our target list`);
        return { 
          matched: true,
          accountData: account
        };
      } else {
        logger.info(`No match found for post username "${postUsername}" in our target list`);
        return { matched: false };
      }
    } catch (error) {
      logger.error(`Database error when checking target username match for "${postUsername}":`, error);
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
        platform: "instagram"
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
   * Update the lastChecked timestamp for a target username
   */
  export async function updateLastChecked(accountUsername: string, targetUsername: string): Promise<boolean> {
    try {
      await connectToDatabase();
      const accounts = getAccountsCollection();
      
      const result = await accounts.updateOne(
        { 
          username: accountUsername,
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
        logger.info(`Updated lastChecked timestamp for target username ${targetUsername}`);
        return true;
      } else {
        logger.warn(`Failed to update lastChecked timestamp for target username ${targetUsername}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error updating lastChecked for target username ${targetUsername}:`, error);
      return false;
    }
  }
import { CookieParam } from 'puppeteer';

export async function getInstagramCookiesByUsername(username: string): Promise<{ cookies: CookieParam[]; username: string } | null> {
  try {
    if (!username) {
      console.error('No Instagram username provided');
      return null;
    }

    await connectToDatabase();
    const accounts = getAccountsCollection();

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
    const cookies: CookieParam[] = account.instagramCookies.map((c: any) => {
      // Parse expires from Extended JSON
      let expires: number | undefined;
      if (c.expires) {
        if (c.expires.$numberInt) {
          expires = parseInt(c.expires.$numberInt, 10);
        } else if (c.expires.$numberDouble) {
          expires = Math.floor(parseFloat(c.expires.$numberDouble));
        }
      }

      // Determine SameSite
      let sameSite: 'Strict' | 'Lax' | 'None' | undefined;
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error retrieving Instagram cookies:', errorMessage);
    return null;
  }
}
// Client-side version (runs in browser)
import { Request, Response } from 'express';
export async function getCookies(req: Request, res: Response): Promise<void> {
  try {
    // Get username from request headers instead of localStorage
    const username = req.headers['x-instagram-username'] as string;
    
    if (!username) {
      console.error('No Instagram username found in request headers');
      res.status(400).json({ 
        success: false,
        message: 'No Instagram username found in request headers',
        cookies: null
      });
      return;
    }

    await connectToDatabase();
    const accounts = getAccountsCollection();

    const account = await accounts.findOne({
      platform: 'instagram',
      username: username
    });

    if (!account || !account.instagramCookies || account.instagramCookies.length === 0) {
      console.error(`No Instagram cookies found for username: ${username}`);
      res.status(404).json({ 
        success: false,
        message: `No Instagram cookies found for username: ${username}`,
        cookies: null
      });
      return;
    }

    console.log(`Found ${account.instagramCookies.length} raw cookies for ${username}`);

    const cookies: CookieParam[] = account.instagramCookies.map((c: any) => {
      let expires: number | undefined;
      if (c.expires) {
        if (c.expires.$numberInt) {
          expires = parseInt(c.expires.$numberInt, 10);
        } else if (c.expires.$numberDouble) {
          expires = Math.floor(parseFloat(c.expires.$numberDouble));
        }
      }

      let sameSite: 'Strict' | 'Lax' | 'None' | undefined;
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
    res.status(200).json({ 
      success: true,
      message: `Found ${cookies.length} cookies for ${username}`,
      cookies: cookies
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error retrieving Instagram cookies:', errorMessage);
    res.status(500).json({ 
      success: false,
      message: 'Error retrieving Instagram cookies', 
      error: errorMessage,
      cookies: null
    });
  }
}