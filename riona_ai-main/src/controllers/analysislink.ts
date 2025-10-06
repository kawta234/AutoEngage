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
}

// Simple delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Random delay generator
const getRandomDelay = (min = 30000, max = 100000): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Find the comment container element by searching for comment text
 */
async function findCommentContainer(page: Page, commentText: string): Promise<string | null> {
  try {
    const containerId = await page.evaluate((text) => {
      // Search all elements with ember IDs or comment-related classes
      const allElements = document.querySelectorAll('[id^="ember"], .comments-comment-item, [data-id*="comment"]');
      
      for (const element of allElements) {
        const elementText = element.textContent || '';
        if (elementText.includes(text)) {
          // Return the ID if it has one, or find the closest parent with an ID
          if (element.id) return element.id;
          
          let parent = element.parentElement;
          let depth = 0;
          while (parent && depth < 10) {
            if (parent.id && parent.id.startsWith('ember')) {
              return parent.id;
            }
            parent = parent.parentElement;
            depth++;
          }
        }
      }
      return null;
    }, commentText);
    
    if (containerId) {
      logger.info(`Found comment container with ID: ${containerId}`);
    } else {
      logger.warn(`Could not find comment container with ember ID`);
    }
    
    return containerId;
  } catch (error) {
    logger.error(`Error finding comment container: ${error}`);
    return null;
  }
}

async function extractLinkedInReplies(page: Page, commentText: string): Promise<LinkedInReplyData[]> {
    try {
      const repliesData = await page.evaluate((searchText) => {
        const replies: { username: string; text: string; likes: number }[] = [];
        
        // Find the main comment container
        const commentElements = Array.from(document.querySelectorAll('.comments-comment-item, [data-id*="comment"]'));
        let mainCommentContainer: Element | null = null;
        
        for (const element of commentElements) {
          const textContent = element.textContent || '';
          if (textContent.includes(searchText)) {
            mainCommentContainer = element;
            break;
          }
        }
        
        if (!mainCommentContainer) {
          console.log('Main comment container not found for reply extraction');
          return replies;
        }
        
        // Find all reply items within this comment
        const replyElements = mainCommentContainer.querySelectorAll(
          '.comments-comment-item--reply, ' +
          '.comments-reply-item, ' +
          '[data-id*="reply"]'
        );
        
        console.log(`Found ${replyElements.length} reply elements`);
        
        for (const replyElement of replyElements) {
          try {
            // Extract username
            let username = '';
            const nameElement = replyElement.querySelector(
              '.comments-post-meta__name-text, ' +
              '.comments-post-meta__profile-link, ' +
              'a[data-control-name*="actor"], ' +
              '.feed-shared-actor__name'
            );
            
            if (nameElement) {
              username = (nameElement.textContent || '').trim();
            }
            
            // Extract reply text
            let text = '';
            const textElement = replyElement.querySelector(
              '.comments-comment-item__main-content, ' +
              '.comments-comment-item-content-body, ' +
              '.feed-shared-text, ' +
              '[data-test-id="comment-text"]'
            );
            
            if (textElement) {
              text = (textElement.textContent || '').trim();
            }
            
            // Extract likes
            let likes = 0;
            const likeButton = replyElement.querySelector(
              'button[aria-label*="reaction"], ' +
              'button[aria-label*="like"]'
            );
            
            if (likeButton) {
              const ariaLabel = likeButton.getAttribute('aria-label') || '';
              const match = ariaLabel.match(/(\d+)\s*(reaction|like)/i);
              if (match) {
                likes = parseInt(match[1], 10);
              }
            }
            
            // Only add if we have at least username and text
            if (username && text) {
              replies.push({ username, text, likes });
              console.log(`Extracted reply from ${username}: ${text.substring(0, 50)}... (${likes} likes)`);
            }
          } catch (error) {
            console.log(`Error extracting individual reply: ${error}`);
          }
        }
        
        console.log(`Total replies extracted: ${replies.length}`);
        return replies;
      }, commentText);
      
      logger.info(`Extracted ${repliesData.length} replies from LinkedIn comment`);
      return repliesData;
      
    } catch (error) {
      logger.error(`Error extracting LinkedIn replies: ${error}`);
      return [];
    }
  }
