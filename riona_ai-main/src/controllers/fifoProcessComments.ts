
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
import { Instagram_cookiesExist, loadCookies, saveCookies } from "../utils";
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

// helper to generate a random delay between retries
const getRandomDelay = (min = 3000, max = 10000): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

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

// Helper function to get Instagram username
export async function getInstagramUsername(page: any, usernameSelector?: string): Promise<string> {
  try {
    logger.info("Getting Instagram username from edit page...");
    
    // Navigate to the edit profile page
    await page.goto("https://www.instagram.com/accounts/edit/", { waitUntil: "networkidle2" });
    await delay(5000);
    
    // Use the provided selector if available, otherwise use our precise selector
    // This targets specifically the span containing the username based on the HTML structure you shared
    const selector = usernameSelector || 
      'span[dir="auto"][style*="--lineHeight: 20px"]';
    
    // Wait for the element to be available
    await page.waitForSelector(selector, { timeout: 15000 });
    
    // Extract the username
    const username = await page.evaluate((sel: string) => {
      const elements = document.querySelectorAll(sel);
      // Loop through all matching elements to find the right one
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const text = element.textContent?.trim();
        
        // Skip empty elements or elements with "Accounts Center" text
        if (!text || text.includes("Accounts Center")) {
          continue;
        }
        
        // Check if this text looks like a username (no spaces, reasonable length)
        if (text.length > 2 && text.length <= 30 && !text.includes(" ")) {
          return text;
        }
      }
      return null;
    }, selector);
    
    if (username) {
      logger.info(`Username found from edit page: ${username}`);
      return username; // This should now be "majesty___jewelry"
    } else {
      // If we couldn't find the username with our first approach, try a more specific selector
      logger.warn("Username not found with primary selector, trying alternative...");
      
      // This more specific selector targets the exact span with the username
      const alternativeSelector = 'div.x9f619 div.xamitd3 span[dir="auto"][style*="20px"]';
      
      try {
        await page.waitForSelector(alternativeSelector, { timeout: 5000 });
        
        const altUsername = await page.evaluate((sel: string) => {
          const element = document.querySelector(sel);
          return element?.textContent?.trim() || null;
        }, alternativeSelector);
        
        if (altUsername) {
          logger.info(`Username found with alternative selector: ${altUsername}`);
          return altUsername;
        }
      } catch (err) {
        logger.warn("Alternative selector failed:", err);
      }
      
      logger.warn("Username not found on edit page");
      return "instagram_user";
    }
  } catch (error) {
    logger.error("Error getting username from edit page:", error);
    
    try {
      // For debugging purposes, save a screenshot
      await page.screenshot({ path: 'instagram-username-error.png' });
      logger.info("Debug screenshot saved");
    } catch (e) {
      // Ignore screenshot errors
    }
    
    return "instagram_user";
  }
}


