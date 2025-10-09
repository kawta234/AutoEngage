import { Server } from "proxy-chain";
import { ObjectId } from 'mongodb';
import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import logger from '../config/logger';
import { getCommentsCollection } from '../config/db';
import { getLinkedInCookiesByUsername } from "../client/linkedin/agentlinkedin";

// -------------------------------------------------------
// Puppeteer Setup
// -------------------------------------------------------
puppeteer.use(StealthPlugin());
puppeteer.use(
  AdblockerPlugin({
    interceptResolutionPriority: 1,
  })
);

interface LinkedInCommentAnalysis {
  _id?: ObjectId;
  username: string;
  userId: string;
  platform: string;
  postUrl: string;
  postContent: string;
  commentText: string;
  likes?: number;
  impressions?: number;
  repliesCount?: number;
  repliesData?: LinkedInReplyData[];
  status: 'posted' | 'analyzed';
  errorMessage?: string;
  analyzedAt?: Date;
  lastUpdated?: Date;
  createdAt: Date;
  metadata?: {
    batchNumber?: number;
    processingOrder?: number;
    userEmail?: string;
  };
}

interface LinkedInReplyData {
  username: string;
  text: string;
  likes: number;
  impressions?: string;
  timestamp?: string;
}

// Simple delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Random delay generator
const getRandomDelay = (min = 30000, max = 100000): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Find the comment container element by searching for comment text
 * Using the same approach as test.ts
 */
async function findCommentContainer(page: Page, commentText: string): Promise<string | null> {
  try {
    logger.info('🔍 Searching for target comment...');
    
    // Scroll to load comments - multiple times
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, 300);
      });
      await delay(1000);
    }

    // Try to expand "Show all comments" or "Show more comments"
    try {
      const expandButtons = [
        'button:has-text("Show all")',
        'button:has-text("Show more")',
        'button:has-text("See more")',
      ];

      for (const selector of expandButtons) {
        try {
          const buttons = await page.$$(selector);
          if (buttons.length > 0) {
            logger.info(`📂 Clicking expand button: ${selector}`);
            await buttons[0].click();
            await delay(2000);
          }
        } catch (e) {
          // Try next selector
        }
      }
    } catch (e) {
      logger.info('ℹ️  No expand buttons found or already expanded');
    }

    // Additional scroll after expanding
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });
    await delay(2000);

    // Find the container with the comment text
    const containerId = await page.evaluate((text) => {
      // Try multiple selectors
      const selectors = [
        '[data-id*="comment"]',
        '[id^="ember"]',
        '[class*="comments-comment-item"]',
        'article[data-id]',
        '.comments-comment-item'
      ];

      for (const selector of selectors) {
        const containers = document.querySelectorAll(selector);
        for (let i = 0; i < containers.length; i++) {
          const container = containers[i];
          const textContent = container.textContent || '';
          
          // Check if this container has our target comment (check first 50 chars)
          if (textContent.includes(text.substring(0, 50))) {
            const id = container.getAttribute('id');
            const classes = container.getAttribute('class');
            
            console.log('✅ Found target comment in container:');
            console.log(`   ID: ${id || 'N/A'}`);
            console.log(`   Classes: ${classes || 'N/A'}`);
            console.log(`   Index: ${i}`);
            
            return id || `container-${i}`;
          }
        }
      }
      
      return null;
    }, commentText);
    
    if (containerId) {
      logger.info(`✅ Found comment container with ID: ${containerId}`);
    } else {
      logger.warn(`⚠️ Could not find comment container`);
    }
    
    return containerId;
  } catch (error) {
    logger.error(`Error finding comment container: ${error}`);
    return null;
  }
}

/**
 * Extract replies with engagement data - using improved approach from test.ts
 */
