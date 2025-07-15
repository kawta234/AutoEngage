import { Browser, DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import { Server } from "proxy-chain";
import logger from "../../config/logger";
import { interactWithOllama } from "../../ollama_interact";
import { checkTargetUsernameMatch, getLinkedInCookiesByUsername } from "./agentlinkedin";


puppeteer.use(StealthPlugin());
puppeteer.use(
  AdblockerPlugin({
    interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
  })
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function runLinkedIn(username: string, minPort: number = 8000, maxPort: number = 9000): Promise<void> {
  // Générer un
  // aléatoire entre minPort et maxPort
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
    
    // Get Instagram cookies for the provided username
    const cookiesData = await getLinkedInCookiesByUsername(username);
    if (!cookiesData || !cookiesData.cookies) {
      throw new Error("Could not retrieve Instagram cookies");
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

    // Try to navigate to feed to confirm access
    logger.info(`Navigating to LinkedIn feed for ${username}...`);
   
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await delay(5000);

    logger.info(`🚀 Starting main automation loop for ${username}`);
    const targetCount = 50;
    const processedLinks = new Set<string>();

    while (processedLinks.size < targetCount) {
      try {
        // FIXED: Don't navigate again, just extract from current page
        const currentUrl = page.url();
        if (!currentUrl.includes('/feed/')) {
          logger.info('Not on feed page, navigating to feed...');
          await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 120000 });
          await delay(5000);
        }

        // FIXED: call extractPostLinks with page object and processed links
        const freshLinks = await extractPostLinks(page, Array.from(processedLinks), processedLinks.size);
        if (freshLinks.length === 0) {
          logger.info('No new posts, scrolling...');
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          await delay(8000);
          continue;
        }

        for (const postLink of freshLinks) {
          if (processedLinks.size >= targetCount) break;
          logger.info(`Processing post: ${postLink}`);
          await analyzePostFromLink(page, postLink, username);
         
        await delay(2000); // Délai entre les deux générations
        await analyzePostFromLink(page, postLink, username);
          processedLinks.add(postLink);
          logger.info(`Processed ${processedLinks.size}/${targetCount}`);
          await delay(15000);
        }

        // Scroll to load more
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await delay(8000);
      } catch (loopError) {
        logger.error(`Error in loop: ${loopError}`);
        await delay(120000);
      }
    }

  } catch (error) {
    logger.error(`LinkedIn automation failed for ${username}: ${(error as Error).message}`);
    throw error;
  } finally {
    if (browser) {
      logger.info(`Closing browser for ${username}`);
      await browser.close();
    }
  }
}


