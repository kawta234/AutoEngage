"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processQueue = processQueue;
const proxy_chain_1 = require("proxy-chain");
const mongodb_1 = require("mongodb");
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const puppeteer_extra_plugin_adblocker_1 = __importDefault(require("puppeteer-extra-plugin-adblocker"));
const logger_1 = __importDefault(require("../config/logger"));
const db_1 = require("../config/db");
const agentcontroller_1 = require("../client/agentcontroller");
const popupCloseSelector = 'button[class*="dismiss"]';
const commentBoxSelector = 'textarea[aria-label="Add a comment…"][placeholder="Add a comment…"]';
const likeButtonSelector = 'svg.x1lliihq.x1n2onr6.xyb1xck[aria-label="Like"]';
// -------------------------------------------------------
// Puppeteer Setup
// -------------------------------------------------------
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_adblocker_1.default)({
    interceptResolutionPriority: 1,
}));
// Simple delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// helper to generate a random delay between retries
const getRandomDelay = (min = 30000, max = 100000) => Math.floor(Math.random() * (max - min + 1)) + min;
async function processQueue(username, minPort = 8000, maxPort = 9000) {
    // Générer un port aléatoire entre minPort et maxPort
    const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
    console.log(`Démarrage de la session pour ${username} sur le port ${port}`);
    let proxyServer = null;
    let browser = null;
    try {
        // Démarrer le serveur proxy sur le port généré
        proxyServer = new proxy_chain_1.Server({ port });
        // Attendre que le proxy soit prêt
        await new Promise((resolve, reject) => {
            proxyServer.listen(() => {
                console.log(`Proxy démarré sur le port ${port}`);
                resolve();
            });
            proxyServer.on('error', (err) => {
                reject(new Error(`Échec du démarrage du proxy sur le port ${port}: ${err.message}`));
            });
        });
        const proxyUrl = `http://localhost:${port}`;
        // Lancer le navigateur avec la configuration du proxy
        browser = await puppeteer_extra_1.default.launch({
            headless: true,
            args: [
                `--proxy-server=${proxyUrl}`,
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });
        const page = await browser.newPage();
        // Get Instagram cookies for the provided username
        const cookiesData = await (0, agentcontroller_1.getInstagramCookiesByUsername)(username);
        if (!cookiesData || !cookiesData.cookies) {
            throw new Error("Could not retrieve Instagram cookies");
        }
        const cookies = cookiesData.cookies;
        logger_1.default.info(`Started proxy server for ${username} on port ${port}`);
        // First navigate to Instagram without cookies
        logger_1.default.info(`Navigating to Instagram homepage for ${username}...`);
        await page.goto("https://www.instagram.com/", {
            waitUntil: "networkidle2",
            timeout: 60000 // Increase timeout to 60 seconds
        });
        // Apply cookies
        logger_1.default.info(`Applying cookies for ${username}...`);
        await page.setCookie(...cookies);
        logger_1.default.info(`Cookies applied successfully for ${username}`);
        // Reload the page to use the cookies
        await page.reload({ waitUntil: "networkidle2" });
        // Wait for a clear indication that we're logged in
        try {
            await page.waitForSelector("a[href='/direct/inbox/']", { timeout: 10000 });
            logger_1.default.info(`Logged into Instagram as ${username} via cookies.`);
        }
        catch (e) {
            logger_1.default.error(`Cookies invalid or expired for ${username}`);
            throw new Error(`Failed to log in as ${username}`);
        }
        const collection = (0, db_1.getCommentsCollection)();
        // 3. Process comments in a loop, reusing the same browser instance
        while (true) {
            const comment = await collection.findOne({ username, status: 'processing' }, { sort: { lastUpdated: 1 } });
            if (!comment) {
                logger_1.default.info("No more 'processing' comments for this user. Waiting 2 minutes...");
                await delay(3 * 60 * 1000);
                continue;
            }
            // Log timestamps
            if (comment.timestamp) {
                logger_1.default.info(`Comment ${comment._id} created on ${comment.timestamp}`);
            }
            if (comment.lastUpdated) {
                logger_1.default.info(`Comment ${comment._id} last updated on ${comment.lastUpdated}`);
            }
            else {
                logger_1.default.info(`Comment ${comment._id} has no lastUpdated timestamp`);
            }
            // 4. Try to post a comment up to 3 times
            let success = false;
            let errorMessage = "";
            for (let attempt = 1; attempt <= 3; attempt++) {
                logger_1.default.info(`Attempt ${attempt} for comment ${comment._id}`);
                try {
                    // Navigate to the post page
                    const postUrl = `https://www.instagram.com/p/${comment.postId}/`;
                    logger_1.default.info(`Navigating to post: ${postUrl}`);
                    await page.goto(postUrl, { waitUntil: 'networkidle2' });
                    await delay(3000);
                    // Close any potential popups
                    const popupEl = await page.$(popupCloseSelector);
                    if (popupEl) {
                        logger_1.default.info("Popup detected, attempting to close it.");
                        await popupEl.click();
                        await delay(1000);
                    }
                    // Find and click the Like button if necessary
                    const likeButton = await page.$(likeButtonSelector);
                    if (likeButton) {
                        logger_1.default.info(`Found like button for post ${comment.postId}.`);
                        const ariaLabel = await likeButton.evaluate(el => el.getAttribute("aria-label"));
                        if (ariaLabel === "Like") {
                            logger_1.default.info(`Liking post ${comment.postId}...`);
                            await page.evaluate(button => {
                                button.scrollIntoView({ behavior: "instant", block: "center" });
                                button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                            }, likeButton);
                            logger_1.default.info(`Post ${comment.postId} liked.`);
                        }
                        else if (ariaLabel === "Unlike") {
                            logger_1.default.info(`Post ${comment.postId} is already liked.`);
                        }
                    }
                    // Find the comment box and comment
                    const commentBox = await page.$(commentBoxSelector);
                    if (!commentBox) {
                        throw new Error("Comment box not found");
                    }
                    logger_1.default.info(`Found comment box for post ${comment.postId}.`);
                    await commentBox.click();
                    await page.type(commentBoxSelector, comment.comment);
                    logger_1.default.info(`Posting comment: "${comment.comment}"`);
                    // Find and click the Post button
                    const postButtonHandle = await page.evaluateHandle(() => {
                        const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
                        return buttons.find((button) => button.textContent?.trim() === 'Post' && !button.hasAttribute('disabled'));
                    });
                    if (postButtonHandle) {
                        logger_1.default.info(`Clicking Post button for post ${comment.postId}...`);
                        await postButtonHandle.click();
                        logger_1.default.info(`Comment successfully posted on post ${comment.postId}.`);
                        // Wait for the comment to be posted
                        await delay(2000);
                        success = true;
                        break; // Exit the retry loop if successful
                    }
                    else {
                        throw new Error("Post button not found");
                    }
                }
                catch (error) {
                    logger_1.default.error(`Attempt ${attempt} failed for comment ${comment._id}:`, error);
                    if (error instanceof Error) {
                        errorMessage = error.message;
                    }
                    else {
                        errorMessage = String(error);
                    }
                    if (attempt < 3) {
                        const retryDelay = getRandomDelay();
                        logger_1.default.info(`Waiting ${retryDelay} ms before retrying`);
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
            await collection.updateOne({ _id: new mongodb_1.ObjectId(comment._id) }, { $set: updateData });
            // 6. Wait before processing the next comment
            const waitDelay = getRandomDelay();
            logger_1.default.info(`Waiting ${waitDelay} ms before processing next comment`);
            await delay(waitDelay);
        }
    }
    catch (error) {
        logger_1.default.error('Error during processing queue:', error);
        // Wait before restarting the queue processing
        await delay(30000);
        // If the browser is still alive, close it before restarting
        if (browser && browser.isConnected()) {
            try {
                await browser.close();
            }
            catch (closeError) {
                logger_1.default.error('Error closing browser:', closeError);
            }
        }
        // Replace 'default_username' with an actual username
    }
    finally {
        // Ensure the browser is always closed on exit
        if (browser && browser.isConnected()) {
            try {
                await browser.close();
                logger_1.default.info('Browser closed at the end of queue processing');
            }
            catch (closeError) {
                logger_1.default.error('Error closing browser:', closeError);
            }
        }
    }
}
