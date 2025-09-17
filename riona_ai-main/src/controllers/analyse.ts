import { Builder, By, WebDriver, WebElement, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { ObjectId } from 'mongodb';
import logger from '../config/logger';
import { getCommentsCollection } from '../config/db';
import { getInstagramCookiesByUsername } from "../client/agentcontroller";

// Simple delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// helper to generate a random delay between retries
const getRandomDelay = (min = 30000, max = 100000): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// Safe error-to-string helper
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Interface for comment analysis results
interface CommentAnalysis {
  divId?: string;
  divClass?: string;
  likes: number;
  replies: number;
  analysisDate: Date;
  found: boolean;
  errorMessage?: string;
}

export async function processAnalysisQueue(username: string): Promise<void> {
  console.log(`Starting analysis session for ${username}`);
  
  let driver: WebDriver | null = null;
  
  try {
    // Configure Chrome options
    const options = new chrome.Options();
    options.addArguments('--disable-web-security');
    options.addArguments('--disable-features=VizDisplayCompositor');
    options.addArguments('--start-maximized');
    // Remove headless mode to see the browser
    // options.addArguments('--headless'); // Commented out to show browser
    
    // Create WebDriver instance
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    // Set window size
    await driver.manage().window().setRect({ width: 1920, height: 1080 });
    
    // Get Instagram cookies for the provided username
    const cookiesData = await getInstagramCookiesByUsername(username);
    if (!cookiesData || !cookiesData.cookies) {
      throw new Error("Could not retrieve Instagram cookies");
    }
    
    const cookies = cookiesData.cookies;
    
    logger.info(`Started browser session for analysis of ${username}`);

    // First navigate to Instagram without cookies
    logger.info(`Navigating to Instagram homepage for ${username}...`);
    await driver.get("https://www.instagram.com/");
    await delay(3000);
    
    // Apply cookies
    logger.info(`Applying cookies for ${username}...`);
    for (const cookie of cookies) {
      try {
        await driver.manage().addCookie({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          httpOnly: cookie.httpOnly || false,
          secure: cookie.secure || false
        });
      } catch (error: unknown) {
        logger.warn(`Failed to add cookie ${cookie.name}: ${errMsg(error)}`);
      }
    }
    logger.info(`Cookies applied successfully for ${username}`);
    
    // Reload the page to use the cookies
    await driver.navigate().refresh();
    await delay(5000);
    
    // Wait for a clear indication that we're logged in
    try {
      await driver.wait(until.elementLocated(By.css("a[href='/direct/inbox/']")), 10000);
      logger.info(`Logged into Instagram as ${username} via cookies.`);
    } catch (e: unknown) {
      logger.error(`Cookies invalid or expired for ${username}`);
      throw new Error(`Failed to log in as ${username}`);
    }

    const collection = getCommentsCollection();

    // Process comments for analysis in a loop
    while (true) {
      // Find comments with 'posted' status for analysis
      const comment = await collection.findOne(
        { username, status: 'posted' },
        { sort: { lastUpdated: 1 } }
      );

      if (!comment) {
        logger.info("No more 'posted' comments for analysis. Waiting 2 minutes...");
        await delay(2 * 60 * 1000);
        continue;
      }

      logger.info(`Analyzing comment ${comment._id} by ${username}: "${comment.comment}"`);

      // Initialize analysis result
      const analysisResult: CommentAnalysis = {
        likes: 0,
        replies: 0,
        analysisDate: new Date(),
        found: false
      };

      try {
        // Navigate to the post page
        const postUrl = `https://www.instagram.com/p/${comment.postId}/`;
        logger.info(`Navigating to post: ${postUrl}`);
        await driver.get(postUrl);
        await delay(3000);

        // Scroll to load comments
        await driver.executeScript("window.scrollTo(0, document.body.scrollHeight / 2);");
        await delay(2000);

        // Find the comment using improved search
        const commentText = comment.comment.trim();
        logger.info(`Searching for comment: "${commentText}"`);
        
        try {
          // Scroll more to load comments first
          for (let i = 0; i < 5; i++) {
            await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
            await delay(2000);
            
            // Try to click "View more comments" if it exists
            try {
              const viewMoreButtons = await driver.findElements(By.xpath("//button[contains(text(), 'View more comments') or contains(text(), 'Load more comments') or contains(., 'View more comments')]"));
              if (viewMoreButtons.length > 0) {
                await viewMoreButtons[0].click();
                await delay(3000);
                logger.info('Clicked "View more comments" button');
              }
            } catch (e: unknown) {
              // No button found, continue
            }
          }
          
          // Safe XPath literal (handles quotes)
          function toXPathLiteral(s: string): string {
            if (!s.includes(`'`)) return `'${s}'`;
            if (!s.includes(`"`)) return `"${s}"`;
            return "concat('" + s.replace(/'/g, "',\"'\",'") + "')";
          }

          const escapedText = toXPathLiteral(commentText);
          
          // Try multiple XPath strategies
          const xpathStrategies = [
            // Strategy 1: Any element containing the text
            `//*[contains(text(), ${escapedText})]`,
            
            // Strategy 2: Partial text match (useful for long comments)
            `//*[contains(text(), ${toXPathLiteral(commentText.substring(0, 50))})]`,
            
            // Strategy 3: Search in spans (Instagram often uses spans for comments)
            `//span[contains(text(), ${escapedText})]`,
            
            // Strategy 4: Search in divs with specific roles
            `//div[@role]//span[contains(text(), ${escapedText})]`,
            `//div[@role]//div[contains(text(), ${escapedText})]`,
            
            // Strategy 5: More flexible search with normalize-space
            `//*[contains(normalize-space(text()), ${escapedText})]`,

            // Strategy 6: Case insensitive (via translate)
            `//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), ${toXPathLiteral(commentText.toLowerCase())})]`
          ];
          
          let commentElement: WebElement | null = null;
          let usedStrategy = '';
          
          // Try each strategy
          for (let strategyIndex = 0; strategyIndex < xpathStrategies.length; strategyIndex++) {
            try {
              const elements = await driver.findElements(By.xpath(xpathStrategies[strategyIndex]));
              
              if (elements.length > 0) {
                // Find the best matching element
                for (const element of elements) {
                  const elementText = (await element.getText()).trim();
                  const targetText = commentText.trim();
                  
                  // Check if it's a good match
                  if (elementText.includes(targetText) || targetText.includes(elementText)) {
                    // Make sure it's not a button or link
                    const tagName = (await element.getTagName()).toLowerCase();
                    if (tagName !== 'button' && tagName !== 'a') {
                      commentElement = element;
                      usedStrategy = `Strategy ${strategyIndex + 1}`;
                      logger.info(`Found comment using ${usedStrategy}: ${xpathStrategies[strategyIndex]}`);
                      break;
                    }
                  }
                }
                
                if (commentElement) break;
              }
            } catch (strategyError: unknown) {
              logger.warn(`Strategy ${strategyIndex + 1} failed: ${errMsg(strategyError)}`);
              continue;
            }
          }
          
          // If still not found, try a more aggressive search
          if (!commentElement) {
            logger.info('Trying more aggressive search...');
            
            try {
              const aggressiveEl = await driver.executeScript(
                `
                  const searchText = arguments[0];
                  const allElements = document.querySelectorAll('*');
                  for (let element of allElements) {
                    if (element && element.textContent && element.textContent.trim().includes(searchText.trim())) {
                      return element;
                    }
                  }
                  return null;
                `,
                commentText
              ) as WebElement | null;
              
              if (aggressiveEl) {
                commentElement = aggressiveEl;
                logger.info('Found comment using JavaScript search');
              }
            } catch (jsError: unknown) {
              logger.error(`JavaScript search failed: ${errMsg(jsError)}`);
            }
          }
          
          if (commentElement) {
            logger.info(`Found comment: "${commentText}" using ${usedStrategy || 'JavaScript search'}`);
            analysisResult.found = true;
            
            // Find the parent div container that is 4 levels up from the found comment
            const uniqueParentInfo = await driver.executeScript(
              `
                const commentSpan = arguments[0];
                const searchText = arguments[1];
                
                // Function to go exactly 4 levels up from the found element
                function findUniqueParentDiv(element) {
                  let targetElement = element;
                  
                  // Go up exactly 4 parent levels
                  for (let i = 0; i < 4 && targetElement && targetElement.parentElement; i++) {
                    targetElement = targetElement.parentElement;
                  }
                  
                  // If we couldn't go up 4 levels, use what we have
                  if (!targetElement) {
                    targetElement = element;
                  }
                  
                  return {
                    element: targetElement,
                    tagName: targetElement.tagName,
                    className: targetElement.className || '',
                    id: targetElement.id || '',
                    dataTestId: targetElement.getAttribute('data-testid') || '',
                    role: targetElement.getAttribute('role') || '',
                    level: 4,
                    score: 1,
                    hasInteractionElements: false,
                    hasSiblings: false,
                    xpath: getElementXPath(targetElement)
                  };
                }
                
                // Helper function to generate XPath for an element
                function getElementXPath(element) {
                  if (!element) return '';
                  
                  if (element.id) {
                    return \`//\${element.tagName.toLowerCase()}[@id='\${element.id}']\`;
                  }
                  
                  const parts = [];
                  let current = element;
                  
                  while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 10) {
                    let tagName = current.tagName.toLowerCase();
                    let index = 1;
                    
                    // Count siblings with same tag name
                    let sibling = current.previousElementSibling;
                    while (sibling) {
                      if (sibling.tagName.toLowerCase() === tagName) {
                        index++;
                      }
                      sibling = sibling.previousElementSibling;
                    }
                    
                    let part = tagName;
                    if (index > 1) {
                      part += \`[\${index}]\`;
                    } else {
                      // Check if there are siblings with the same tag
                      let nextSibling = current.nextElementSibling;
                      let hasSameTagSibling = false;
                      while (nextSibling && !hasSameTagSibling) {
                        if (nextSibling.tagName.toLowerCase() === tagName) {
                          hasSameTagSibling = true;
                        }
                        nextSibling = nextSibling.nextElementSibling;
                      }
                      if (hasSameTagSibling) {
                        part += '[1]';
                      }
                    }
                    
                    parts.unshift(part);
                    current = current.parentElement;
                  }
                  
                  return '//' + parts.join('/');
                }
                
                const parentInfo = findUniqueParentDiv(commentSpan);
                
                return {
                  className: parentInfo.className,
                  id: parentInfo.id,
                  dataTestId: parentInfo.dataTestId,
                  role: parentInfo.role,
                  level: parentInfo.level,
                  score: parentInfo.score,
                  hasInteractionElements: parentInfo.hasInteractionElements,
                  hasSiblings: parentInfo.hasSiblings,
                  xpath: parentInfo.xpath,
                  tagName: parentInfo.tagName,
                  // Get some additional identifying information
                  innerHTML: parentInfo.element ? parentInfo.element.innerHTML.substring(0, 200) : '', // First 200 chars for reference
                  outerHTML: parentInfo.element ? parentInfo.element.outerHTML.substring(0, 300) : '' // First 300 chars for structure
                };
              `,
              commentElement,
              commentText
            );
            
            const parentInfo = uniqueParentInfo as any;
            
            // Store the comprehensive parent information
            analysisResult.divClass = parentInfo.className;
            analysisResult.divId = parentInfo.id;
            
            // Add additional fields for better identification
            const additionalInfo = {
              dataTestId: parentInfo.dataTestId,
              role: parentInfo.role,
              level: parentInfo.level,
              score: parentInfo.score,
              directChildDivs: parentInfo.directChildDivs,
              structureComponents: parentInfo.structureComponents,
              childScore: parentInfo.childScore,
              isMainCommentContainer: parentInfo.isMainCommentContainer,
              hasProfilePicture: parentInfo.hasProfilePicture,
              hasUsername: parentInfo.hasUsername,
              hasCommentText: parentInfo.hasCommentText,
              hasTimestamp: parentInfo.hasTimestamp,
              xpath: parentInfo.xpath,
              tagName: parentInfo.tagName
            };
            
            logger.info(`Comment container details:`);
            logger.info(`- Tag: ${parentInfo.tagName}`);
            logger.info(`- Class: "${parentInfo.className}"`);
            logger.info(`- ID: "${parentInfo.id}"`);
            logger.info(`- Data Test ID: "${parentInfo.dataTestId}"`);
            logger.info(`- Role: "${parentInfo.role}"`);
            logger.info(`- Parent Level: ${parentInfo.level}`);
            logger.info(`- Container Score: ${parentInfo.score}`);
            logger.info(`- Has Interactions: ${parentInfo.hasInteractionElements}`);
            logger.info(`- Has Siblings: ${parentInfo.hasSiblings}`);
            logger.info(`- XPath: ${parentInfo.xpath}`);
            
            // Get the exact comment container for likes/replies extraction
            let exactCommentContainer: WebElement | null = null;
            
            try {
              // Try to get the container using the XPath
              exactCommentContainer = await driver.executeScript(
                `
                  const xpath = arguments[0];
                  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                  return result.singleNodeValue;
                `,
                parentInfo.xpath
              ) as WebElement | null;
            } catch (xpathError: unknown) {
              logger.warn(`XPath container retrieval failed: ${errMsg(xpathError)}`);
            }
            
            // Fallback to finding container with likes/replies
            if (!exactCommentContainer) {
              exactCommentContainer = await driver.executeScript(
                `
                  const element = arguments[0];
                  let parent = element ? element.parentElement : null;
                  let attempts = 0;
                  
                  while (parent && attempts < 10) {
                    const parentHTML = (parent.innerHTML || '').toLowerCase();
                    if (
                        parentHTML.includes('like') || parentHTML.includes('reply') || 
                        parentHTML.includes('❤') || parentHTML.includes('💬') ||
                        parent.querySelector('[aria-label*="like"]') ||
                        parent.querySelector('[aria-label*="reply"]')
                    ) {
                      return parent;
                    }
                    parent = parent.parentElement;
                    attempts++;
                  }
                  return element && element.parentElement ? element.parentElement : element;
                `,
                commentElement
              ) as WebElement | null;
            }
            
            // Extract likes and replies using the improved method
            try {
              const likesCount = await driver.executeScript(
                `
                  const container = arguments[0];
                  const targetCommentText = arguments[1];
                  const commentClass = arguments[2];
                  
                  if (!container || !targetCommentText) return 0;
                  
                  console.log('=== IMPROVED LIKES EXTRACTION ===');
                  console.log('Target comment:', targetCommentText);
                  console.log('Comment class:', commentClass);
                  
                  // First, find the exact comment container using both class and text
                  let exactCommentContainer = null;
                  
                  // Method 1: Find by class first, then verify text
                  if (commentClass && commentClass.trim()) {
                    try {
                      const classSelector = '.' + commentClass.trim().split(' ').filter(c => c).join('.');
                      const commentDivs = container.querySelectorAll(classSelector);
                      console.log('Found', commentDivs.length, 'elements with comment class selector:', classSelector);
                      
                      for (const div of commentDivs) {
                        const divText = (div.textContent || div.innerText || '').trim();
                        if (divText.includes(targetCommentText.trim())) {
                          exactCommentContainer = div;
                          console.log('Found exact comment container using class + text verification');
                          break;
                        }
                      }
                    } catch (classError) {
                      console.log('Class selector failed:', classError.message);
                    }
                  }
                  
                  // Method 2: Fallback - find by text then check if it has the class
                  if (!exactCommentContainer) {
                    const allElements = container.querySelectorAll('*');
                    for (const element of allElements) {
                      const elementText = (element.textContent || element.innerText || '').trim();
                      if (elementText.includes(targetCommentText.trim())) {
                        // Check if this element or its parents have the comment class
                        let checkElement = element;
                        let attempts = 0;
                        while (checkElement && attempts < 5) {
                          if (commentClass && checkElement.className && 
                              commentClass.split(' ').some(cls => cls && checkElement.className.includes(cls))) {
                            exactCommentContainer = checkElement;
                            console.log('Found exact comment container using text + class verification');
                            break;
                          }
                          checkElement = checkElement.parentElement;
                          attempts++;
                        }
                        if (exactCommentContainer) break;
                      }
                    }
                  }
                  
                  // Method 3: If still no exact container, use the main container
                  if (!exactCommentContainer) {
                    console.log('Using main container as fallback');
                    exactCommentContainer = container;
                  }
                  
                  console.log('Using container for likes search');
                  
                  // Search within the comment container and its immediate siblings
                  const searchContainers = [
                    exactCommentContainer,
                    exactCommentContainer.parentElement,
                    exactCommentContainer.nextElementSibling,
                    exactCommentContainer.previousElementSibling
                  ].filter(Boolean);
                  
                  for (const searchContainer of searchContainers) {
                    // Try the specific class combination first
                    const specificSpan = searchContainer.querySelector('span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft');
                    if (specificSpan) {
                      const text = specificSpan.textContent || '';
                      console.log('Found specific likes span:', text);
                      const match = text.match(/(\\d+)\\s*like/i);
                      if (match) {
                        console.log('Extracted likes from specific span:', match[1]);
                        return parseInt(match[1], 10);
                      }
                    }
                    
                    // Try broader search with partial class matching
                    const partialSpans = searchContainer.querySelectorAll('span[class*="x1lliihq"]');
                    for (const span of partialSpans) {
                      const text = span.textContent || '';
                      if (text.includes('like') && !text.includes('reply')) {
                        console.log('Found potential likes span:', text);
                        const match = text.match(/(\\d+)\\s*like/i);
                        if (match) {
                          console.log('Extracted likes from partial match:', match[1]);
                          return parseInt(match[1], 10);
                        }
                      }
                    }
                    
                    // Look for any span containing "like" text
                    const allSpans = searchContainer.querySelectorAll('span');
                    for (const span of allSpans) {
                      const text = (span.textContent || '').toLowerCase();
                      if (text.includes('like') && !text.includes('reply') && /\\d+\\s*like/.test(text)) {
                        console.log('Found like text in span:', span.textContent);
                        const match = span.textContent.match(/(\\d+)\\s*like/i);
                        if (match) {
                          console.log('Extracted likes from text search:', match[1]);
                          return parseInt(match[1], 10);
                        }
                      }
                    }
                  }
                  
                  console.log('No likes found using improved method');
                  return 0;
                `,
                exactCommentContainer,
                commentText,
                analysisResult.divClass || ''
              );

              const repliesCount = await driver.executeScript(
                `
                  const container = arguments[0];
                  const targetCommentText = arguments[1];
                  const commentClass = arguments[2];
                  
                  if (!container || !targetCommentText) return 0;
                  
                  console.log('=== IMPROVED REPLIES EXTRACTION ===');
                  console.log('Target comment:', targetCommentText);
                  console.log('Comment class:', commentClass);
                  
                  // Find the exact comment container (same logic as likes)
                  let exactCommentContainer = null;
                  
                  if (commentClass && commentClass.trim()) {
                    try {
                      const classSelector = '.' + commentClass.trim().split(' ').filter(c => c).join('.');
                      const commentDivs = container.querySelectorAll(classSelector);
                      for (const div of commentDivs) {
                        const divText = (div.textContent || div.innerText || '').trim();
                        if (divText.includes(targetCommentText.trim())) {
                          exactCommentContainer = div;
                          break;
                        }
                      }
                    } catch (classError) {
                      console.log('Class selector failed for replies:', classError.message);
                    }
                  }
                  
                  if (!exactCommentContainer) {
                    const allElements = container.querySelectorAll('*');
                    for (const element of allElements) {
                      const elementText = (element.textContent || element.innerText || '').trim();
                      if (elementText.includes(targetCommentText.trim())) {
                        let checkElement = element;
                        let attempts = 0;
                        while (checkElement && attempts < 5) {
                          if (commentClass && checkElement.className && 
                              commentClass.split(' ').some(cls => cls && checkElement.className.includes(cls))) {
                            exactCommentContainer = checkElement;
                            break;
                          }
                          checkElement = checkElement.parentElement;
                          attempts++;
                        }
                        if (exactCommentContainer) break;
                      }
                    }
                  }
                  
                  if (!exactCommentContainer) {
                    exactCommentContainer = container;
                  }
                  
                  // Search for replies in the exact comment's vicinity
                  const searchContainers = [
                    exactCommentContainer,
                    exactCommentContainer.parentElement,
                    exactCommentContainer.nextElementSibling,
                    exactCommentContainer.previousElementSibling
                  ].filter(Boolean);
                  
                  for (const searchContainer of searchContainers) {
                    // Look for reply buttons or spans
                    const replyElements = searchContainer.querySelectorAll('button, span, div');
                    for (const element of replyElements) {
                      const text = (element.textContent || '').toLowerCase();
                      const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
                      
                      // Check for reply indicators
                      if ((text.includes('reply') || text.includes('view replies') || 
                          ariaLabel.includes('reply') || ariaLabel.includes('view replies')) &&
                          /\\d+/.test(text + ' ' + ariaLabel)) {
                        console.log('Found reply element:', element.textContent, 'aria-label:', ariaLabel);
                        
                        // Extract number from text
                        const textMatch = text.match(/(\\d+)\\s*repl/i);
                        if (textMatch) {
                          console.log('Extracted replies from text:', textMatch[1]);
                          return parseInt(textMatch[1], 10);
                        }
                        
                        // Extract number from aria-label
                        const ariaMatch = ariaLabel.match(/(\\d+)\\s*repl/i);
                        if (ariaMatch) {
                          console.log('Extracted replies from aria-label:', ariaMatch[1]);
                          return parseInt(ariaMatch[1], 10);
                        }
                        
                        // Look for "View X replies" pattern
                        const viewMatch = (text + ' ' + ariaLabel).match(/view\\s+(\\d+)\\s+repl/i);
                        if (viewMatch) {
                          console.log('Extracted replies from view pattern:', viewMatch[1]);
                          return parseInt(viewMatch[1], 10);
                        }
                      }
                    }
                  }
                  
                  console.log('No replies found using improved method');
                  return 0;
                `,
                exactCommentContainer,
                commentText,
                analysisResult.divClass || ''
              );

              analysisResult.likes = (likesCount as number) || 0;
              analysisResult.replies = (repliesCount as number) || 0;
              
              logger.info(`Found ${analysisResult.likes} likes and ${analysisResult.replies} replies for comment`);
            } catch (error: unknown) {
              logger.error(`Error extracting likes/replies: ${errMsg(error)}`);
            }
            
            // Store additional identification data in analysis result
            (analysisResult as any).additionalInfo = additionalInfo;
            
          } else {
            logger.warn(`Comment not found: "${commentText}"`);
            analysisResult.found = false;
            analysisResult.errorMessage = "Comment not found after trying all search strategies";
          }
          
        } catch (elementNotFound: unknown) {
          logger.warn(
            `Comment search failed: "${commentText}" - ${errMsg(elementNotFound)}`
          );
          analysisResult.found = false;
          analysisResult.errorMessage = "Comment search failed: " + errMsg(elementNotFound);
        }
        
      } catch (error: unknown) {
        logger.error(`Error analyzing comment ${comment._id}: ${errMsg(error)}`);
        analysisResult.found = false;
        analysisResult.errorMessage = errMsg(error);
      }
      
      // Log analysis results
      logger.info(`Analysis Results for comment ${comment._id}:`);
      logger.info(`- Found: ${analysisResult.found}`);
      logger.info(`- Likes: ${analysisResult.likes}`);
      logger.info(`- Replies: ${analysisResult.replies}`);
      logger.info(`- Div Class: ${analysisResult.divClass}`);
      logger.info(`- Div ID: ${analysisResult.divId}`);
      
      // Update the existing comment with analysis data and change status to 'analyzed'
      await collection.updateOne(
        { _id: new ObjectId(comment._id) },
        { 
          $set: {
            analysis: {
              divId: analysisResult.divId,
              divClass: analysisResult.divClass,
              likes: analysisResult.likes,
              replies: analysisResult.replies,
              analysisDate: analysisResult.analysisDate,
              found: analysisResult.found,
              errorMessage: analysisResult.errorMessage
            },
            lastAnalyzed: new Date(),
            status: 'posted' // Change status so it won't be processed again
          }
        }
      );
      
      logger.info(`Comment ${comment._id} analysis completed and status updated to 'posted'`);
      
      // Wait before processing the next comment
      const waitDelay = getRandomDelay(5000, 15000); // Shorter delay between comments
      logger.info(`Waiting ${waitDelay} ms before processing next comment`);
      await delay(waitDelay);
    }
    
  } catch (error: unknown) {
    logger.error(`Error during analysis queue processing: ${errMsg(error)}`);
    // Wait before restarting
    await delay(30000);
    
  } finally {
    // Ensure the driver is always closed on exit
    if (driver) {
      try {
        await driver.quit();
        logger.info('WebDriver closed at the end of analysis processing');
      } catch (closeError: unknown) {
        logger.error(`Error closing WebDriver: ${errMsg(closeError)}`);
      }
    }
  }
}