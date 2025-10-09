// controllers/commentsControllers.ts

import { Request, Response } from 'express';
import { ObjectId,PushOperator,UpdateFilter  } from 'mongodb';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import logger from '../config/logger';
import fs from 'fs';
import { connectToDatabase, getCommentsCollection, getAccountsCollection, upsertAccount } from '../config/db';
import { IUser } from '../models/user';
import { Browser } from 'puppeteer';

puppeteer.use(StealthPlugin());
puppeteer.use(
  AdblockerPlugin({
    interceptResolutionPriority: 1,
  })
);

// Helper function to get username from userId
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function getUsernameFromUserId(userId: string): Promise<string | null> {
  try {
    const accountsCollection = getAccountsCollection();
    const account = await accountsCollection.findOne({ 
      userId, 
      platform: 'linkedin' 
    });
    return account?.username || null;
  } catch (error) {
    logger.error(`Error getting username from userId ${userId}:`, error);
    return null;
  }
}


// -------------------------------------------------------
// Controller Endpoints
// -------------------------------------------------------

export const getlinkComments = async (req: Request, res: Response): Promise<void> => {
  try {
    await connectToDatabase();
    // Get username from query parameter
    const username = typeof req.query.username === 'string' ? req.query.username : undefined;
    
    if (!username) {
      res.status(400).json({ message: 'username parameter is required' });
      return;
    }
    
    const commentsCollection = getCommentsCollection();
    
    // Query comments using the username field
    const comments = await commentsCollection
      .find({ "username": username })
      .toArray();
    
    // If no comments found
    if (comments.length === 0) {
      res.status(200).json({ 
        message: 'No comments available at the moment. Comments are being generated.',
        comments: []
      });
      return;
    }

    // Format the comments with analysis data
    const formatted = comments.map(c => ({
      id: c._id.toString(),
      accountId: c.accountId,
      userId: c.userId,
      platform: c.platform,
      postUrl: c.postId,
      postUsername: c.postUsername,
      postCaption: c.caption ?? c.Caption,
      comment: c.comment,
      timestamp: c.timestamp ?? c.createdAt,
      status: c.status ?? 'pending',
      model: c.model ?? 'llama3.1',
      
      // Analysis data from LinkedIn comment analysis
      likes: c.likes ?? 0,
      impressions: c.impressions ?? 0,
      repliesCount: c.repliesCount ?? 0,
      repliesData: c.repliesData ?? [],
      
      // Analysis timestamps
      analyzedAt: c.analyzedAt ?? null,
      lastUpdated: c.lastUpdated ?? null,
      
      // Error information if any
      lastError: c.lastError ?? null,
      errorMessage: c.errorMessage ?? null,
      
      // Metadata
      metadata: c.metadata ?? {}
    }));

    res.status(200).json(formatted);

  } catch (error) {
    logger.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
};

export const getCommentById = async (req: Request, res: Response): Promise<void> => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    const userId = typeof req.query.userId === 'string'
      ? req.query.userId
      : undefined;

    const coll = getCommentsCollection();
    const filter: any = { _id: new ObjectId(id) };
    if (userId) filter.userId = userId;

    const c = await coll.findOne(filter);
    if (!c) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }
    
    // Resolve username if missing
    let username = c.username;
    if (!username && c.userId) {
      username = await getUsernameFromUserId(c.userId);
    }
    
    res.status(200).json({
      id:          c._id.toString(),
      userId:      c.userId,
      postId:      c.postId,
      postCaption: c.caption,
      comment:     c.comment,             
      timestamp:   c.timestamp,
      status:      c.status   ?? 'pending',
      model:       c.model    ?? 'llama3.1',
      username

    });
  } catch (e) {
    logger.error('Error fetching comment:', e);
    res.status(500).json({ message: 'Failed to fetch comment' });
  }
};

