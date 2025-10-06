import { Server } from "proxy-chain";
import { ObjectId } from 'mongodb';
import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import logger from '../config/logger';
import { getCommentsCollection } from '../config/db';
import { getInstagramCookiesByUsername } from "../client/agentcontroller";

// -------------------------------------------------------
// Puppeteer Setup
// -------------------------------------------------------
puppeteer.use(StealthPlugin());
puppeteer.use(
  AdblockerPlugin({
    interceptResolutionPriority: 1,
  })
);

interface CommentAnalysis {
  _id?: ObjectId;
  commentId: ObjectId;
  postId: string;
  username: string;
  commentText: string;
  likes: number;
  repliesCount: number;
  repliesData: ReplyData[];
  status: 'posted' | 'analyzed';
  errorMessage?: string;
  analyzedAt?: Date;
  lastUpdated: Date;
}

interface ReplyData {
  username: string;
  text: string;
  likes: number;
}

// Simple delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Random delay generator
const getRandomDelay = (min = 30000, max = 100000): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Extract likes count from a comment container
 */
async function extractLikes(page: Page, commentText: string): Promise<number> {
  try {
    const likes = await page.evaluate((text) => {
      // Find the span containing the comment text
      const spans = Array.from(document.querySelectorAll('span'));
      const commentSpan = spans.find(s => s.textContent?.includes(text));
      
      if (!commentSpan) return 0;
      
      // Navigate up to find the container (8 levels up based on document 2)
      let container: HTMLElement | null = commentSpan;
      for (let i = 0; i < 8; i++) {
        container = container?.parentElement || null;
        if (!container) return 0;
      }
      
      // Search for likes within the container
      const allSpans = container.querySelectorAll('span');
      for (const span of allSpans) {
        const text = span.textContent?.trim() || '';
        if (text.toLowerCase().includes('like')) {
          const match = text.match(/\d+/);
          if (match) return parseInt(match[0], 10);
        }
      }
      
      return 0;
    }, commentText);
    
    logger.info(`Found ${likes} likes`);
    return likes;
  } catch (error) {
    logger.error(`Error extracting likes: ${error}`);
    return 0;
  }
}

/**
 * Click all "View replies" buttons for a specific comment
 */
async function expandReplies(page: Page, commentText: string): Promise<number> {
  try {
    const clicks = await page.evaluate(async (text) => {
      // Helper to sleep in browser context
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      
      // Find the comment span
      const spans = Array.from(document.querySelectorAll('span'));
      const commentSpan = spans.find(s => s.textContent?.includes(text));
      
      if (!commentSpan) return 0;
      
      // Navigate up to find the container
      let container: HTMLElement | null = commentSpan;
      for (let i = 0; i < 8; i++) {
        container = container?.parentElement || null;
        if (!container) return 0;
      }
      
      let totalClicks = 0;
      
      // Try multiple rounds to expand all replies
      for (let round = 0; round < 8; round++) {
        const buttons = container.querySelectorAll('div[role="button"]');
        let clicked = false;
        
        for (const btn of buttons) {
          const buttonText = btn.textContent?.toLowerCase() || '';
          if (buttonText.includes('view') && buttonText.includes('repl')) {
            try {
              (btn as HTMLElement).scrollIntoView({ block: 'center' });
              await sleep(300);
              (btn as HTMLElement).click();
              totalClicks++;
              clicked = true;
              await sleep(1500);
            } catch (e) {
              // Ignore click errors
            }
          }
        }
        
        if (!clicked) break;
        await sleep(1000);
      }
      
      return totalClicks;
    }, commentText);
    
    logger.info(`Clicked ${clicks} 'View replies' buttons`);
    return clicks;
  } catch (error) {
    logger.error(`Error expanding replies: ${error}`);
    return 0;
  }
}

/**
 * Extract all replies data from a comment
 */
