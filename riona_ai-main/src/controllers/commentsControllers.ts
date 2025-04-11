// controllers/commentsControllers.ts

import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getCommentsCollection } from '../config/db';
import puppeteer from 'puppeteer-extra';
import { Browser, DEFAULT_INTERCEPT_RESOLUTION_PRIORITY, Page, ElementHandle } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import logger from '../config/logger';

import fs from 'fs';
// -------------------------------------------------------
// Déclaration des sélecteurs utilisés dans ce module
// -------------------------------------------------------

// Sélecteur pour fermer le popup s'il est présent
const popupCloseSelector: string = 'button[class*="dismiss"]';

// Sélecteur pour la zone de commentaire (affiché ici comme variable en haut)
const commentBoxSelector: string = 'textarea[aria-label="Add a comment…"][placeholder="Add a comment…"]';
const likeButtonSelector = 'svg.x1lliihq.x1n2onr6.xyb1xck[aria-label="Like"]';

// -------------------------------------------------------
// Puppeteer Setup
// -------------------------------------------------------
puppeteer.use(StealthPlugin());
puppeteer.use(
  AdblockerPlugin({
    interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
  })
);

// Simple delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Global variables to reuse browser and page instances
let browser: Browser | null = null;
let page: Page | null = null;

/**
 * Initializes the Puppeteer browser and page.
 * Reuses existing instances if available.
 */
async function initBrowser(): Promise<{ browser: Browser; page: Page }> {
  if (browser && page) {
    return { browser, page };
  }
  // Lancement du navigateur en mode non-headless pour afficher l'interface visuelle (exemple initial)
  // browser = await puppeteer.launch({ headless: false, slowMo: 50 });
  // --- Modification pour lancer le navigateur en mode headless (backend) ---
  browser = await puppeteer.launch({ headless: true });
  page = await browser.newPage();
  return { browser, page };
}

/**
 * Posts a comment on an Instagram post identified by postId.
 * Navigates to the post, fills in the comment box, and clicks the Post button.
 *
 * @param postId - The Instagram post ID (shortcode in the URL).
 * @param comment - The comment text to post.
 * @returns An object indicating success or failure.
 * 
 */
export async function commentOnPostById(
  postId: string,
  comment: string
): Promise<{ success: boolean; message: string }> {
  let page;
  try {
    // Initialize the browser and page (reuse existing instances if available)
    const { browser: instBrowser, page: instPage } = await initBrowser();
    page = instPage;
    
    // Load cookies from the file instead of logging in with credentials
    const cookiesPath = './cookies/Instagramcookies.json';
    if (fs.existsSync(cookiesPath)) {
      const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
      const cookies = JSON.parse(cookiesString);
      // Set all cookies; alternatively, you can use the spread syntax:
      // await page.setCookie(...cookies);
      for (const cookie of cookies) {
        await page.setCookie(cookie);
      }
      logger.info("Cookies loaded successfully. Using them to authenticate.");
    } else {
      logger.error('Cookies file does not exist. Run the login process to create it.');
      return { success: false, message: "Cookies file not found" };
    }

    // Navigate to the post URL
    const postUrl = `https://www.instagram.com/p/${postId}/`;
    logger.info(`Navigating to post: ${postUrl}`);
    await page.goto(postUrl, { waitUntil: 'networkidle2' });
    await delay(3000);

    // Close the popup if present
    const popupEl = await page.$(popupCloseSelector);  // popupCloseSelector should be defined/imported
    if (popupEl) {
      logger.info("Popup detected, attempting to close it.");
      await popupEl.click();
      await delay(1000);
    }

    // Find and click the like button
    const likeButton = await page.$(likeButtonSelector);
    if (likeButton) {
      logger.info(`Found like button for post ${postId}.`);
      const ariaLabel = await likeButton.evaluate(el => el.getAttribute("aria-label"));

      if (ariaLabel === "Like") {
        console.log(`Liking post ${postId}...`);
        // Force the click by dispatching a click event from within the page context
        await page.evaluate(button => {
          // Scroll the button into view if necessary
          button.scrollIntoView({ behavior: "instant", block: "center" });
          // Dispatch a click event to force the action
          button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }, likeButton);
        console.log(`Post ${postId} liked.`);
      } else if (ariaLabel === "Unlike") {
        console.log(`Post ${postId} is already liked.`);
      } else {
        console.log(`Like button not found for post ${postId}.`);
      }
    }

    // --- Commenting on the post ---
    // Wait for the comment box to be available
    const commentBox = await page.$(commentBoxSelector);
    if (!commentBox) {
      logger.error("Comment box not found.");
      return { success: false, message: 'Comment box not found' };
    }

    logger.info(`Found comment box for post ${postId}.`);
    await commentBox.click();
    await page.type(commentBoxSelector, comment);
    logger.info(`Posting comment: "${comment}"`);

    // Find and click the "Post" button
    const postButtonHandle = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
      return buttons.find(
        (button) => button.textContent?.trim() === 'Post' && !button.hasAttribute('disabled')
      );
    });

    if (postButtonHandle) {
      logger.info(`Clicking Post button for post ${postId}...`);
      await (postButtonHandle as any).click();
      logger.info(`Comment successfully posted on post ${postId}.`);
      // Wait until the comment is fully posted
      await delay(2000);
      return { success: true, message: 'Comment posted successfully' };
    } else {
      logger.error('Post button not found');
      return { success: false, message: 'Post button not found' };
    }
  } catch (error) {
    // Optionally, take a screenshot for debugging
    if (page) {
      await page.screenshot({ path: `error_${postId}.png` });
    }
    logger.error(`Error posting comment on post ${postId}:`, error);
    return { success: false, message: `Error: ${error}` };
  }
}