export const setLinkedinUsername = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.body;
    
    if (!username) {
      res.status(400).json({ message: 'Username is required' });
      return;
    }
    
    // Get userId from authenticated user using the correct type
    const userId = req.isAuthenticated() ? (req.user as IUser)._id : undefined;
    
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    
    await connectToDatabase();
    const accountsCollection = getAccountsCollection();
    const commentsCollection = getCommentsCollection();
    
    const existingAccount = await accountsCollection.findOne({ 
      userId, 
      platform: 'linkedin'
    });
    
    if (existingAccount) {
      // Update username on existing account
      await accountsCollection.updateOne(
        { _id: existingAccount._id },
        { 
          $set: { 
            username,
            updatedAt: new Date()
          } 
        }
      );
      
      // Update username on all comments by this user
      await commentsCollection.updateMany(
        { userId: userId.toString() },
        { $set: { username } }
      );
      
      logger.info(`Instagram username updated for user ${userId}: ${username}`);
    } else {
      // Create new account record
      const newAccount = {
        userId,
        platform: 'linkedin',
        username,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: false // Not active until login
      };
      
      await accountsCollection.insertOne(newAccount);
      
      // Update username on any existing comments by this user
      await commentsCollection.updateMany(
        { userId: userId.toString() },
        { $set: { username } }
      );
      
      logger.info(`New Instagram account recorded for user ${userId}: ${username}`);
    }
    
    res.status(200).json({ 
      success: true, 
      message: `Instagram username ${username} saved successfully` 
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Error saving Instagram username: ${errorMsg}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save Instagram username',
      error: errorMsg
    });
  }
};

export const getLinkedinStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    
    if (!userId) {
      res.status(400).json({ message: 'userId parameter is required' });
      return;
    }
    
    await connectToDatabase();
    const accountsCollection = getAccountsCollection();
    
    const account = await accountsCollection.findOne({ 
      userId, 
      platform: 'linkedin' 
    });
    
    // Check if we have valid cookies
    const cookiesPath = './cookies/Instagramcookies.json';
    const cookiesExist = fs.existsSync(cookiesPath);
    
    // Determine login status
    let loggedIn = false;
    if (account && cookiesExist) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        loggedIn = cookies.length > 0;
      } catch (e) {
        logger.error('Error reading cookies file:', e);
      }
    }
    
    res.status(200).json({
      loggedIn,
      username: account?.username || null,
      hasAccount: !!account
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Error checking Instagram status: ${errorMsg}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check Instagram status',
      error: errorMsg
    });
  }
};

export const rejectComment = async (req: Request, res: Response): Promise<void> => {
  try {
    await connectToDatabase();
    const { id } = req.params;

    const coll = getCommentsCollection();
    const filter = { _id: new ObjectId(id) };

    const r = await coll.deleteOne(filter);
    if (r.deletedCount === 0) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }
    res.status(200).json({ message: 'Comment rejected' });
  } catch (e) {
    logger.error('Error rejecting comment:', e);
    res.status(500).json({ message: 'Failed to reject comment' });
  }
};

export const postComment = async (req: Request, res: Response): Promise<void> => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    const coll = getCommentsCollection();
    const filter = { _id: new ObjectId(id) };

    // Verify the comment exists
    const comment = await coll.findOne(filter);
    if (!comment) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    // Mark it for processing and update timestamp
    await coll.updateOne(
      filter,
      { $set: { status: 'processing', lastUpdated: new Date() } }
    );

    // Respond immediately—your background worker will pick this up
    res.status(200).json({ message: 'Comment queued for processing' });
  } catch (e) {
    logger.error('Error queueing comment for processing:', e);
    res.status(500).json({ message: 'Failed to queue comment' });
  }
};

export const updateComment = async (req: Request, res: Response): Promise<void> => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    const { comment: newComment } = req.body;
    if (!newComment?.trim()) {
      res.status(400).json({ message: 'Invalid comment' });
      return;
    }

    const coll = getCommentsCollection();
    const filter = { _id: new ObjectId(id) };
    
    // First get the existing comment to preserve username and userId
    const existingComment = await coll.findOne(filter);
    if (!existingComment) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }
    
    // Preserve username or add it if missing
    let username = existingComment.username;
    if (!username && existingComment.userId) {
      username = await getUsernameFromUserId(existingComment.userId);
    }
    
    const updateData: any = { 
      comment: newComment, 
      lastUpdated: new Date() 
    };
    
    if (username) {
      updateData.username = username;
    }
    
    const r = await coll.updateOne(filter, { $set: updateData });
    if (r.modifiedCount === 0) {
      res.status(404).json({ message: 'Not found or no change' });
      return;
    }
    res.status(200).json({ message: 'Updated' });
  } catch (e) {
    logger.error('Error updating comment:', e);
    res.status(500).json({ message: 'Failed to update comment' });
  }
};

