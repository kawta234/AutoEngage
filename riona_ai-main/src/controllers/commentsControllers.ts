// controllers/commentsControllers.ts

import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import logger from '../config/logger';
import fs from 'fs';
import { connectToDatabase, getCommentsCollection, getAccountsCollection, upsertAccount } from '../config/db';
import { IUser } from '../models/user';
import { getInstagramUsername } from '../client/Instagram';
// -------------------------------------------------------
// Déclaration des sélecteurs utilisés dans ce module
// -------------------------------------------------------
const popupCloseSelector: string = 'button[class*="dismiss"]';
const commentBoxSelector: string = 'textarea[aria-label="Add a comment…"][placeholder="Add a comment…"]';
const likeButtonSelector = 'svg.x1lliihq.x1n2onr6.xyb1xck[aria-label="Like"]';

// -------------------------------------------------------
// Puppeteer Setup
// -------------------------------------------------------
puppeteer.use(StealthPlugin());
puppeteer.use(
  AdblockerPlugin({
    interceptResolutionPriority: 1,
  })
);

// Simple delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let browser: Browser | null = null;
let page: Page | null = null;

async function initBrowser(): Promise<{ browser: Browser; page: Page }> {
  if (browser && page) {
    return { browser, page };
  }
  browser = await puppeteer.launch({ headless: true });
  page = await browser.newPage();
  return { browser, page };
}

// Helper function to get username from userId
async function getUsernameFromUserId(userId: string): Promise<string | null> {
  try {
    const accountsCollection = getAccountsCollection();
    const account = await accountsCollection.findOne({ 
      userId, 
      platform: 'instagram' 
    });
    return account?.username || null;
  } catch (error) {
    logger.error(`Error getting username from userId ${userId}:`, error);
    return null;
  }
}
export async function fetchInstagramUsername(
  usernameSelector: string = 'span[dir="auto"][style*="--lineHeight: 20px"]'
): Promise<{ success: boolean; username?: string; message: string }> {
  let browser!: Browser;
  let page!: Page;

  try {
    // 1. Create new browser instance
    const result = await initBrowser();
    browser = result.browser;
    page = result.page;

    const cookiesPath = './cookies/Instagramcookies.json';
    if (!fs.existsSync(cookiesPath)) {
      logger.error('Cookies file not found. Run login flow first.');
      return { success: false, message: 'Cookies file not found' };
    }
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await Promise.all(cookies.map((c: any) => page.setCookie(c)));
    logger.info('Cookies loaded.');

    // 2. Navigate to Instagram
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    logger.info('Navigated to Instagram.');

    // 3. Get username
    const username = await getInstagramUsername(page, usernameSelector);
    logger.info(`Username found: ${username}`);

    // 4. Optionally save it
    fs.writeFileSync(
      './cookies/InstagramUsername.json',
      JSON.stringify({ username }, null, 2),
      'utf8'
    );

    await browser.close();
    return { success: true, username, message: 'Username retrieved successfully' };

    
  } catch (err) {
    // Error handling...
    return { success: false, message: (err as Error).message };
  } finally {
    // Make sure browser is closed in all cases
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        logger.error('Error closing browser:', closeErr);
      }
}
   } }
   export async function commentOnPostById(
    postId: string,
    comment: string
  ): Promise<{ success: boolean; message: string }> {
    let browser!: Browser;
    let page!: Page;
    let screenshotPath = `debug_${postId}_${Date.now()}.png`;
    
    try {
      const result = await initBrowser();
      browser = result.browser;
      page = result.page;
      
      // Load cookies from the file instead of logging in with credentials
      const cookiesPath = './cookies/Instagramcookies.json';
      if (fs.existsSync(cookiesPath)) {
        const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
        const cookies = JSON.parse(cookiesString);
        for (const cookie of cookies) {
          await page.setCookie(cookie);
        }
        logger.info("Cookies loaded successfully. Using them to authenticate.");
      } else {
        logger.error('Cookies file does not exist. Run the login process to create it.');
        return { success: false, message: "Cookies file not found" };
      }
  
      // Naviguer vers le post
      const postUrl = `https://www.instagram.com/p/${postId}/`;
      logger.info(`Navigating to post: ${postUrl}`);
      await page.goto(postUrl, { waitUntil: 'networkidle2' });
      await delay(3000);
  
      // Prendre une capture d'écran tôt pour le débogage
      await page.screenshot({ path: `before_action_${screenshotPath}` });
  
      // Fermer le popup si présent
      const popupEl = await page.$(popupCloseSelector);
      if (popupEl) {
        logger.info("Popup detected, attempting to close it.");
        await popupEl.click();
        await delay(1000);
      }
  
      // Liker le post (code existant)
      // ...
  
      // Zone de commentaire
      const commentBox = await page.$(commentBoxSelector);
      if (!commentBox) {
        logger.error("Comment box not found.");
        await page.screenshot({ path: `error_no_commentbox_${screenshotPath}` });
        return { success: false, message: 'Comment box not found' };
      }
  
      logger.info(`Found comment box for post ${postId}.`);
      await commentBox.click();
      await page.type(commentBoxSelector, comment);
      logger.info(`Posting comment: "${comment}"`);
  
      // Capture d'écran avant de cliquer sur Post
      await page.screenshot({ path: `before_post_${screenshotPath}` });
  
      // Rechercher et cliquer sur le bouton "Post"
      const postButtonHandle = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
        return buttons.find(
          (button) => button.textContent?.trim() === 'Post' && !button.hasAttribute('disabled')
        );
      });
  
      if (postButtonHandle) {
        logger.info(`Clicking Post button for post ${postId}...`);
        await (postButtonHandle as any).click();
        logger.info(`Comment action completed for post ${postId}.`);
        
        // Attendre et vérifier que le commentaire est bien posté
        await delay(2000);
        
        // Capture d'écran après avoir posté
        await page.screenshot({ path: `after_post_${screenshotPath}` });
        
        return { success: true, message: 'Comment posted successfully' };
      } else {
        logger.error('Post button not found');
        await page.screenshot({ path: `error_no_postbutton_${screenshotPath}` });
        return { success: false, message: 'Post button not found' };
      }
    } catch (error) {
      logger.error(`Error posting comment on post ${postId}:`, error);
      
      // Ne prendre une capture d'écran que si la page est toujours valide
      try {
        if (page && browser && browser.isConnected()) {
          await page.screenshot({ path: `error_${screenshotPath}` });
        }
      } catch (screenshotError) {
        logger.error(`Failed to take error screenshot: ${screenshotError}`);
      }
      
      return { success: false, message: `Error: ${error}` };
    } finally {
      // S'assurer que le navigateur est toujours fermé
      try {
        if (browser && browser.isConnected()) {
          await browser.close();
          logger.info(`Browser closed after comment operation`);
        }
      } catch (closeError) {
        logger.error(`Error closing browser: ${closeError}`);
      }
    }
  }