async function extractLinkedInReplies(page: Page, containerId: string): Promise<LinkedInReplyData[]> {
  try {
    logger.info('💬 Extracting replies with engagement data...');
    
    const repliesData = await page.evaluate((commentContainerId) => {
      const replies: LinkedInReplyData[] = [];
      
      const commentContainer = document.getElementById(commentContainerId);
      if (!commentContainer) {
        console.log('Comment container not found for reply extraction');
        return replies;
      }
      
      // Find all reply articles using the same selector as test.ts
      const replyElements = commentContainer.querySelectorAll('article.comments-comment-entity--reply');
      
      console.log(`Found ${replyElements.length} reply elements`);
      
      for (let i = 0; i < replyElements.length; i++) {
        const reply = replyElements[i];
        
        try {
          // Extract reply text
          const replyTextElement = reply.querySelector('span.comments-comment-item__main-content');
          const replyText = replyTextElement ? replyTextElement.textContent?.trim() : '';
          
          if (!replyText) continue;
          
          // Extract reply likes - using the same approach as test.ts
          let replyLikes = 0;
          try {
            const replyLikesButton = reply.querySelector('button.comments-comment-social-bar__reactions-count--cr');
            if (replyLikesButton) {
              const replyLikesSpan = replyLikesButton.querySelector('span[aria-hidden="true"].v-align-middle');
              const replyLikesText = replyLikesSpan ? replyLikesSpan.textContent?.trim() : null;
              
              if (replyLikesText) {
                replyLikes = parseInt(replyLikesText, 10) || 0;
              } else {
                // Fallback: try aria-label
                const ariaLabel = replyLikesButton.getAttribute('aria-label') || '';
                const match = ariaLabel.match(/(\d+)\s*Reaction/i);
                if (match) {
                  replyLikes = parseInt(match[1], 10);
                }
              }
            }
          } catch (e) {
            // No likes button found, keep as 0
          }
          
          // Extract reply impressions
          let replyImpressions = 'N/A';
          try {
            const replyImpressionsSpan = reply.querySelector('span.comments-comment-social-bar__impressions-count');
            if (replyImpressionsSpan) {
              const replyImpressionsText = replyImpressionsSpan.textContent?.trim();
              if (replyImpressionsText) {
                replyImpressions = replyImpressionsText;
              }
            }
          } catch (e) {
            // No impressions found
          }
          
          // Extract author name
          let replyAuthor = 'N/A';
          try {
            const authorElement = reply.querySelector('.comments-comment-meta__description-title');
            if (authorElement) {
              const authorText = authorElement.textContent?.trim();
              if (authorText) {
                replyAuthor = authorText;
              }
            }
          } catch (e) {
            // Author not found
          }
          
          // Extract timestamp
          let replyTimestamp = 'N/A';
          try {
            const timeElement = reply.querySelector('time.comments-comment-meta__data');
            if (timeElement) {
              const timeText = timeElement.textContent?.trim();
              if (timeText) {
                replyTimestamp = timeText;
              }
            }
          } catch (e) {
            // Timestamp not found
          }
          
          replies.push({
            username: replyAuthor,
            text: replyText,
            likes: replyLikes,
            impressions: replyImpressions,
            timestamp: replyTimestamp
          });
          
          console.log(`Extracted reply ${i + 1}: ${replyAuthor} - ${replyLikes} likes`);
          
        } catch (e) {
          console.log(`Error extracting reply ${i + 1}: ${e}`);
        }
      }
      
      console.log(`Total replies extracted: ${replies.length}`);
      return replies;
    }, containerId);
    
    logger.info(`✅ Extracted ${repliesData.length} replies from LinkedIn comment`);
    
    if (repliesData.length > 0) {
      logger.info('📋 Reply details:');
      repliesData.forEach((reply, idx) => {
        logger.info(`   Reply ${idx + 1}: ${reply.username} - ${reply.likes} likes`);
      });
    }
    
    return repliesData;
    
  } catch (error) {
    logger.error(`Error extracting LinkedIn replies: ${error}`);
    return [];
  }
}

/**
 * Extract metrics using the improved approach from test.ts
 */
