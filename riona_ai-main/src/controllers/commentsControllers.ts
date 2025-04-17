// controllers/commentsControllers.ts

import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getUserCollection as dbGetUserCollection, getCommentsCollection as dbGetCommentsCollection } from '../config/db';
import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import logger from '../config/logger';
import fs from 'fs';

// Added getUserCollection function since it was missing
async function getUserCollection(userId: string) {
  return dbGetUserCollection(userId);
}

// Fixed getCommentsCollection function to properly use the imported function
function getCommentsCollection() {
  return dbGetCommentsCollection();
}

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

export async function commentOnPostById(
  userId: string,
  postId: string,
  comment: string
): Promise<{ success: boolean; message: string }> {
  let page;
  try {
    const { browser: instBrowser, page: instPage } = await initBrowser();
    page = instPage;
    
    const cookiesPath = './cookies/Instagramcookies.json';
    if (fs.existsSync(cookiesPath)) {
      const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
      const cookies = JSON.parse(cookiesString);
      for (const cookie of cookies) {
        await page.setCookie(cookie);
      }
      logger.info("Cookies loaded successfully.");
    } else {
      logger.error('Cookies file does not exist.');
      return { success: false, message: "Cookies file not found" };
    }

    const postUrl = `https://www.instagram.com/p/${postId}/`;
    logger.info(`Navigating to post: ${postUrl}`);
    await page.goto(postUrl, { waitUntil: 'networkidle2' });
    await delay(3000);

    const popupEl = await page.$(popupCloseSelector);
    if (popupEl) {
      await popupEl.click();
      await delay(1000);
    }

    const likeButton = await page.$(likeButtonSelector);
    if (likeButton) {
      const ariaLabel = await likeButton.evaluate(el => el.getAttribute("aria-label"));
      if (ariaLabel === "Like") {
        await page.evaluate(button => {
          button.scrollIntoView({ behavior: "instant", block: "center" });
          button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }, likeButton);
        logger.info(`Post ${postId} liked.`);
      }
    }

    const commentBox = await page.$(commentBoxSelector);
    if (!commentBox) {
      logger.error("Comment box not found.");
      return { success: false, message: 'Comment box not found' };
    }
    await commentBox.click();
    await page.type(commentBoxSelector, comment);
    logger.info(`Posting comment: "${comment}"`);

    const postButtonHandle = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
      return buttons.find(
        (button) => button.textContent?.trim() === 'Post' && !button.hasAttribute('disabled')
      );
    });

    if (postButtonHandle) {
      await (postButtonHandle as any).click();
      logger.info(`Comment successfully posted on post ${postId}.`);
      await delay(2000);

      // Récupérer la collection utilisateur pour stocker les informations
      const userCollection = await getUserCollection(userId);
      await userCollection.insertOne({
        postId: postId,
        caption: comment,
        comment: comment,
        timestamp: new Date(),
      });

      return { success: true, message: 'Comment posted and saved successfully' };
    } else {
      logger.error('Post button not found');
      return { success: false, message: 'Post button not found' };
    }
  } catch (error) {
    if (page) {
      await page.screenshot({ path: `error_${postId}.png` });
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Error posting comment on post ${postId}:`, errMsg);
    return { success: false, message: `Error: ${errMsg}` };
  }
}

// -------------------------------------------------------
// Controller Endpoints
// -------------------------------------------------------

export const getAllComments = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract userId from query (if provided and is a string)
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

    // Choose the right collection
    const collection = userId
      ? await getUserCollection(userId)
      : getCommentsCollection();

    // Fetch all comments
    const comments = await collection.find({}).toArray();

    // Map to the desired response shape
    const formatted = comments.map(comment => ({
      id: comment._id.toString(),
      postId: comment.postId,
      postCaption: comment.caption,
      generatedComment: comment.comment,
      timestamp: comment.timestamp,
      status: comment.status ?? 'pending',
      model: comment.model ?? 'llama3.1',
    }));

    res.status(200).json(formatted);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Error fetching comments:', msg);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
};
export const getCommentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      // Si pas d'userId, utiliser la collection générale
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
    } else {
      // Si userId fourni, chercher dans la collection spécifique à l'utilisateur
      const userCollection = await getUserCollection(userId);
      const comment = await userCollection.findOne({ _id: new ObjectId(id) });
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
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Error fetching comment:', errMsg);
    res.status(500).json({ message: 'Failed to fetch comment' });
  }
};

/**
 * Lance un navigateur non-headless pour permettre une connexion manuelle à Instagram.
 * Après la connexion, il sauvegarde les cookies dans un fichier puis ferme le navigateur.
 */
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

export const rejectComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      // Si pas d'userId, utiliser la collection générale
      const collection = getCommentsCollection();
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) {
        res.status(404).json({ message: 'Comment not found' });
        return;
      }
      res.status(200).json({ message: 'Comment rejected and deleted successfully' });
    } else {
      // Si userId fourni, supprimer de la collection spécifique à l'utilisateur
      const userCollection = await getUserCollection(userId);
      const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) {
        res.status(404).json({ message: 'Comment not found' });
        return;
      }
      res.status(200).json({ message: 'Comment rejected and deleted successfully' });
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Error rejecting comment:', errMsg);
    res.status(500).json({ message: 'Failed to reject comment' });
  }
};

export const postComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId, comment } = req.body;

    let existingComment: any;
    
    if (!userId) {
      // Si pas d'userId, utiliser la collection générale
      const collection = getCommentsCollection();
      existingComment = await collection.findOne({ _id: new ObjectId(id) });
      if (!existingComment) {
        res.status(404).json({ message: 'Comment not found' });
        return;
      }
      
      // Update status to processing
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'processing', lastUpdated: new Date() } }
      );
      
      // Try to post the comment to Instagram
      const result = await commentOnPostById(
        "system",  // Using system as default userId when not provided
        existingComment.postId,
        existingComment.comment
      );
      
      if (result.success) {
        await collection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'posted', postedAt: new Date() } }
        );
        res.status(200).json({ message: 'Comment posted successfully', result });
      } else {
        await collection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'failed', error: result.message, lastUpdated: new Date() } }
        );
        res.status(500).json({ message: 'Failed to post comment', error: result.message });
      }
    } else {
      // Si userId fourni, utiliser la collection spécifique à l'utilisateur
      const userCollection = await getUserCollection(userId);
      existingComment = await userCollection.findOne({ _id: new ObjectId(id) });
      if (!existingComment) {
        res.status(404).json({ message: 'Comment not found' });
        return;
      }
      
      // Update status to processing
      await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'processing', lastUpdated: new Date() } }
      );
      
      // Try to post the comment to Instagram
      const result = await commentOnPostById(
        userId,
        existingComment.postId,
        existingComment.comment
      );
      
      if (result.success) {
        await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'posted', postedAt: new Date() } }
        );
        res.status(200).json({ message: 'Comment posted successfully', result });
      } else {
        await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'failed', error: result.message, lastUpdated: new Date() } }
        );
        res.status(500).json({ message: 'Failed to post comment', error: result.message });
      }
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Erreur lors de la mise à jour du commentaire:', errMsg);
    res.status(500).json({ message: 'Échec de la mise à jour du commentaire' });
  }
};

export const updateComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { comment: newComment, userId } = req.body;
    
    if (!newComment || newComment.trim() === '') {
      res.status(400).json({ message: 'Le commentaire fourni est invalide' });
      return;
    }

    let result;
    if (!userId) {
      // Si pas d'userId, utiliser la collection générale
      const collection = getCommentsCollection();
      result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { comment: newComment, lastUpdated: new Date() } }
      );
    } else {
      // Si userId fourni, utiliser la collection spécifique à l'utilisateur
      const userCollection = await getUserCollection(userId);
      result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { comment: newComment, lastUpdated: new Date() } }
      );
    }
    
    if (result.modifiedCount === 0) {
      res.status(404).json({ message: 'Commentaire non trouvé ou aucune modification détectée' });
      return;
    }
    res.status(200).json({ message: 'Commentaire mis à jour avec succès' });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Erreur lors de la mise à jour du commentaire :', errMsg);
    res.status(500).json({ message: 'Échec de la mise à jour du commentaire' });
  }
};

export const approveComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    let result;
    if (!userId) {
      // Si pas d'userId, utiliser la collection générale
      const collection = getCommentsCollection();
      const comment = await collection.findOne({ _id: new ObjectId(id) });
      if (!comment) {
        res.status(404).json({ message: 'Comment not found' });
        return;
      }
      result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'approved' } }
      );
    } else {
      // Si userId fourni, utiliser la collection spécifique à l'utilisateur
      const userCollection = await getUserCollection(userId);
      const comment = await userCollection.findOne({ _id: new ObjectId(id) });
      if (!comment) {
        res.status(404).json({ message: 'Comment not found' });
        return;
      }
      result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'approved' } }
      );
    }
    
    if (result.modifiedCount === 0) {
      res.status(500).json({ message: 'Failed to approve comment' });
      return;
    }
    res.status(200).json({ message: 'Comment approved successfully' });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Error approving comment:', errMsg);
    res.status(500).json({ message: 'Failed to approve comment' });
  }
};