export const approveComment = async (req: Request, res: Response): Promise<void> => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    
    const coll = getCommentsCollection();
    
    // Updated filter to only use the comment ID
    const filter = { _id: new ObjectId(id), status: 'pending' };
    
    const comment = await coll.findOne(filter);
    if (!comment) {
      res.status(404).json({ message: 'Pending comment not found' });
      return;
    }
    
    // Get username if not present
    let updateData: any = { status: 'approved' };
    if (!comment.username && comment.userId) {
      const username = await getUsernameFromUserId(comment.userId);
      if (username) {
        updateData.username = username;
      }
    }
    
    const r = await coll.updateOne(filter, { $set: updateData });
    if (r.modifiedCount === 0) {
      res.status(500).json({ message: 'Failed to approve' });
      return;
    }
    res.status(200).json({ message: 'Approved' });
  } catch (e) {
    logger.error('Error approving comment:', e);
    res.status(500).json({ message: 'Failed to approve comment' });
  }
};
export const linkedinLogin = async (req: Request, res: Response): Promise<void> => {
  let linkedinBrowser: Browser | null = null;
  
  try {
    // Extract username from request body or query parameters
    const { username } = req.body || req.query;
    
    if (!username) {
      res.status(400).json({ message: "Username is required" });
      return;
    }

    // Enhanced browser launch options for cross-environment compatibility
    const browserOptions = {
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=secure',
        '--allow-running-insecure-content',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript-harmony-shipping',
        '--disable-client-side-phishing-detection',
        '--disable-sync',
        '--disable-default-apps',
        '--hide-scrollbars',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--force-fieldtrials=*BackgroundTracing/default/',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      // Set executable path if needed (uncomment and adjust for your system)
      // executablePath: '/usr/bin/google-chrome-stable', // Linux
      // executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
    };

    // Add Windows-specific options if running on Windows
    if (process.platform === 'win32') {
      browserOptions.args.push('--disable-gpu-sandbox');
    }

    // Launch browser with enhanced options
    linkedinBrowser = await puppeteer.launch(browserOptions);
    const linkedinPage = await linkedinBrowser.newPage();

    // Set a realistic viewport and user agent
    await linkedinPage.setViewport({ width: 1366, height: 768 });
    await linkedinPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set additional page properties to avoid detection
    await linkedinPage.evaluateOnNewDocument(() => {
      delete (window as any).navigator.webdriver;
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    // Set extra HTTP headers
    await linkedinPage.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    });

    // Navigate to LinkedIn login page
    await linkedinPage.goto("https://www.linkedin.com/login", { waitUntil: 'networkidle2' });

    // Wait for manual login - check for LinkedIn-specific elements that indicate successful login
    try {
      // Wait for one of these elements that appear after successful login
      await linkedinPage.waitForSelector("nav[aria-label='Primary Navigation'], .global-nav, .feed-container-theme, [data-control-name='nav.settings_and_privacy']", { timeout: 60000 });
      logger.info("Connexion LinkedIn détectée (navigation principale présente).");
    } catch (e) {
      logger.warn("Éléments de navigation LinkedIn non détectés dans les 60s, attente additionnelle de 10s.");
      await delay(10000);
    }

    // Save cookies (containing login information)
    const cookies = await linkedinPage.cookies();
    
    // Save cookies to database with the username
    try {
      const db = await connectToDatabase();
      const accountsCollection = getAccountsCollection();
      
      // Update the account document with LinkedIn cookies
      const result = await accountsCollection.updateOne(
        { username: username },
        { 
          $set: { 
            linkedinCookies: cookies,
            linkedinLastUpdate: new Date()
          }
        },
        { upsert: true }
      );
      
      logger.info(`Cookies LinkedIn sauvegardés en base de données pour l'utilisateur ${username}.`);
      logger.debug(`Résultat de l'opération DB: ${result.modifiedCount} document(s) modifié(s), ${result.upsertedCount} document(s) créé(s).`);
    } catch (dbError) {
      logger.error("Erreur lors de la sauvegarde des cookies LinkedIn en base de données:", dbError);
    }

    // Close browser after login
    await linkedinBrowser.close();

    res.status(200).json({ 
      message: "LinkedIn login completed. Cookies saved.",
      username: username
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("Erreur lors de la connexion à LinkedIn:", errMsg);
    
    // Ensure browser is closed even on error
    if (linkedinBrowser) {
      try {
        await linkedinBrowser.close();
      } catch (closeError) {
        logger.error("Error closing browser:", closeError);
      }
    }
    
    res.status(500).json({ message: "Échec de la connexion à LinkedIn.", error: errMsg });
  }
};
// Flexible typing for filtered users to match your schema
interface FilteredUser {
  _id: ObjectId;
  targetUsername: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  lastChecked: Date | null;
}

interface Account extends Document {
  _id?: ObjectId;
  userId: string;
  platform: string;
  username?: string;
  filteredUsers?: FilteredUser[];
}

// Utility function to safely convert user ID
function safeUserIdToString(user: IUser | undefined): string | undefined {
  return user?._id?.toString();
}

export const saveFilteredUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get targetUsername from request body (sent from frontend)
    const { targetUsername: rawTarget, username } = req.body as {
      targetUsername?: string;
      username?: string;
    };

    console.log(req.body);

    // Validate targetUsername
    if (!rawTarget) {
      res.status(400).json({ success: false, message: 'Target username is required' });
      return;
    }

    // Normalize target username
    const targetUsername = rawTarget.trim().replace(/^@/, '');

    // Validate main username (from frontend stateManager)
    if (!username) {
      res.status(400).json({ success: false, message: 'Instagram username is required' });
      return;
    }

    // Removed authentication check as requested
    
    await connectToDatabase();
    const accounts = getAccountsCollection();

    // Find the account directly using username
    const account = await accounts.findOne({ 
      platform: 'linkedin',
      username 
    });

    if (!account) {
      res.status(400).json({ 
        success: false, 
        message: `No linkedin account found for username: ${username}` 
      });
      return;
    }

    // Check for existing filter
    const existingFilters = account.filteredUsers ?? [];
    if (existingFilters.some((f: FilteredUser) => f.targetUsername === targetUsername)) {
      res.status(400).json({ 
        success: false, 
        message: `Youre already tracking @${targetUsername}` 
      });
      return;
    }

    // Create new filter
    const newFilter: FilteredUser = {
      _id: new ObjectId(),
      targetUsername,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      lastChecked: null
    };

    // Update database - using username as identifier instead of userId
    const result = await accounts.updateOne(
      { platform: 'linkedin', username },
      {
        $push: { filteredUsers: newFilter } as unknown as PushOperator<FilteredUser>,
        $set: { updatedAt: new Date() }
      }
    );

    if (result.modifiedCount === 0) {
      res.status(500).json({ success: false, message: 'Failed to add filtered user' });
      return;
    }

    logger.info(`User ${username} added filtered user: ${targetUsername}`);
    res.status(200).json({
      success: true,
      message: `Successfully added @${targetUsername} to your filters`,
      id: newFilter._id.toString()
    });

    console.log("flag")

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Error saving filtered user: ${msg}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save filtered user', 
      error: msg 
    });
  }
};