// -------------------------------------------------------
// Controller Endpoints
// -------------------------------------------------------

export const getAllComments = async (req: Request, res: Response): Promise<void> => {
  try {
    await connectToDatabase();
    // Get username from query parameter
    const username = typeof req.query.username === 'string' ? req.query.username : undefined;
    
    if (!username) {
      res.status(400).json({ message: 'username parameter is required' });
      return;
    }
    
    const commentsCollection = getCommentsCollection();
    
    // Option 1: First approach - find comments that have the username field directly
    const comments = await commentsCollection
      .find({ username })
      .toArray();
    
    // If no comments found with direct username, try the second approach
    if (comments.length === 0) {
      // Option 2: Second approach - find account by username, then find comments by userId
      const accountsCollection = getAccountsCollection();
      const account = await accountsCollection.findOne({ 
        username, 
        platform: 'instagram' 
      });
      
      if (account) {
        const commentsByUserId = await commentsCollection
          .find({ userId: account.userId.toString() })
          .toArray();
        
        if (commentsByUserId.length > 0) {
          const formatted = commentsByUserId.map(c => ({
            id: c._id.toString(),
            userId: c.userId,
            accountId: account._id.toString(),
            postId: c.postId,
            postCaption: c.caption ?? c.Caption,
            comment: c.comment,
            timestamp: c.timestamp ?? c.createdAt,
            status: c.status ?? 'pending',
            model: c.model ?? 'llama3.1',
            username: username,
            history: c.history || []
          }));
          
          res.status(200).json(formatted);
          return;
        }
      }
    }
    
    // Format comments if found through direct username
    if (comments.length > 0) {
      const formatted = comments.map(c => ({
        id: c._id.toString(),
        userId: c.userId,
        postId: c.postId,
        postCaption: c.caption ?? c.Caption,
        comment: c.comment,
        timestamp: c.timestamp ?? c.createdAt,
        status: c.status ?? 'pending',
        model: c.model ?? 'llama3.1',
        username: c.username,
        history: c.history || []
      }));
      
      res.status(200).json(formatted);
      return;
    }
    
    // If no comments found with either approach
    res.status(404).json({ 
      message: 'No comments found for this username',
      username: username
    });
    
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
      comment:     c.comment,              // ← renamed from generatedComment
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

export const instagramLogin = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Lancement du navigateur en mode non-headless avec options utiles
    const instBrowser: Browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const instPage = await instBrowser.newPage();

    // Accès à la page de login d'Instagram
    await instPage.goto("https://www.instagram.com/accounts/login/", { waitUntil: 'networkidle2' });
    await instPage.waitForSelector('input[name="username"]', { timeout: 60000 });
    logger.info("Page de connexion Instagram chargée. Veuillez vous connecter manuellement.");

    // Attente de la connexion manuelle de l'utilisateur.
    // Ici, nous attendons la présence du lien vers la messagerie comme preuve de connexion.
    try {
      await instPage.waitForSelector("a[href='/direct/inbox/']", { timeout: 60000 });
      logger.info("Connexion détectée (lien de messagerie présent).");
    } catch (e) {
      logger.warn("Lien de messagerie non détecté dans les 60s, attente additionnelle de 10s.");
      await delay(10000);
    }

    // Sauvegarde des cookies (contenant les informations de connexion)
    const cookies = await instPage.cookies();
    fs.writeFileSync('./cookies/Instagramcookies.json', JSON.stringify(cookies, null, 2));
    logger.info("Cookies Instagram sauvegardés avec succès.");

    // Fermer le navigateur après la connexion
    await instBrowser.close();

    res.status(200).json({ message: "Instagram login completed. Cookies saved." });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("Erreur lors de la connexion à Instagram:", errMsg);
    res.status(500).json({ message: "Échec de la connexion à Instagram.", error: errMsg });
  }
};

export const setInstagramUsername = async (req: Request, res: Response): Promise<void> => {
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
      platform: 'instagram'
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
        platform: 'instagram',
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

export const getInstagramStatus = async (req: Request, res: Response): Promise<void> => {
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
      platform: 'instagram' 
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