async function extractLinkedInMetrics(page: Page, commentText: string): Promise<{
  likes: number;
  impressions: number;
  repliesCount: number;
}> {
  try {
    const containerId = await findCommentContainer(page, commentText);
    
    if (!containerId) {
      logger.warn('Comment container not found, using fallback method');
      return { likes: 0, impressions: 0, repliesCount: 0 };
    }
    
    logger.info('\n📊 Extracting engagement metrics...');
    logger.info('='.repeat(60));
    
    const metrics = await page.evaluate((commentContainerId) => {
      let likes = 0;
      let impressions = 0;
      let repliesCount = 0;
      
      const commentContainer = document.getElementById(commentContainerId);
      if (!commentContainer) {
        console.log('Comment container not found');
        return { likes, impressions, repliesCount };
      }
      
      console.log(`Processing comment container: ${commentContainerId}`);
      
      // Extract likes - using the improved approach from test.ts
      try {
        // Look for the reactions count button with the specific class
        const likesCountButton = commentContainer.querySelector('button.comments-comment-social-bar__reactions-count--cr');
        
        if (likesCountButton) {
          // Try to get the count from the span
          const likesSpan = likesCountButton.querySelector('span[aria-hidden="true"].v-align-middle');
          const likesText = likesSpan ? likesSpan.textContent?.trim() : null;
          
          if (likesText) {
            likes = parseInt(likesText, 10) || 0;
            console.log(`👍 Likes: ${likes} (from span)`);
          } else {
            // Fallback: try aria-label
            const ariaLabel = likesCountButton.getAttribute('aria-label');
            if (ariaLabel) {
              const match = ariaLabel.match(/(\d+)\s*Reaction/i);
              if (match) {
                likes = parseInt(match[1], 10);
                console.log(`👍 Likes: ${likes} (from aria-label)`);
              }
            }
          }
        } else {
          // No likes button found, means 0 likes
          likes = 0;
          console.log(`👍 Likes: ${likes} (no reactions button found)`);
        }
      } catch (e) {
        likes = 0;
        console.log(`⚠️ Error extracting likes: ${e}`);
      }
      
      // Extract impressions
      try {
        const impressionsSpan = commentContainer.querySelector('span.comments-comment-social-bar__impressions-count');
        if (impressionsSpan) {
          const impressionsText = impressionsSpan.textContent?.trim();
          if (impressionsText) {
            const match = impressionsText.match(/(\d+)/);
            if (match) {
              impressions = parseInt(match[1], 10);
              console.log(`👁️ Impressions: ${impressions}`);
            }
          }
        }
      } catch (e) {
        console.log(`⚠️ Error extracting impressions: ${e}`);
      }
      
      // Extract replies count - count actual reply elements
      try {
        const replyElements = commentContainer.querySelectorAll('article.comments-comment-entity--reply');
        repliesCount = replyElements.length;
        console.log(`💬 Replies Count: ${repliesCount}`);
      } catch (e) {
        console.log(`⚠️ Error extracting replies count: ${e}`);
      }
      
      console.log(`\n📊 FINAL METRICS - Likes: ${likes}, Impressions: ${impressions}, Replies: ${repliesCount}\n`);
      return { likes, impressions, repliesCount };
    }, containerId);
    
    logger.info(`✅ Extracted metrics - Likes: ${metrics.likes}, Impressions: ${metrics.impressions}, Replies: ${metrics.repliesCount}`);
    logger.info('='.repeat(60));
    
    return metrics;
    
  } catch (error) {
    logger.error(`Error extracting LinkedIn metrics: ${error}`);
    return { likes: 0, impressions: 0, repliesCount: 0 };
  }
}

async function loadAllLinkedInComments(page: Page): Promise<void> {
  try {
    await page.evaluate(async () => {
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      
      // Click "Show more comments" buttons
      for (let i = 0; i < 5; i++) {
        const moreButtons = document.querySelectorAll(
          'button.comments-comments-list__load-more-comments-button, ' +
          'button[aria-label*="more comments"]'
        );
        
        for (const btn of moreButtons) {
          try {
            (btn as HTMLElement).scrollIntoView({ block: 'center' });
            await sleep(500);
            (btn as HTMLElement).click();
            await sleep(2000);
          } catch (e) {
            // Ignore
          }
        }
        
        // Scroll to bottom
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(2000);
      }
    });
    
    logger.info('✅ Loaded all LinkedIn comments');
  } catch (error) {
    logger.error(`Error loading LinkedIn comments: ${error}`);
  }
}