// ACTION 1: Extract post links from LinkedIn feed (FIXED)
async function extractPostLinks(page: any, processedPosts: string[] = [], totalProcessed: number = 0): Promise<string[]> {
  /**
   * Get 5 fresh post links that haven't been processed yet
   * FIXED: No longer navigates to feed, works with current page
   */
  console.log(`🔍 Getting 5 fresh post links... (Total processed so far: ${totalProcessed})`);
  
  // FIXED: Check current URL and only navigate if needed
  const currentUrl = page.url();
  if (!currentUrl.includes('/feed/')) {
    logger.info('Not on feed page, navigating to feed...');
    try {
      await page.goto("https://www.linkedin.com/feed/", { 
        waitUntil: 'domcontentloaded',
        timeout: 120000  // Increased timeout
      });
      await delay(5000);
    } catch (navError) {
      logger.error(`Navigation to feed failed: ${navError}`);
      return [];
    }
  }
  
  const freshPostLinks: string[] = [];
  let attempts = 0;
  const maxAttempts = 10;
  let scrollPosition = 0;
  
  const isValidLinkedInPost = (url: string): boolean => {
      if (typeof url !== 'string') return false;
      return /linkedin\.com\/posts\/.*activity-\d+/.test(url);
  };
  
  const extractUrlsFromText = (text: string): string[] => {
      const pattern = /https:\/\/[^"'<>\s]*linkedin\.com\/posts\/[^\s"'<>]*/g;
      const matches = text.match(pattern) || [];
      return matches
          .map(url => url.replace(/[",\'<>]/g, ''))
          .filter(url => isValidLinkedInPost(url));
  };
  
  const findUrlsInJson = (data: any): string[] => {
      const urls: string[] = [];
      
      const searchJson = (obj: any): void => {
          if (typeof obj === 'object' && obj !== null) {
              if (Array.isArray(obj)) {
                  obj.forEach(item => searchJson(item));
              } else {
                  Object.entries(obj).forEach(([key, value]) => {
                      if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
                          if (typeof value === 'string' && isValidLinkedInPost(value)) {
                              urls.push(value);
                          }
                      }
                      searchJson(value);
                  });
              }
          } else if (typeof obj === 'string' && isValidLinkedInPost(obj)) {
              urls.push(obj);
          }
      };
      
      searchJson(data);
      return urls;
  };
  
  const extractAllPostLinks = async (): Promise<string[]> => {
      const postLinks: string[] = [];
      
      try {
          // Method 1: Extract from visible elements
          const selectors = [
              'a[href*="linkedin.com/posts/"]',
              'a[href*="/posts/"]',
              '[data-urn*="activity"] a',
              '.feed-shared-update-v2 a[href*="activity"]'
          ];
          
          for (const selector of selectors) {
              try {
                  const elements = await page.$$(selector);  // FIXED: Use $$ for multiple elements
                  for (const element of elements) {
                      const href = await element.evaluate((el: Element) => el.getAttribute('href'));
                      if (href && isValidLinkedInPost(href)) {
                          postLinks.push(href);
                      }
                  }
              } catch (error) {
                  continue;
              }
          }
          
          // Method 2: Extract from hidden code elements
          try {
              const codeElements = await page.$$('code[id^="bpr-guid"]');  // FIXED: Use $$ for multiple elements
              
              for (const codeElement of codeElements) {
                  try {
                      const content = await codeElement.evaluate((el: Element) => {
                          return el.innerHTML || el.textContent || '';
                      });
                      
                      if (!content) continue;
                      
                      const trimmedContent = content.trim();
                      // Try to parse as JSON
                      if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
                          try {
                              const postData = JSON.parse(trimmedContent);
                              const links = findUrlsInJson(postData);
                              postLinks.push(...links);
                          } catch (jsonError) {
                              // Extract URLs from text
                              const urls = extractUrlsFromText(content);
                              postLinks.push(...urls);
                          }
                      } else {
                          const urls = extractUrlsFromText(content);
                          postLinks.push(...urls);
                      }
                  } catch (error) {
                      continue;
                  }
              }
          } catch (error) {
              console.log(`❌ Error extracting from code elements: ${error}`);
          }
          
          // Remove duplicates while preserving order
          const uniqueLinks: string[] = [];
          for (const link of postLinks) {
              if (!uniqueLinks.includes(link) && isValidLinkedInPost(link)) {
                  uniqueLinks.push(link);
              }
          }
          
          return uniqueLinks;
          
      } catch (error) {
          console.log(`❌ Error extracting links: ${error}`);
          return [];
      }
  };
  
  // Main loop to collect fresh links
  while (freshPostLinks.length < 5 && attempts < maxAttempts) {
      attempts++;
      console.log(`📡 Attempt ${attempts} to collect fresh links...`);
      
      // Extract links from current page
      const currentLinks = await extractAllPostLinks();
      
      // Filter out already processed posts
      for (const link of currentLinks) {
          if (!processedPosts.includes(link) && !freshPostLinks.includes(link)) {
              freshPostLinks.push(link);
              console.log(`✅ Found fresh link: ${link}`);
              if (freshPostLinks.length >= 5) {
                  break;
              }
          }
      }
      
      console.log(`📊 Collected ${freshPostLinks.length} fresh links so far...`);
      
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Then modify the scrolling section in extractPostLinks function
if (freshPostLinks.length < 5 && attempts < maxAttempts) {
    scrollPosition += 800;
    console.log(`⬇️ Scrolling to position ${scrollPosition} to find more posts...`);
    
    await page.evaluate((position: number) => {
        window.scrollTo(0, position);
    }, scrollPosition);
    
    // Use the delay function instead of page.waitForTimeout
    const scrollDelay = Math.floor(Math.random() * 4000) + 4000; // 4-8 seconds
    await delay(scrollDelay);
    
    console.log(`Waited ${scrollDelay/1000} seconds after scrolling`);
}
  }
  
  // If no fresh posts found, try refreshing once
  if (freshPostLinks.length === 0) {
      console.log("⚠️ No fresh posts found. Refreshing feed...");
      try {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
          await delay(10000);
          
          // Try one more time after refresh
          const currentLinks = await extractAllPostLinks();
          
          for (const link of currentLinks) {
              if (!processedPosts.includes(link) && !freshPostLinks.includes(link)) {
                  freshPostLinks.push(link);
                  if (freshPostLinks.length >= 5) {
                      break;
                  }
              }
          }
      } catch (refreshError) {
          logger.error(`Failed to refresh feed: ${refreshError}`);
      }
  }
  
  return freshPostLinks.slice(0, 5); // Return exactly 5 links
}

// ACTION 2: Analyze individual post from link (FIXED)
async function analyzePostFromLink(page: any, postLink: string, connectedUsername: string) {
  try {
    logger.info(`Navigating to post: ${postLink}`);
    
    // Navigate to the specific post with increased timeout
    try {
      await page.goto(postLink, { 
        waitUntil: "domcontentloaded",
        timeout: 120000
      });
      await delay(5000);
    } catch (navError) {
      logger.error(`Navigation to post failed: ${navError}`);
      return;
    }
    
    // Wait for post content to load
    try {
      await page.waitForSelector('.feed-shared-update-v2, .feed-shared-text, .share-update-card', { timeout: 15000 });
    } catch (error) {
      logger.warn(`Post content not found for ${postLink}, trying alternative selectors...`);
    }
    
    // Extract author information
    let postAuthor = "";
    const authorSelectorsForSinglePost = [
      '.GYxRwjxcYYrdEgVEwOEFcsSzpSgkaduM span[aria-hidden="true"]',
  // Ajoutez des sélecteurs de fallback si nécessaire
  'span[dir="ltr"] span[aria-hidden="true"]',
  '.visually-hidden'  ];
    
    for (const selector of authorSelectorsForSinglePost) {
      try {
        const authorElement = await page.$(selector);
        if (authorElement) {
          postAuthor = await authorElement.evaluate((el: HTMLElement) => el.textContent?.trim() || "");
          if (postAuthor && postAuthor.length > 0) {
            logger.info(`Post author found: ${postAuthor}`);
            break;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!postAuthor || postAuthor.trim().length === 0) {
      logger.warn(`No author found for post ${postLink}. Skipping...`);
      return;
    }
    
    // Check if author is in target list
    const { matched, accountData } = await checkTargetUsernameMatch(postAuthor);
    
    if (!matched) {
      logger.info(`Post author "${postAuthor}" is not in our target list. Skipping...`);
      return;
    }
    
    logger.info(`Post author "${postAuthor}" is in our target list. Proceeding with content analysis...`);
    
    // Extract post content
    let postContent = "";
    const contentSelectorsForSinglePost = [
      '.break-words.tvm-parent-container span[dir="ltr"]'
    ];
    
    for (const selector of contentSelectorsForSinglePost) {
      try {
        const contentElement = await page.$(selector);
        if (contentElement) {
          postContent = await contentElement.evaluate((el: HTMLElement) => el.textContent?.trim() || "");
          if (postContent && postContent.length > 0) {
            logger.info(`Post content found with selector "${selector}"`);
            break;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!postContent || postContent.trim().length === 0) {
      logger.warn(`No content found for post ${postLink}. Skipping comment generation.`);
      return;
    }
    
    // Check for "See more" link and click it
    const seeMoreSelectors = [
      '.feed-shared-inline-show-more-text__see-more-less-toggle'
    ];
    
    for (const seeMoreSelector of seeMoreSelectors) {
      try {
        const seeMoreLink = await page.$(seeMoreSelector);
        if (seeMoreLink) {
          logger.info(`Expanding post content for ${postLink}...`);
          await seeMoreLink.click();
          await delay(3000);
          
          // Re-extract content after expansion
          for (const selector of contentSelectorsForSinglePost) {
            try {
              const contentElement = await page.$(selector);
              if (contentElement) {
                const expandedContent = await contentElement.evaluate((el: HTMLElement) => el.textContent?.trim() || "");
                if (expandedContent && expandedContent.length > postContent.length) {
                  postContent = expandedContent;
                  logger.info(`Expanded content extracted for ${postLink}`);
                  break;
                }
              }
            } catch (error) {
              continue;
            }
          }
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    logger.info(`Final post content (${postContent.length} characters): ${postContent.substring(0, 200)}...`);
    
    // Generate comment using Ollama
    const prompt = `Respond only with valid JSON. No introduction or explanation.

Read the LinkedIn post content provided below and create a professional, engaging comment that:

• Reflects on the key ideas in a genuine and professional tone
• Adds value to the conversation
• Is appropriate for LinkedIn's professional context
• Varies in structure and length (brief insights or thoughtful elaborations)
• May include a relevant question or professional observation
• Demonstrates industry knowledge or personal experience when relevant

Your response must be a valid JSON array with exactly one object:

[
  {
    "comment": "Your professional reply here",
    "viralRate": 85,
    "commentTokenCount": 24
  }
]

Requirements:
- "comment" must be between 50-200 characters, professional and relevant
- "viralRate" must be a number (0-100)
- "commentTokenCount" must accurately count tokens in comment
- Response must be ONLY a JSON array with no additional text
- Consider that this comment will be posted by: ${connectedUsername}
- Maintain professional LinkedIn etiquette

Original LinkedIn Post: "${postContent}"`;
    
    try {
      const result = await interactWithOllama(
        prompt,
        undefined,
        undefined,
        "llama3.1:latest",
        false,
        console.log,
        undefined,
        "json",
        postLink,
        postContent,
        undefined,
        postAuthor,
        connectedUsername
      );
      
      // Extract generated comment
      let extractedComment = "";
      try {
        const jsonResult = typeof result.response === "string" ? JSON.parse(result.response) : result;
        extractedComment = Array.isArray(jsonResult) ? jsonResult[0]?.comment : jsonResult?.comment;
      } catch (e) {
        logger.error("Unable to extract comment from Ollama response:", e);
        logger.error("Raw response:", result.response);
      }
      
      if (extractedComment) {
        logger.info(`✅ Comment generated for post ${postLink} by ${connectedUsername}: "${extractedComment}"`);
      } else {
        logger.warn(`❌ Failed to generate comment for post ${postLink}`);
      }
      
    } catch (ollamaError) {
      logger.error(`Ollama interaction failed: ${ollamaError}`);
    }
    
  } catch (error) {
    logger.error(`Error analyzing post ${postLink}:`, error);
  }
}