async function extractLinkedInMetrics(page: Page, commentText: string): Promise<{
    likes: number;
    impressions: number;
    repliesCount: number;
  }> {
    try {
      // First, find the comment container (the ember element that has the comment)
      const containerId = await findCommentContainer(page, commentText);
      
      if (!containerId) {
        logger.warn('Comment container not found, using fallback method');
        return { likes: 0, impressions: 0, repliesCount: 0 };
      }
      
      const metrics = await page.evaluate((commentContainerId, searchText) => {
        let likes = 0;
        let impressions = 0;
        let repliesCount = 0;
        
        // Get the comment container
        const commentContainer = document.getElementById(commentContainerId);
        if (!commentContainer) {
          console.log('Comment container not found');
          return { likes, impressions, repliesCount };
        }
        
        console.log(`Processing comment container: ${commentContainerId}`);
        
        // Verify this container has our comment text
        const containerText = commentContainer.textContent || '';
        if (!containerText.includes(searchText)) {
          console.log('WARNING: Container does not contain the comment text!');
          return { likes, impressions, repliesCount };
        }
        
        console.log('✓ Verified: Container has the comment text');
        
        // Helper function to safely extract number from text
        const extractNumber = (text: string): number => {
          const match = text.match(/(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        };
        
        // Method 1: Extract likes using the specific path
        // Path: div[2]/div[2]/div/div[1]
        try {
          const likesElement = commentContainer.querySelector('div:nth-child(2) > div:nth-child(2) > div:first-child > div:first-child');
          
          if (likesElement) {
            const likesText = likesElement.textContent?.trim() || '';
            console.log(`Likes element found. Text: "${likesText}"`);
            
            // Try to extract from aria-label first
            const ariaLabel = likesElement.getAttribute('aria-label') || '';
            if (ariaLabel) {
              console.log(`Likes aria-label: "${ariaLabel}"`);
              const match = ariaLabel.match(/(\d+)\s*(reaction|like)/i);
              if (match) {
                likes = parseInt(match[1], 10);
                console.log(`✓ Extracted likes from aria-label: ${likes}`);
              }
            }
            
            // If not found in aria-label, try text content
            if (likes === 0 && likesText) {
              likes = extractNumber(likesText);
              if (likes > 0) {
                console.log(`✓ Extracted likes from text: ${likes}`);
              }
            }
            
            // Try to find button with aria-label inside this element
            if (likes === 0) {
              const likeButton = likesElement.querySelector('button[aria-label*="reaction"], button[aria-label*="like"]');
              if (likeButton) {
                const buttonAria = likeButton.getAttribute('aria-label') || '';
                console.log(`Like button aria-label: "${buttonAria}"`);
                const match = buttonAria.match(/(\d+)/);
                if (match) {
                  likes = parseInt(match[1], 10);
                  console.log(`✓ Extracted likes from button: ${likes}`);
                }
              }
            }
          } else {
            console.log('Likes element not found at specified path');
          }
        } catch (error) {
          console.log(`Error extracting likes: ${error}`);
        }
        
        // Method 2: Extract replies count using the specific path
        // Path: div[2]/div[2]/div/div[3]
        try {
          const repliesElement = commentContainer.querySelector('div:nth-child(2) > div:nth-child(2) > div:first-child > div:nth-child(3)');
          
          if (repliesElement) {
            const repliesText = repliesElement.textContent?.trim() || '';
            console.log(`Replies element found. Text: "${repliesText}"`);
            
            // Look for pattern like "5 replies" or "1 reply"
            const match = repliesText.match(/(\d+)\s*repl(?:y|ies)/i);
            if (match) {
              repliesCount = parseInt(match[1], 10);
              console.log(`✓ Extracted replies count: ${repliesCount}`);
            } else {
              // Try to extract just the number
              repliesCount = extractNumber(repliesText);
              if (repliesCount > 0) {
                console.log(`✓ Extracted replies count (number only): ${repliesCount}`);
              }
            }
          } else {
            console.log('Replies element not found at specified path');
          }
        } catch (error) {
          console.log(`Error extracting replies: ${error}`);
        }
        
        // Method 3: Extract impressions using the specific path
        // Path: div[2]/div[2]/div/div[5]
        try {
          const impressionsElement = commentContainer.querySelector('div:nth-child(2) > div:nth-child(2) > div:first-child > div:nth-child(5)');
          
          if (impressionsElement) {
            const impressionsText = impressionsElement.textContent?.trim() || '';
            console.log(`Impressions element found. Text: "${impressionsText}"`);
            
            // Look for pattern like "125 impressions"
            const match = impressionsText.match(/(\d+)\s*impression/i);
            if (match) {
              impressions = parseInt(match[1], 10);
              console.log(`✓ Extracted impressions: ${impressions}`);
            } else {
              // Try to extract just the number
              impressions = extractNumber(impressionsText);
              if (impressions > 0) {
                console.log(`✓ Extracted impressions (number only): ${impressions}`);
              }
            }
          } else {
            console.log('Impressions element not found at specified path');
          }
        } catch (error) {
          console.log(`Error extracting impressions: ${error}`);
        }
        
        // Fallback methods if primary extraction failed
        if (likes === 0 || repliesCount === 0 || impressions === 0) {
          console.log('Attempting fallback extraction methods...');
          
          // Fallback for likes: search in entire container
          if (likes === 0) {
            const allButtons = commentContainer.querySelectorAll('button[aria-label*="reaction"], button[aria-label*="like"]');
            for (const btn of allButtons) {
              const ariaLabel = btn.getAttribute('aria-label') || '';
              const match = ariaLabel.match(/(\d+)\s*(reaction|like)/i);
              if (match) {
                likes = parseInt(match[1], 10);
                console.log(`✓ Fallback: Found likes ${likes}`);
                break;
              }
            }
          }
          
          // Fallback for replies: search in text
          if (repliesCount === 0) {
            const match = containerText.match(/(\d+)\s*repl(?:y|ies)/i);
            if (match) {
              repliesCount = parseInt(match[1], 10);
              console.log(`✓ Fallback: Found replies ${repliesCount}`);
            }
          }
          
          // Fallback for impressions: search in text
          if (impressions === 0) {
            const match = containerText.match(/(\d+)\s*impression/i);
            if (match) {
              impressions = parseInt(match[1], 10);
              console.log(`✓ Fallback: Found impressions ${impressions}`);
            }
          }
        }
        
        console.log(`Final metrics - Likes: ${likes}, Impressions: ${impressions}, Replies: ${repliesCount}`);
        return { likes, impressions, repliesCount };
      }, containerId, commentText);
      
      logger.info(`Extracted metrics - Likes: ${metrics.likes}, Impressions: ${metrics.impressions}, Replies: ${metrics.repliesCount}`);
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
    
    logger.info('Loaded all LinkedIn comments');
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
      const cookiesData = await getLinkedInCookiesByUsername(username);
      if (!cookiesData || !cookiesData.cookies) {
        throw new Error("Could not retrieve LinkedIn cookies");
      }
      
      const cookies = cookiesData.cookies;
      
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
      
      // Wait for page to load
      await delay(3000);
      
      // Check if we actually reached LinkedIn
      const currentUrl = page.url();
      logger.info(`Current URL after navigation: ${currentUrl}`);
      
      if (currentUrl.includes('chrome-error://') || currentUrl.includes('data:')) {
        throw new Error(`Failed to reach LinkedIn: ${currentUrl}`);
      }
      
      // Apply cookies after successful navigation
      logger.info(`Applying ${cookies.length} cookies for ${username}...`);
      
      try {
        // Filter cookies to only include valid ones for LinkedIn domain
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
      
      // Reload the page to use the cookies
      logger.info(`Reloading page to apply cookies...`);
      await page.reload({ waitUntil: "domcontentloaded" });
      
      // Wait a bit for the page to settle
      await delay(5000);
      
      // Check authentication status with more comprehensive checks
      logger.info(`Vérification de la connexion pour ${username}...`);
      
      // Check for multiple possible indicators of successful login
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
          logger.info(`❌ Login check failed for: ${check.name}`);
          continue;
        }
      }
      
      // Additional check: look for specific text content that indicates login
      if (!isLoggedIn) {
        logger.info('Checking page content for login indicators...');
        try {
          const bodyText = await page.evaluate(() => document.body.innerText);
          const title = await page.title();
          
          logger.info(`Page title: ${title}`);
          
          // Check for signs of being logged in
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
        // Enhanced debug info
        const currentUrl = page.url();
        const title = await page.title();
        logger.error(`❌ Échec de la connexion pour ${username}`);
        logger.error(`URL actuelle: ${currentUrl}`);
        logger.error(`Titre de la page: ${title}`);
        
        // Check for specific error indicators
        try {
          const bodyText = await page.evaluate(() => document.body.innerText);
          if (bodyText.includes('Sign in') || bodyText.includes('Join LinkedIn')) {
            logger.error('🔍 Détecté: Page de connexion - cookies invalides ou expirés');
          }
          
          // Check for CAPTCHA or security challenges
          if (bodyText.includes('security challenge') || bodyText.includes('Please complete')) {
            logger.error('🔍 Détecté: Défi de sécurité ou CAPTCHA');
          }
          
          // Log available elements for debugging
          const availableElements = await page.evaluate(() => {
            const elements = document.querySelectorAll('*[class*="nav"], *[data-test-id], *[data-control-name]');
            return Array.from(elements).slice(0, 10).map(el => ({
              tag: el.tagName,
              class: el.className,
              id: el.id,
              'data-test-id': el.getAttribute('data-test-id'),
              'data-control-name': el.getAttribute('data-control-name')
            }));
          });
          
          logger.info('Available elements for debugging:', JSON.stringify(availableElements, null, 2));
          
        } catch (e) {
          logger.error(`Debug info extraction failed: ${e}`);
        }
        
        throw new Error(`Failed to log in as ${username}. Cookies may be invalid or expired.`);
      }

    const commentsCollection = getCommentsCollection();
    
    // Main processing loop
    while (true) {
      // Find a comment that needs analysis (older than 12 hours)
      const twelveHoursAgo = new Date(Date.now() - 20 * 60 * 1000);
      
      const comment = await commentsCollection.findOne(
        { 
          username, 
          status: 'posted', // or 'posted' depending on what status means analysis is needed
          postId: { $exists: true }, // Changed from postUrl
          $or: [
            { lastUpdated: { $exists: false } },
            { lastUpdated: { $lt: twelveHoursAgo } }
          ]
        },
        { sort: { lastUpdated: 1 } }
      );

      if (!comment) {
        logger.info("No LinkedIn comments need re-analysis. Waiting 2 hours...");
        await delay(60 * 1000);
        continue;
      }

      logger.info(`Processing LinkedIn comment ${comment._id} on post ${comment.postId}`);
      
      let success = false;
      let errorMessage = "";

      // Try analysis up to 3 times
      for (let attempt = 1; attempt <= 3; attempt++) {
        logger.info(`LinkedIn analysis attempt ${attempt} for comment ${comment._id}`);
        
        try {
          // Navigate to post (using complete URL from database)
          logger.info(`Navigating to: ${comment.postId}`);
          await page.goto(comment.postId, { waitUntil: 'networkidle2', timeout: 60000 });
          await delay(3000);
          
          // Load all comments
          await loadAllLinkedInComments(page);
          await delay(2000);
          
          // Check if comment exists on page
          const commentExists = await page.evaluate((text) => {
            const elements = Array.from(document.querySelectorAll('.comments-comment-item, [data-id*="comment"]'));
            return elements.some(el => (el.textContent || '').includes(text));
          }, comment.comment);
          
          if (!commentExists) {
            throw new Error(`LinkedIn comment "${comment.comment.substring(0, 50)}..." not found on page`);
          }
          
          logger.info(`Found LinkedIn comment on page`);
          
          // Expand all replies for this comment
          await extractLinkedInReplies(page, comment.comment);
          await delay(2000);
          
          // Extract all metrics (likes, impressions, replies count)
          const metrics = await extractLinkedInMetrics(page, comment.comment);
          
          // Extract detailed replies data
          const repliesData = await extractLinkedInReplies(page, comment.comment);
          
          logger.info(`LinkedIn analysis complete: ${metrics.likes} likes, ${metrics.impressions} impressions, ${repliesData.length} replies`);
          
          // Store analysis results
          await commentsCollection.updateOne(
            { _id: new ObjectId(comment._id) },
            { 
              $set: {
                likes: metrics.likes,
                impressions: metrics.impressions,
                repliesCount: metrics.repliesCount,
                repliesData: repliesData,
                lastUpdated: new Date()
              }
            }
          );
          
          logger.info(`Successfully analyzed LinkedIn comment ${comment._id}`);
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
      
      // If all 3 attempts failed, still update lastUpdated
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
        logger.error(`Failed to analyze LinkedIn comment ${comment._id} after 3 attempts: ${errorMessage}`);
      }
      
      // Wait before processing next comment
      const waitDelay = getRandomDelay(30000, 60000);
      logger.info(`Waiting ${waitDelay}ms before next LinkedIn comment`);
      await delay(waitDelay);
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