export const getFilteredUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const username = typeof req.query.username === 'string' ? req.query.username : undefined;
    console.log(req.query);
    if (!username) {
      res.status(400).json({ message: 'username parameter is required' });
      return;
    }

    await connectToDatabase();
    const accounts = getAccountsCollection();

    // Find account by username
    const account = await accounts.findOne({ username, platform: 'linkedin' });
    
    if (!account) {
      res.status(404).json({ message: 'Account not found for username: ' + username });
      return;
    }
    
    // Extract just the targetUsernames from filteredUsers array
    const targetUsernames = account.filteredUsers?.map((user: any) => user.targetUsername) || [];

    res.status(200).json({ targetUsernames });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Error fetching target usernames: ${msg}`);
    res.status(500).json({ message: 'Failed to fetch target usernames', error: msg });
  }
};
export const deleteFilteredUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get the targetUsername from params
    const { targetUsername } = req.params;
    if (!targetUsername) {
      res.status(400).json({ success: false, message: 'Target username is required' });
      return;
    }

    // Get username from query parameters using the exact method provided
    const username = typeof req.query.username === 'string' ? req.query.username : undefined;
    console.log(req.query);
    if (!username) {
      res.status(400).json({ message: 'username parameter is required' });
      return;
    }

    await connectToDatabase();
    const accounts = getAccountsCollection();

    // Find account by username
    const account = await accounts.findOne({ username, platform: 'linkedin' });
    
    if (!account) {
      res.status(404).json({ 
        success: false, 
        message: `Account with username "${username}" not found` 
      });
      return;
    }

    // Update the account to remove the targetUsername from filteredUsers
    // Fixed $pull operator syntax
    const result = await accounts.updateOne(
      { _id: account._id },
      { 
        $pull: { filteredUsers: { targetUsername } } as any,
        $set: { updatedAt: new Date() }
      }
    );

    if (result.modifiedCount === 0) {
      res.status(404).json({ 
        success: false, 
        message: `User "${targetUsername}" not found in filtered list` 
      });
      return;
    }

    res.status(200).json({ 
      success: true, 
      message: `User "${targetUsername}" removed successfully from filtered users` 
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Error deleting filtered user by username: ${msg}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete filtered user', 
      error: msg 
    });
  }
};