export async function processLinkedInAnalysisQueue(
  username: string,  
  minPort: number = 6000, 
  maxPort: number = 7000
): Promise<void> {
  const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
  
  console.log(`Démarrage de la session pour ${username} sur le port ${port}`);
  
  let proxyServer: Server | null = null;
  let browser: Browser | null = null;
  
  try {
    // Démarrer le serveur proxy sur le port généré
    proxyServer = new Server({ port });
    
    // Attendre que le proxy soit prêt
    await new Promise<void>((resolve, reject) => {
      proxyServer!.listen(() => {
        console.log(`Proxy démarré sur le port ${port}`);
        resolve();
      });
      
      proxyServer!.on('error', (err: Error) => {
        reject(new Error(`Échec du démarrage du proxy sur le port ${port}: ${err.message}`));
      });
    });
    
    const proxyUrl = `http://localhost:${port}`;
    
    // Lancer le navigateur avec la configuration du proxy
    browser = await puppeteer.launch({
      headless: true,
      args: [
        `--proxy-server=${proxyUrl}`,
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
    
    const page = await browser.newPage();
    
    // Retry cookie retrieval every 3 minutes if not found
    let cookiesData;
    let cookies;
    let cookieAttempts = 0;
    const maxCookieAttempts = 10; // Try for 30 minutes max before giving up
    
    while (cookieAttempts < maxCookieAttempts) {
      cookieAttempts++;
      logger.info(`Attempting to retrieve cookies for ${username} (attempt ${cookieAttempts}/${maxCookieAttempts})...`);
      
      try {
        cookiesData = await getLinkedInCookiesByUsername(username);
        
        if (cookiesData && cookiesData.cookies && cookiesData.cookies.length > 0) {
          cookies = cookiesData.cookies;
          logger.info(`✅ Successfully retrieved ${cookies.length} cookies for ${username}`);
          break;
        } else {
          logger.warn(`⚠️ No cookies found for ${username} on attempt ${cookieAttempts}`);
          
          if (cookieAttempts < maxCookieAttempts) {
            logger.info(`Waiting 3 minutes before retry...`);
            await delay(3 * 60 * 1000); // Wait 3 minutes
          }
        }
      } catch (cookieError) {
        logger.error(`Error retrieving cookies on attempt ${cookieAttempts}: ${cookieError}`);
        
        if (cookieAttempts < maxCookieAttempts) {
          logger.info(`Waiting 3 minutes before retry...`);
          await delay(3 * 60 * 1000); // Wait 3 minutes
        }
      }
    }
    
    if (!cookies || cookies.length === 0) {
      throw new Error(`Could not retrieve LinkedIn cookies for ${username} after ${maxCookieAttempts} attempts`);
    }
    
    logger.info(`Started proxy server for ${username} on port ${port}`);

    try {
      await page.goto("https://www.linkedin.com", { 
        waitUntil: "domcontentloaded",
        timeout: 120000
      });
    } catch (navigationError) {
      logger.error(`Navigation failed: ${navigationError}`);
      throw new Error(`Failed to navigate to LinkedIn: ${navigationError}`);
    }
    
    await delay(3000);
    
    const currentUrl = page.url();
    logger.info(`Current URL after navigation: ${currentUrl}`);
    
    if (currentUrl.includes('chrome-error://') || currentUrl.includes('data:')) {
      throw new Error(`Failed to reach LinkedIn: ${currentUrl}`);
    }
    
    logger.info(`Applying ${cookies.length} cookies for ${username}...`);
    
    try {
      const validCookies = cookies.filter(cookie => {
        return cookie.domain && (
          cookie.domain.includes('linkedin.com') || 
          cookie.domain.includes('.linkedin.com')
        );
      });
      
      logger.info(`Filtered to ${validCookies.length} valid LinkedIn cookies`);
      
      if (validCookies.length === 0) {
        throw new Error('No valid LinkedIn cookies found');
      }
      
      await page.setCookie(...validCookies);
      logger.info(`✅ Cookies applied successfully for ${username}`);
    } catch (cookieError) {
      logger.error(`Failed to set cookies: ${cookieError}`);
      throw new Error(`Cookie application failed: ${cookieError}`);
    }
    
    logger.info(`Reloading page to apply cookies...`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await delay(5000);
    
    logger.info(`Vérification de la connexion pour ${username}...`);
    
    const loginChecks = [
        { selector: '.global-nav__me', name: 'Me nav' },
        { selector: '.feed-identity-module', name: 'Feed identity' },
        { selector: '[data-control-name="identity.profile_picture"]', name: 'Profile picture' },
        { selector: '.global-nav__primary-link--active', name: 'Active nav link' },
        { selector: '.global-nav__me-photo', name: 'Me photo' },
        { selector: '.global-nav__nav', name: 'Global nav' }
      ];
    
    let isLoggedIn = false;
    let detectedElement = '';
    
    for (const check of loginChecks) {
      try {
        logger.info(`Checking for login indicator: ${check.name} (${check.selector})`);
        await page.waitForSelector(check.selector, { timeout: 8000 });
        isLoggedIn = true;
        detectedElement = check.name;
        logger.info(`✅ Logged into LinkedIn as ${username} (detected: ${check.name})`);
        break;
      } catch (e) {
        logger.info(` Login check failed for: ${check.name}`);
        continue;
      }
    }
    
    if (!isLoggedIn) {
      logger.info('Checking page content for login indicators...');
      try {
        const bodyText = await page.evaluate(() => document.body.innerText);
        const title = await page.title();
        
        logger.info(`Page title: ${title}`);
        
        if (bodyText.includes('Feed') || bodyText.includes('Home') || title.includes('Feed')) {
          isLoggedIn = true;
          detectedElement = 'Page content analysis';
          logger.info(`✅ Login detected via content analysis for ${username}`);
        }
      } catch (e) {
        logger.error(`Content analysis failed: ${e}`);
      }
    }
    
    if (!isLoggedIn) {
      const currentUrl = page.url();
      const title = await page.title();
      logger.error(`❌ Échec de la connexion pour ${username}`);
      logger.error(`URL actuelle: ${currentUrl}`);
      logger.error(`Titre de la page: ${title}`);
      
      throw new Error(`Failed to log in as ${username}. Cookies may be invalid or expired.`);
    }

    const commentsCollection = getCommentsCollection();
    
    logger.info('='.repeat(60));
    logger.info('📊 LINKEDIN COMMENT ANALYSIS QUEUE STARTED');
    logger.info('='.repeat(60));
    logger.info(`👤 Username: ${username}`);
    logger.info(`🔄 Analysis Interval: Every 12 hours`);
    logger.info(`⏰ Queue Check Interval: Every 2 hours (if no comments)`);
    logger.info(`🔄 Cookie Retry Interval: Every 3 minutes (if not found)`);
    logger.info('='.repeat(60));
    
    // Main processing loop
    while (true) {
      // Check for comments that need analysis (older than 12 hours or never analyzed)
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      
      const comment = await commentsCollection.findOne(
        { 
          username, 
          status: 'posted',
          postId: { $exists: true },
          $or: [
            { lastUpdated: { $exists: false } },
            { lastUpdated: { $lt: twelveHoursAgo } }
          ]
        },
        { sort: { lastUpdated: 1 } }
      );

      if (!comment) {
        const nextCheckTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
        logger.info("📭 No LinkedIn comments need re-analysis at this time.");
        logger.info(`📅 Next check scheduled for: ${nextCheckTime.toISOString()}`);
        logger.info("⏳ Waiting 2 hours...");
        await delay(2 * 60 * 60 * 1000); // Wait 2 hours
        continue;
      }

      logger.info(`Processing LinkedIn comment ${comment._id} on post ${comment.postId}`);
      
      // Log when this comment was last updated
      if (comment.lastUpdated) {
        const timeSinceUpdate = Date.now() - comment.lastUpdated.getTime();
        const hoursSinceUpdate = (timeSinceUpdate / (1000 * 60 * 60)).toFixed(2);
        logger.info(`Comment was last updated ${hoursSinceUpdate} hours ago`);
      } else {
        logger.info(`Comment has never been analyzed before`);
      }
      
      let success = false;
      let errorMessage = "";

      for (let attempt = 1; attempt <= 3; attempt++) {
        logger.info(`LinkedIn analysis attempt ${attempt} for comment ${comment._id}`);
        
        try {
          logger.info(`Navigating to: ${comment.postId}`);
          await page.goto(comment.postId, { waitUntil: 'networkidle2', timeout: 60000 });
          await delay(3000);
          
          await loadAllLinkedInComments(page);
          await delay(2000);
          
          const commentExists = await page.evaluate((text) => {
            const elements = Array.from(document.querySelectorAll('.comments-comment-item, [data-id*="comment"]'));
            return elements.some(el => (el.textContent || '').includes(text));
          }, comment.comment);
          
          if (!commentExists) {
            throw new Error(`LinkedIn comment "${comment.comment.substring(0, 50)}..." not found on page`);
          }
          
          logger.info(`✅ Found LinkedIn comment on page`);
          
          // Extract all metrics using improved functions
          const metrics = await extractLinkedInMetrics(page, comment.comment);
          
          // Find container ID for replies extraction
          const containerId = await findCommentContainer(page, comment.comment);
          
          // Extract detailed replies data
          const repliesData = containerId 
            ? await extractLinkedInReplies(page, containerId)
            : [];
          
          logger.info(`✅ LinkedIn analysis complete: ${metrics.likes} likes, ${metrics.impressions} impressions, ${repliesData.length} replies`);
          
          // Store analysis results with updated timestamp
          await commentsCollection.updateOne(
            { _id: new ObjectId(comment._id) },
            { 
              $set: {
                likes: metrics.likes,
                impressions: metrics.impressions,
                repliesCount: metrics.repliesCount,
                repliesData: repliesData,
                status: 'posted',
                analyzedAt: new Date(),
                lastUpdated: new Date()
              }
            }
          );
          
          logger.info(`✅ Successfully analyzed LinkedIn comment ${comment._id}`);
          
          // Log when next analysis will be due
          const nextAnalysisTime = new Date(Date.now() + 12 * 60 * 60 * 1000);
          logger.info(`📅 Next analysis due at: ${nextAnalysisTime.toISOString()}`);
          
          success = true;
          break;
          
        } catch (error) {
          logger.error(`LinkedIn attempt ${attempt} failed:`, error);
          
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
      
      if (!success) {
        await commentsCollection.updateOne(
          { _id: new ObjectId(comment._id) },
          { 
            $set: {
              lastUpdated: new Date(),
              lastError: errorMessage
            }
          }
        );
        logger.error(`❌ Failed to analyze LinkedIn comment ${comment._id} after 3 attempts: ${errorMessage}`);
      }
      
      // Wait before processing next comment
      const waitDelay = getRandomDelay(30000, 60000);
      logger.info(`⏳ Waiting ${(waitDelay / 1000).toFixed(0)} seconds before next LinkedIn comment...`);
      await delay(waitDelay);
      
      // Log queue status
      const pendingCount = await commentsCollection.countDocuments({
        username,
        status: 'posted',
        postId: { $exists: true },
        $or: [
          { lastUpdated: { $exists: false } },
          { lastUpdated: { $lt: new Date(Date.now() - 12 * 60 * 60 * 1000) } }
        ]
      });
      logger.info(`📊 Pending comments in queue for ${username}: ${pendingCount}`);
    }
    
  } catch (error) {
    logger.error('Error during LinkedIn analysis queue processing:', error);
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