// -------------------------------------------------------
// Controller Endpoints
// -------------------------------------------------------

// Get all comments
export const getAllComments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const collection = getCommentsCollection();
    const comments = await collection.find({}).toArray();

    // Format comments for frontend
    const formattedComments = comments.map((comment) => ({
      id: comment._id.toString(),
      postId: comment.postId,
      postCaption: comment.caption,
      generatedComment: comment.comment,
      timestamp: comment.timestamp,
      status: comment.status || 'pending',
      model: comment.model || 'llama3.1'
    }));

    res.status(200).json(formattedComments);
  } catch (error) {
    logger.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
};

// Get a specific comment by ID
export const getCommentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const collection = getCommentsCollection();
    const comment = await collection.findOne({ _id: new ObjectId(id) });

    if (!comment) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    res.status(200).json({
      id: comment._id.toString(),
      postId: comment.postId,
      postCaption: comment.caption,
      generatedComment: comment.comment,
      timestamp: comment.timestamp,
      status: comment.status || 'pending',
      model: comment.model || 'llama3.1'
    });
  } catch (error) {
    logger.error('Error fetching comment:', error);
    res.status(500).json({ message: 'Failed to fetch comment' });
  }
};

// Reject comment: update status to 'rejected'
export const rejectComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const collection = getCommentsCollection();

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    res.status(200).json({ message: 'Comment rejected and deleted successfully' });
  } catch (error) {
    logger.error('Error rejecting comment:', error);
    res.status(500).json({ message: 'Failed to reject comment' });
  }
};

// Function to post a comment on Instagram after logging in
export const postComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const collection = getCommentsCollection();
    const comment = await collection.findOne({ _id: new ObjectId(id) });

    if (!comment) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    // Mise à jour du statut en "processing" dans la DB
    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'processing', lastUpdated: new Date() } }
    );

    // Ici, la publication sur Instagram est désactivée
    res.status(200).json({ message: 'Statut mis à jour en "processing" avec succès' });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour du commentaire:', error);
    res.status(500).json({ message: 'Échec de la mise à jour du commentaire' });
  }
};

// Update comment: modifie le contenu du commentaire et la mise à jour dans la base de données
export const updateComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { comment: newComment } = req.body;

    // Vérification que le nouveau commentaire est fourni et non vide
    if (!newComment || newComment.trim() === '') {
      res.status(400).json({ message: 'Le commentaire fourni est invalide' });
      return;
    }

    const collection = getCommentsCollection();

    // Met à jour le champ "comment" et la date de mise à jour dans la DB
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { comment: newComment, lastUpdated: new Date() } }
    );

    if (result.modifiedCount === 0) {
      res.status(404).json({ message: 'Commentaire non trouvé ou aucune modification détectée' });
      return;
    }

    res.status(200).json({ message: 'Commentaire mis à jour avec succès' });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour du commentaire :', error);
    res.status(500).json({ message: 'Échec de la mise à jour du commentaire' });
  }
};

// Comment by ID: posts the comment via Instagram without updating DB status
export const approveComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const collection = getCommentsCollection();
    const comment = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!comment) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }
    
    // Update the comment's status to "approved"
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'approved' } }
    );
    
    if (result.modifiedCount === 0) {
      res.status(500).json({ message: 'Failed to approve comment' });
      return;
    }
    
    res.status(200).json({ message: 'Comment approved successfully' });
  } catch (error) {
    logger.error('Error approving comment:', error);
    res.status(500).json({ message: 'Failed to approve comment' });
  }
};