async function extractRepliesData(page: Page, commentText: string): Promise<ReplyData[]> {
  try {
    const replies = await page.evaluate((text) => {
      const repliesData: ReplyData[] = [];
      
      // Find the comment span
      const spans = Array.from(document.querySelectorAll('span'));
      const commentSpan = spans.find(s => s.textContent?.includes(text));
      
      if (!commentSpan) return repliesData;
      
      // Navigate up to find the container
      let container: HTMLElement | null = commentSpan;
      for (let i = 0; i < 8; i++) {
        container = container?.parentElement || null;
        if (!container) return repliesData;
      }
      
      // Find the replies list (UL element)
      const replyList = container.querySelector('ul');
      if (!replyList) return repliesData;
      
      // Get all reply divs
      const replyDivs = replyList.querySelectorAll(':scope > div > div');
      
      for (const reply of replyDivs) {
        let username = 'unknown';
        let replyText = '';
        let likes = 0;
        
        // Extract username
        const userLinks = reply.querySelectorAll('a[href*="/"]');
        for (const link of userLinks) {
          const u = link.textContent?.trim() || '';
          if (u && !u.toLowerCase().includes('like') && !u.toLowerCase().includes('reply')) {
            username = u;
            break;
          }
        }
        
        // Extract reply text
        const textSpans = reply.querySelectorAll('span');
        for (const span of textSpans) {
          const t = span.textContent?.trim() || '';
          if (t && 
              t.length > 5 && 
              t !== username &&
              !t.toLowerCase().includes('like') && 
              !t.toLowerCase().includes('reply') && 
              !t.toLowerCase().includes('view') &&
              t.length > replyText.length) {
            replyText = t;
          }
        }
        
        // Extract likes
        for (const span of textSpans) {
          const t = span.textContent?.trim() || '';
          if (t.toLowerCase().includes('like')) {
            const match = t.match(/\d+/);
            if (match) {
              likes = parseInt(match[0], 10);
              break;
            }
          }
        }
        
        if (replyText && replyText !== username) {
          repliesData.push({ username, text: replyText, likes });
        }
      }
      
      return repliesData;
    }, commentText);
    
    logger.info(`Extracted ${replies.length} replies`);
    if (replies.length > 0) {
      logger.info('Replies data:');
      replies.forEach((reply, index) => {
        logger.info(`  Reply ${index + 1}:`);
        logger.info(`    Username: ${reply.username}`);
        logger.info(`    Text: ${reply.text}`);
        logger.info(`    Likes: ${reply.likes}`);
      });
      logger.info(`Full replies JSON: ${JSON.stringify(replies, null, 2)}`);
    } else {
      logger.warn('No replies found');
    }
    
    return replies;
  } catch (error) {
    logger.error(`Error extracting replies: ${error}`);
    return [];
  }
}

/**
 * Load all comments on the page by scrolling and clicking "View more comments"
 */


/**
 * Main queue processing function
 */