export async function processQueue(): Promise<void> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // 1. Initialize the browser only once for the entire session
    const browserResult = await initBrowser();
    browser = browserResult.browser;
    page = browserResult.page;
    
    // Load cookies
    const cookiesPath = './cookies/Instagramcookies.json';
    while (!(await Instagram_cookiesExist())) {
      logger.error("No Instagram cookies found; retrying in 5 minutes...");
      await delay(5 * 60 * 1000);
    }
  
    // 2) Load/apply cookies and verify login, retrying on failure
    let loggedIn = false;
    while (!loggedIn) {
      const cookies = await loadCookies(cookiesPath);
      await page.setCookie(...cookies);
      logger.info("Instagram cookies loaded; checking login...");
  
      await page.goto("https://www.instagram.com/", { waitUntil: "networkidle2" });
      if (await page.$("a[href='/direct/inbox/']")) {
        loggedIn = true;
        logger.info("Logged into Instagram via cookies.");
        await page.screenshot({ path: "logged_in.png" });
      } else {
        logger.error("Cookies invalid or expired; retrying in 5 minutes...");
        await delay(5 * 60 * 1000);
      }
    }
    // 2. Extract Instagram username directly here
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    logger.info('Navigated to Instagram.');
    
    const username = await getInstagramUsername(page);
    if (!username) {
      logger.error('Failed to retrieve Instagram username');
      return;
    }
    logger.info(`Using Instagram username: ${username}`);

    const collection = getCommentsCollection();

    // 3. Process comments in a loop, reusing the same browser instance
    while (true) {
      const comment = await collection.findOne(
        { username, status: 'processing' },
        { sort: { lastUpdated: 1 } }
      );

      if (!comment) {
        logger.info("No more 'processing' comments for this user. Waiting 2 minutes...");
        await delay(2 * 60 * 1000);
        continue;
      }

      // Log timestamps
      if (comment.timestamp) {
        logger.info(`Comment ${comment._id} created on ${comment.timestamp}`);
      }
      if (comment.lastUpdated) {
        logger.info(`Comment ${comment._id} last updated on ${comment.lastUpdated}`);
      } else {
        logger.info(`Comment ${comment._id} has no lastUpdated timestamp`);
      }

      // 4. Try to post a comment up to 3 times
      let success = false;
      let errorMessage = "";
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        logger.info(`Attempt ${attempt} for comment ${comment._id}`);
        
        try {
          // Navigate to the post page
          const postUrl = `https://www.instagram.com/p/${comment.postId}/`;
          logger.info(`Navigating to post: ${postUrl}`);
          await page.goto(postUrl, { waitUntil: 'networkidle2' });
          await delay(3000);
          
          // Close any potential popups
          const popupEl = await page.$(popupCloseSelector);
          if (popupEl) {
            logger.info("Popup detected, attempting to close it.");
            await popupEl.click();
            await delay(1000);
          }
          
          // Find and click the Like button if necessary
          const likeButton = await page.$(likeButtonSelector);
          if (likeButton) {
            logger.info(`Found like button for post ${comment.postId}.`);
            const ariaLabel = await likeButton.evaluate(el => el.getAttribute("aria-label"));
            
            if (ariaLabel === "Like") {
              logger.info(`Liking post ${comment.postId}...`);
              await page.evaluate(button => {
                button.scrollIntoView({ behavior: "instant", block: "center" });
                button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              }, likeButton);
              logger.info(`Post ${comment.postId} liked.`);
            } else if (ariaLabel === "Unlike") {
              logger.info(`Post ${comment.postId} is already liked.`);
            }
          }
          
          // Find the comment box and comment
          const commentBox = await page.$(commentBoxSelector);
          if (!commentBox) {
            throw new Error("Comment box not found");
          }
          
          logger.info(`Found comment box for post ${comment.postId}.`);
          await commentBox.click();
          await page.type(commentBoxSelector, comment.comment);
          logger.info(`Posting comment: "${comment.comment}"`);
          
          // Find and click the Post button
          const postButtonHandle = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
            return buttons.find(
              (button) => button.textContent?.trim() === 'Post' && !button.hasAttribute('disabled')
            );
          });
          
          if (postButtonHandle) {
            logger.info(`Clicking Post button for post ${comment.postId}...`);
            await (postButtonHandle as any).click();
            logger.info(`Comment successfully posted on post ${comment.postId}.`);
            
            // Wait for the comment to be posted
            await delay(2000);
            success = true;
            break; // Exit the retry loop if successful
          } else {
            throw new Error("Post button not found");
          }
          
        }catch (error) {
          logger.error(`Attempt ${attempt} failed for comment ${comment._id}:`, error);
          
          if (error instanceof Error) {
            errorMessage = error.message;
          } else {
            errorMessage = String(error);
          }
        
          if (attempt < 3) {
            const retryDelay = getRandomDelay();
            logger.info(`Waiting ${retryDelay} ms before retrying`);
            await delay(retryDelay);
          }
        }
        
      }
      
      // 5. Update the comment status in the database
      const updateData = {
        status: success ? 'posted' : 'failed',
        lastUpdated: new Date(),
        ...(success ? {} : { errorMessage })
      };
      
      await collection.updateOne(
        { _id: new ObjectId(comment._id) },
        { $set: updateData }
      );
      
      // 6. Wait before processing the next comment
      const waitDelay = getRandomDelay();
      logger.info(`Waiting ${waitDelay} ms before processing next comment`);
      await delay(waitDelay);
    }
  } catch (error) {
    logger.error('Error during processing queue:', error);
    // Wait before restarting the queue processing
    await delay(30000);
    
    // If the browser is still alive, close it before restarting
    if (browser && browser.isConnected()) {
      try {
        await browser.close();
      } catch (closeError) {
        logger.error('Error closing browser:', closeError);
      }
    }
    
    // Restart processing (recursion)
    processQueue();
  } finally {
    // Ensure the browser is always closed on exit
    if (browser && browser.isConnected()) {
      try {
        await browser.close();
        logger.info('Browser closed at the end of queue processing');
      } catch (closeError) {
        logger.error('Error closing browser:', closeError);
      }
    }
  }
}