export async function processAnalysisQueue(
  username: string, 
  minPort: number = 6000, 
  maxPort: number = 7000
): Promise<void> {
  const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
  
  logger.info(`Starting analysis session for ${username} on port ${port}`);
  
  let proxyServer: Server | null = null;
  let browser: Browser | null = null;
  
  try {
    // Start proxy server
    proxyServer = new Server({ port });
    
    await new Promise<void>((resolve, reject) => {
      proxyServer!.listen(() => {
        logger.info(`Proxy started on port ${port}`);
        resolve();
      });
      
      proxyServer!.on('error', (err: Error) => {
        reject(new Error(`Failed to start proxy on port ${port}: ${err.message}`));
      });
    });
    
    const proxyUrl = `http://localhost:${port}`;
    
    // Launch browser with proxy
    browser = await puppeteer.launch({
      headless: true,
      args: [
        `--proxy-server=${proxyUrl}`,
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    
    const page = await browser.newPage();
    
    // Get cookies
    
   // Get cookies - retry every 3 minutes until found
let cookiesData;
while (true) {
  logger.info(`Attempting to retrieve Instagram cookies for ${username}...`);
  cookiesData = await getInstagramCookiesByUsername(username);
  
  if (cookiesData && cookiesData.cookies) {
    logger.info(`Successfully retrieved cookies for ${username}`);
    break;
  }
  
  logger.warn(`Could not retrieve Instagram cookies for ${username}. Retrying in 3 minutes...`);
  await delay(3 * 60 * 1000); // Wait 3 minutes
}
    
    // Navigate and apply cookies
    logger.info(`Navigating to Instagram homepage for ${username}...`);
    await page.goto("https://www.instagram.com/", { 
      waitUntil: "networkidle2",
      timeout: 60000
    });
    
    logger.info(`Applying cookies for ${username}...`);
    await page.setCookie(...cookiesData.cookies);
    await page.reload({ waitUntil: "networkidle2" });
    
    // Verify login
    try {
      await page.waitForSelector("a[href='/direct/inbox/']", { timeout: 10000 });
      logger.info(`Logged into Instagram as ${username}`);
    } catch (e) {
      throw new Error(`Failed to log in as ${username}`);
    }

    const commentsCollection = getCommentsCollection();
    

    // Main processing loop
    while (true) {
      // Find a comment that needs analysis (older than 12 hours)
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      
      const comment = await commentsCollection.findOne(
        { 
          username,
          status: 'posted',  // Only get comments with status 'posted'
          postId: { $exists: true },
          $or: [
            { lastUpdated: { $exists: false } },
            { lastUpdated: { $lt: twelveHoursAgo } }
          ]
        },
        { sort: { lastUpdated: 1 } }
      );

      if (!comment) {
        logger.info("No comments need re-analysis (all analyzed within last 12 hours). Waiting 3 minutes...");
        await delay(120 * 60 * 1000);
        continue;
      }

      logger.info(`Processing comment ${comment._id} on post ${comment.postId}`);
      
      let success = false;
      let errorMessage = "";

      // Try analysis up to 3 times
      for (let attempt = 1; attempt <= 3; attempt++) {
        logger.info(`Analysis attempt ${attempt} for comment ${comment._id}`);
        
        try {
          // Navigate to post
          const postUrl = `https://www.instagram.com/p/${comment.postId}/`;
          logger.info(`Navigating to: ${postUrl}`);
          await page.goto(postUrl, { waitUntil: 'networkidle2' });
          await delay(3000);
          
          // Check if comment exists on page
          const commentExists = await page.evaluate((text) => {
            const spans = Array.from(document.querySelectorAll('span'));
            return spans.some(s => s.textContent?.includes(text));
          }, comment.comment);
          
          if (!commentExists) {
            throw new Error(`Comment "${comment.comment}" not found on page`);
          }
          
          logger.info(`Found comment on page`);
          
          // Expand all replies for this comment
          await expandReplies(page, comment.comment);
          await delay(2000);
          
          // Extract analysis data
          const likes = await extractLikes(page, comment.comment);
          const repliesData = await extractRepliesData(page, comment.comment);
          
          logger.info(`Analysis complete: ${likes} likes, ${repliesData.length} replies`);
          
          // Store analysis results - update data and lastUpdated only
          await commentsCollection.updateOne(
            { _id: new ObjectId(comment._id) },
            { 
              $set: {
                likes: likes,
                repliesCount: repliesData.length,
                repliesData: repliesData,
                lastUpdated: new Date()  // Update timestamp to prevent re-analysis for 12 hours
              }
            }
          );
          
          logger.info(`Successfully analyzed comment ${comment._id}`);
          success = true;
          break;
          
        } catch (error) {
          logger.error(`Attempt ${attempt} failed:`, error);
          
          if (error instanceof Error) {
            errorMessage = error.message;
          } else {
            errorMessage = String(error);
          }
          
          if (attempt < 3) {
            const retryDelay = getRandomDelay(20000, 40000);
            logger.info(`Waiting ${retryDelay}ms before retry`);
            await delay(retryDelay);
          }
        }
      }
      
      // If all 3 attempts failed, still update lastUpdated to avoid immediate retry
      if (!success) {
        await commentsCollection.updateOne(
          { _id: new ObjectId(comment._id) },
          { 
            $set: {
              lastUpdated: new Date(),  // Update timestamp even on failure
              lastError: errorMessage   // Store error for debugging
            }
          }
        );
        logger.error(`Failed to analyze comment ${comment._id} after 3 attempts: ${errorMessage}`);
      }
      
      // Wait before processing next comment
      const waitDelay = getRandomDelay(30000, 60000);
      logger.info(`Waiting ${waitDelay}ms before next comment`);
      await delay(waitDelay);
    }
    
  } catch (error) {
    logger.error('Error during analysis queue processing:', error);
    await delay(30000);
    
    if (browser && browser.isConnected()) {
      try {
        await browser.close();
      } catch (closeError) {
        logger.error('Error closing browser:', closeError);
      }
    }
    
  } finally {
    if (browser && browser.isConnected()) {
      try {
        await browser.close();
        logger.info('Browser closed');
      } catch (closeError) {
        logger.error('Error closing browser:', closeError);
      }
    }
    
    if (proxyServer) {
      try {
        await proxyServer.close(true);
        logger.info('Proxy server closed');
      } catch (closeError) {
        logger.error('Error closing proxy:', closeError);
      }
    }
  }
}