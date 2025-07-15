"use strict";
// controllers/commentsControllers.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFilteredUser = exports.getFilteredUsers = exports.saveFilteredUser = exports.approveComment = exports.updateComment = exports.postComment = exports.rejectComment = exports.getInstagramStatus = exports.setInstagramUsername = exports.instagramLogin = exports.getCommentById = exports.getAllComments = void 0;
exports.getInstagramUsername = getInstagramUsername;
exports.fetchInstagramUsername = fetchInstagramUsername;
exports.commentOnPostById = commentOnPostById;
const mongodb_1 = require("mongodb");
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const puppeteer_extra_plugin_adblocker_1 = __importDefault(require("puppeteer-extra-plugin-adblocker"));
const logger_1 = __importDefault(require("../config/logger"));
const fs_1 = __importDefault(require("fs"));
const db_1 = require("../config/db");
// -------------------------------------------------------
// Déclaration des sélecteurs utilisés dans ce module
// -------------------------------------------------------
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
let browser = null;
let page = null;
async function initBrowser() {
    if (browser && page) {
        return { browser, page };
    }
    browser = await puppeteer_extra_1.default.launch({ headless: true });
    page = await browser.newPage();
    return { browser, page };
}
async function getInstagramUsername(page, usernameSelector) {
    try {
        logger_1.default.info("Getting Instagram username from edit page...");
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
        const username = await page.evaluate((sel) => {
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
            logger_1.default.info(`Username found from edit page: ${username}`);
            return username;
        }
        else {
            // If we couldn't find the username with our first approach, try a more specific selector
            logger_1.default.warn("Username not found with primary selector, trying alternative...");
            // This more specific selector targets the exact span with the username
            const alternativeSelector = 'div.x9f619 div.xamitd3 span[dir="auto"][style*="20px"]';
            try {
                await page.waitForSelector(alternativeSelector, { timeout: 5000 });
                const altUsername = await page.evaluate((sel) => {
                    const element = document.querySelector(sel);
                    return element?.textContent?.trim() || null;
                }, alternativeSelector);
                if (altUsername) {
                    logger_1.default.info(`Username found with alternative selector: ${altUsername}`);
                    return altUsername;
                }
            }
            catch (err) {
                logger_1.default.warn("Alternative selector failed:", err);
            }
            logger_1.default.warn("Username not found on edit page");
            return "instagram_user";
        }
    }
    catch (error) {
        logger_1.default.error("Error getting username from edit page:", error);
        try {
            // For debugging purposes, save a screenshot
            await page.screenshot({ path: 'instagram-username-error.png' });
            logger_1.default.info("Debug screenshot saved");
        }
        catch (e) {
            // Ignore screenshot errors
        }
        return "instagram_user";
    }
}
// Helper function to get username from userId
async function getUsernameFromUserId(userId) {
    try {
        const accountsCollection = (0, db_1.getAccountsCollection)();
        const account = await accountsCollection.findOne({
            userId,
            platform: 'instagram'
        });
        return account?.username || null;
    }
    catch (error) {
        logger_1.default.error(`Error getting username from userId ${userId}:`, error);
        return null;
    }
}
async function fetchInstagramUsername(usernameSelector = 'span[dir="auto"][style*="--lineHeight: 20px"]') {
    let browser;
    let page;
    try {
        // 1. Create new browser instance
        const result = await initBrowser();
        browser = result.browser;
        page = result.page;
        const cookiesPath = './cookies/Instagramcookies.json';
        if (!fs_1.default.existsSync(cookiesPath)) {
            logger_1.default.error('Cookies file not found. Run login flow first.');
            return { success: false, message: 'Cookies file not found' };
        }
        const cookies = JSON.parse(fs_1.default.readFileSync(cookiesPath, 'utf8'));
        await Promise.all(cookies.map((c) => page.setCookie(c)));
        logger_1.default.info('Cookies loaded.');
        // 2. Navigate to Instagram
        await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
        logger_1.default.info('Navigated to Instagram.');
        // 3. Get username
        const username = await getInstagramUsername(page, usernameSelector);
        logger_1.default.info(`Username found: ${username}`);
        // 4. Optionally save it
        fs_1.default.writeFileSync('./cookies/InstagramUsername.json', JSON.stringify({ username }, null, 2), 'utf8');
        await browser.close();
        return { success: true, username, message: 'Username retrieved successfully' };
    }
    catch (err) {
        // Error handling...
        return { success: false, message: err.message };
    }
    finally {
        // Make sure browser is closed in all cases
        if (browser) {
            try {
                await browser.close();
            }
            catch (closeErr) {
                logger_1.default.error('Error closing browser:', closeErr);
            }
        }
    }
}
async function commentOnPostById(postId, comment) {
    let browser;
    let page;
    let screenshotPath = `debug_${postId}_${Date.now()}.png`;
    try {
        const result = await initBrowser();
        browser = result.browser;
        page = result.page;
        // Load cookies from the file instead of logging in with credentials
        const cookiesPath = './cookies/Instagramcookies.json';
        if (fs_1.default.existsSync(cookiesPath)) {
            const cookiesString = fs_1.default.readFileSync(cookiesPath, 'utf8');
            const cookies = JSON.parse(cookiesString);
            for (const cookie of cookies) {
                await page.setCookie(cookie);
            }
            logger_1.default.info("Cookies loaded successfully. Using them to authenticate.");
        }
        else {
            logger_1.default.error('Cookies file does not exist. Run the login process to create it.');
            return { success: false, message: "Cookies file not found" };
        }
        // Naviguer vers le post
        const postUrl = `https://www.instagram.com/p/${postId}/`;
        logger_1.default.info(`Navigating to post: ${postUrl}`);
        await page.goto(postUrl, { waitUntil: 'networkidle2' });
        await delay(3000);
        // Fermer le popup si présent
        const popupEl = await page.$(popupCloseSelector);
        if (popupEl) {
            logger_1.default.info("Popup detected, attempting to close it.");
            await popupEl.click();
            await delay(1000);
        }
        // Liker le post (code existant)
        // ...
        const likeButton = await page.$(likeButtonSelector);
        if (likeButton) {
            const ariaLabel = await likeButton.evaluate(el => el.getAttribute("aria-label"));
            if (ariaLabel === "Like") {
                await page.evaluate(button => {
                    button.scrollIntoView({ behavior: "instant", block: "center" });
                    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }, likeButton);
                logger_1.default.info(`Post ${postId} liked.`);
            }
        }
        // Zone de commentaire
        const commentBox = await page.$(commentBoxSelector);
        if (!commentBox) {
            logger_1.default.error("Comment box not found.");
            return { success: false, message: 'Comment box not found' };
        }
        logger_1.default.info(`Found comment box for post ${postId}.`);
        await commentBox.click();
        await page.type(commentBoxSelector, comment);
        logger_1.default.info(`Posting comment: "${comment}"`);
        // Capture d'écran avant de cliquer sur Post
        // Rechercher et cliquer sur le bouton "Post"
        const postButtonHandle = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
            return buttons.find((button) => button.textContent?.trim() === 'Post' && !button.hasAttribute('disabled'));
        });
        if (postButtonHandle) {
            logger_1.default.info(`Clicking Post button for post ${postId}...`);
            await postButtonHandle.click();
            logger_1.default.info(`Comment action completed for post ${postId}.`);
            // Attendre et vérifier que le commentaire est bien posté
            await delay(2000);
            return { success: true, message: 'Comment posted successfully' };
        }
        else {
            logger_1.default.error('Post button not found');
            return { success: false, message: 'Post button not found' };
        }
    }
    catch (error) {
        logger_1.default.error(`Error posting comment on post ${postId}:`, error);
        // Ne prendre une capture d'écran que si la page est toujours valide
        try {
            if (page && browser && browser.isConnected()) {
            }
        }
        catch (screenshotError) {
            logger_1.default.error(`Failed to take error screenshot: ${screenshotError}`);
        }
        return { success: false, message: `Error: ${error}` };
    }
    finally {
        // S'assurer que le navigateur est toujours fermé
        try {
            if (browser && browser.isConnected()) {
                await browser.close();
                logger_1.default.info(`Browser closed after comment operation`);
            }
        }
        catch (closeError) {
            logger_1.default.error(`Error closing browser: ${closeError}`);
        }
    }
}
// -------------------------------------------------------
// Controller Endpoints
// -------------------------------------------------------
const getAllComments = async (req, res) => {
    try {
        await (0, db_1.connectToDatabase)();
        // Get username from query parameter
        const username = typeof req.query.username === 'string' ? req.query.username : undefined;
        if (!username) {
            res.status(400).json({ message: 'username parameter is required' });
            return;
        }
        const commentsCollection = (0, db_1.getCommentsCollection)();
        // Query comments directly using the username field
        const comments = await commentsCollection
            .find({ username }) // Find comments by the username
            .toArray();
        // If no comments found
        if (comments.length === 0) {
            res.status(404).json({ message: `No comments found for username: ${username}` });
            return;
        }
        // Format the comments before sending back to the client
        const formatted = comments.map(c => ({
            id: c._id.toString(), // Convert _id to string
            userId: c.userId,
            postId: c.postId,
            postUsername: c.postUsername,
            postCaption: c.caption ?? c.Caption,
            comment: c.comment,
            timestamp: c.timestamp ?? c.createdAt,
            status: c.status ?? 'pending',
            model: c.model ?? 'llama3.1',
            username: c.username,
            history: c.history || []
        }));
        res.status(200).json(formatted);
    }
    catch (error) {
        logger_1.default.error('Error fetching comments:', error);
        res.status(500).json({ message: 'Failed to fetch comments' });
    }
};
exports.getAllComments = getAllComments;
const getCommentById = async (req, res) => {
    try {
        await (0, db_1.connectToDatabase)();
        const { id } = req.params;
        const userId = typeof req.query.userId === 'string'
            ? req.query.userId
            : undefined;
        const coll = (0, db_1.getCommentsCollection)();
        const filter = { _id: new mongodb_1.ObjectId(id) };
        if (userId)
            filter.userId = userId;
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
            id: c._id.toString(),
            userId: c.userId,
            postId: c.postId,
            postCaption: c.caption,
            comment: c.comment,
            timestamp: c.timestamp,
            status: c.status ?? 'pending',
            model: c.model ?? 'llama3.1',
            username
        });
    }
    catch (e) {
        logger_1.default.error('Error fetching comment:', e);
        res.status(500).json({ message: 'Failed to fetch comment' });
    }
};
exports.getCommentById = getCommentById;
const instagramLogin = async (req, res) => {
    let instBrowser = null;
    try {
        // Extract username from request body or query parameters
        const { username } = req.body || req.query;
        if (!username) {
            res.status(400).json({ message: "Username is required" });
            return;
        }
        // Enhanced browser launch options for cross-environment compatibility
        const browserOptions = {
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=secure',
                '--allow-running-insecure-content',
                '--disable-blink-features=AutomationControlled',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images',
                '--disable-javascript-harmony-shipping',
                '--disable-client-side-phishing-detection',
                '--disable-sync',
                '--disable-default-apps',
                '--hide-scrollbars',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--force-fieldtrials=*BackgroundTracing/default/',
                '--no-default-browser-check',
                '--no-pings',
                '--password-store=basic',
                '--use-mock-keychain'
            ],
            ignoreDefaultArgs: ['--enable-automation'],
            // Set executable path if needed (uncomment and adjust for your system)
            // executablePath: '/usr/bin/google-chrome-stable', // Linux
            // executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
        };
        // Add Windows-specific options if running on Windows
        if (process.platform === 'win32') {
            browserOptions.args.push('--disable-gpu-sandbox');
        }
        // Launch browser with enhanced options
        instBrowser = await puppeteer_extra_1.default.launch(browserOptions);
        const instPage = await instBrowser.newPage();
        // Set a realistic viewport and user agent
        await instPage.setViewport({ width: 1366, height: 768 });
        await instPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        // Set additional page properties to avoid detection
        await instPage.evaluateOnNewDocument(() => {
            delete window.navigator.webdriver;
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
        });
        // Set extra HTTP headers
        await instPage.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        });
        // Accès à la page de login d'Instagram
        await instPage.goto("https://www.instagram.com/accounts/login/", { waitUntil: 'networkidle2' });
        // Wait for manual login
        try {
            await instPage.waitForSelector("a[href='/direct/inbox/']", { timeout: 60000 });
            logger_1.default.info("Connexion détectée (lien de messagerie présent).");
        }
        catch (e) {
            logger_1.default.warn("Lien de messagerie non détecté dans les 60s, attente additionnelle de 10s.");
            await delay(10000);
        }
        // Sauvegarde des cookies (contenant les informations de connexion)
        const cookies = await instPage.cookies();
        // 2. Save cookies to database with the username
        try {
            const db = await (0, db_1.connectToDatabase)();
            const accountsCollection = (0, db_1.getAccountsCollection)();
            // Update the account document with Instagram cookies
            const result = await accountsCollection.updateOne({ username: username }, {
                $set: {
                    instagramCookies: cookies,
                    instagramLastUpdate: new Date()
                }
            }, { upsert: true });
            logger_1.default.info(`Cookies Instagram sauvegardés en base de données pour l'utilisateur ${username}.`);
            logger_1.default.debug(`Résultat de l'opération DB: ${result.modifiedCount} document(s) modifié(s), ${result.upsertedCount} document(s) créé(s).`);
        }
        catch (dbError) {
            logger_1.default.error("Erreur lors de la sauvegarde des cookies en base de données:", dbError);
        }
        // Fermer le navigateur après la connexion
        await instBrowser.close();
        res.status(200).json({
            message: "Instagram login completed. Cookies saved.",
            username: username
        });
    }
    catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger_1.default.error("Erreur lors de la connexion à Instagram:", errMsg);
        // Ensure browser is closed even on error
        if (instBrowser) {
            try {
                await instBrowser.close();
            }
            catch (closeError) {
                logger_1.default.error("Error closing browser:", closeError);
            }
        }
        res.status(500).json({ message: "Échec de la connexion à Instagram.", error: errMsg });
    }
};
exports.instagramLogin = instagramLogin;
const setInstagramUsername = async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            res.status(400).json({ message: 'Username is required' });
            return;
        }
        // Get userId from authenticated user using the correct type
        const userId = req.isAuthenticated() ? req.user._id : undefined;
        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }
        await (0, db_1.connectToDatabase)();
        const accountsCollection = (0, db_1.getAccountsCollection)();
        const commentsCollection = (0, db_1.getCommentsCollection)();
        const existingAccount = await accountsCollection.findOne({
            userId,
            platform: 'instagram'
        });
        if (existingAccount) {
            // Update username on existing account
            await accountsCollection.updateOne({ _id: existingAccount._id }, {
                $set: {
                    username,
                    updatedAt: new Date()
                }
            });
            // Update username on all comments by this user
            await commentsCollection.updateMany({ userId: userId.toString() }, { $set: { username } });
            logger_1.default.info(`Instagram username updated for user ${userId}: ${username}`);
        }
        else {
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
            await commentsCollection.updateMany({ userId: userId.toString() }, { $set: { username } });
            logger_1.default.info(`New Instagram account recorded for user ${userId}: ${username}`);
        }
        res.status(200).json({
            success: true,
            message: `Instagram username ${username} saved successfully`
        });
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger_1.default.error(`Error saving Instagram username: ${errorMsg}`);
        res.status(500).json({
            success: false,
            message: 'Failed to save Instagram username',
            error: errorMsg
        });
    }
};
exports.setInstagramUsername = setInstagramUsername;
const getInstagramStatus = async (req, res) => {
    try {
        const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
        if (!userId) {
            res.status(400).json({ message: 'userId parameter is required' });
            return;
        }
        await (0, db_1.connectToDatabase)();
        const accountsCollection = (0, db_1.getAccountsCollection)();
        const account = await accountsCollection.findOne({
            userId,
            platform: 'instagram'
        });
        // Check if we have valid cookies
        const cookiesPath = './cookies/Instagramcookies.json';
        const cookiesExist = fs_1.default.existsSync(cookiesPath);
        // Determine login status
        let loggedIn = false;
        if (account && cookiesExist) {
            try {
                const cookies = JSON.parse(fs_1.default.readFileSync(cookiesPath, 'utf8'));
                loggedIn = cookies.length > 0;
            }
            catch (e) {
                logger_1.default.error('Error reading cookies file:', e);
            }
        }
        res.status(200).json({
            loggedIn,
            username: account?.username || null,
            hasAccount: !!account
        });
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger_1.default.error(`Error checking Instagram status: ${errorMsg}`);
        res.status(500).json({
            success: false,
            message: 'Failed to check Instagram status',
            error: errorMsg
        });
    }
};
exports.getInstagramStatus = getInstagramStatus;
const rejectComment = async (req, res) => {
    try {
        await (0, db_1.connectToDatabase)();
        const { id } = req.params;
        const coll = (0, db_1.getCommentsCollection)();
        const filter = { _id: new mongodb_1.ObjectId(id) };
        const r = await coll.deleteOne(filter);
        if (r.deletedCount === 0) {
            res.status(404).json({ message: 'Comment not found' });
            return;
        }
        res.status(200).json({ message: 'Comment rejected' });
    }
    catch (e) {
        logger_1.default.error('Error rejecting comment:', e);
        res.status(500).json({ message: 'Failed to reject comment' });
    }
};
exports.rejectComment = rejectComment;
const postComment = async (req, res) => {
    try {
        await (0, db_1.connectToDatabase)();
        const { id } = req.params;
        const coll = (0, db_1.getCommentsCollection)();
        const filter = { _id: new mongodb_1.ObjectId(id) };
        // Verify the comment exists
        const comment = await coll.findOne(filter);
        if (!comment) {
            res.status(404).json({ message: 'Comment not found' });
            return;
        }
        // Mark it for processing and update timestamp
        await coll.updateOne(filter, { $set: { status: 'processing', lastUpdated: new Date() } });
        // Respond immediately—your background worker will pick this up
        res.status(200).json({ message: 'Comment queued for processing' });
    }
    catch (e) {
        logger_1.default.error('Error queueing comment for processing:', e);
        res.status(500).json({ message: 'Failed to queue comment' });
    }
};
exports.postComment = postComment;
const updateComment = async (req, res) => {
    try {
        await (0, db_1.connectToDatabase)();
        const { id } = req.params;
        const { comment: newComment } = req.body;
        if (!newComment?.trim()) {
            res.status(400).json({ message: 'Invalid comment' });
            return;
        }
        const coll = (0, db_1.getCommentsCollection)();
        const filter = { _id: new mongodb_1.ObjectId(id) };
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
        const updateData = {
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
    }
    catch (e) {
        logger_1.default.error('Error updating comment:', e);
        res.status(500).json({ message: 'Failed to update comment' });
    }
};
exports.updateComment = updateComment;
const approveComment = async (req, res) => {
    try {
        await (0, db_1.connectToDatabase)();
        const { id } = req.params;
        const coll = (0, db_1.getCommentsCollection)();
        // Updated filter to only use the comment ID
        const filter = { _id: new mongodb_1.ObjectId(id), status: 'pending' };
        const comment = await coll.findOne(filter);
        if (!comment) {
            res.status(404).json({ message: 'Pending comment not found' });
            return;
        }
        // Get username if not present
        let updateData = { status: 'approved' };
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
    }
    catch (e) {
        logger_1.default.error('Error approving comment:', e);
        res.status(500).json({ message: 'Failed to approve comment' });
    }
};
exports.approveComment = approveComment;
// Utility function to safely convert user ID
function safeUserIdToString(user) {
    return user?._id?.toString();
}
const saveFilteredUser = async (req, res) => {
    try {
        // Get targetUsername from request body (sent from frontend)
        const { targetUsername: rawTarget, username } = req.body;
        console.log(req.body);
        // Validate targetUsername
        if (!rawTarget) {
            res.status(400).json({ success: false, message: 'Target username is required' });
            return;
        }
        // Normalize target username
        const targetUsername = rawTarget.trim().replace(/^@/, '').toLowerCase();
        // Validate main username (from frontend stateManager)
        if (!username) {
            res.status(400).json({ success: false, message: 'Instagram username is required' });
            return;
        }
        // Removed authentication check as requested
        await (0, db_1.connectToDatabase)();
        const accounts = (0, db_1.getAccountsCollection)();
        // Find the account directly using username
        const account = await accounts.findOne({
            platform: 'instagram',
            username
        });
        if (!account) {
            res.status(400).json({
                success: false,
                message: `No Instagram account found for username: ${username}`
            });
            return;
        }
        // Check for existing filter
        const existingFilters = account.filteredUsers ?? [];
        if (existingFilters.some((f) => f.targetUsername === targetUsername)) {
            res.status(400).json({
                success: false,
                message: `Youre already tracking @${targetUsername}`
            });
            return;
        }
        // Create new filter
        const newFilter = {
            _id: new mongodb_1.ObjectId(),
            targetUsername,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            lastChecked: null
        };
        // Update database - using username as identifier instead of userId
        const result = await accounts.updateOne({ platform: 'instagram', username }, {
            $push: { filteredUsers: newFilter },
            $set: { updatedAt: new Date() }
        });
        if (result.modifiedCount === 0) {
            res.status(500).json({ success: false, message: 'Failed to add filtered user' });
            return;
        }
        logger_1.default.info(`User ${username} added filtered user: ${targetUsername}`);
        res.status(200).json({
            success: true,
            message: `Successfully added @${targetUsername} to your filters`,
            id: newFilter._id.toString()
        });
        console.log("flag");
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger_1.default.error(`Error saving filtered user: ${msg}`);
        res.status(500).json({
            success: false,
            message: 'Failed to save filtered user',
            error: msg
        });
    }
};
exports.saveFilteredUser = saveFilteredUser;
const getFilteredUsers = async (req, res) => {
    try {
        const username = typeof req.query.username === 'string' ? req.query.username : undefined;
        console.log(req.query);
        if (!username) {
            res.status(400).json({ message: 'username parameter is required' });
            return;
        }
        await (0, db_1.connectToDatabase)();
        const accounts = (0, db_1.getAccountsCollection)();
        // Find account by username
        const account = await accounts.findOne({ username, platform: 'instagram' });
        if (!account) {
            res.status(404).json({ message: 'Account not found for username: ' + username });
            return;
        }
        // Extract just the targetUsernames from filteredUsers array
        const targetUsernames = account.filteredUsers?.map((user) => user.targetUsername) || [];
        res.status(200).json({ targetUsernames });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger_1.default.error(`Error fetching target usernames: ${msg}`);
        res.status(500).json({ message: 'Failed to fetch target usernames', error: msg });
    }
};
exports.getFilteredUsers = getFilteredUsers;
const deleteFilteredUser = async (req, res) => {
    try {
        // Get the targetUsername from params
        const { targetUsername } = req.params;
        if (!targetUsername) {
            res.status(400).json({ success: false, message: 'Target username is required' });
            return;
        }
        // Get username from query parameters using the exact method provided
        const username = typeof req.query.username === 'string' ? req.query.username : undefined;
        console.log(req.query);
        if (!username) {
            res.status(400).json({ message: 'username parameter is required' });
            return;
        }
        await (0, db_1.connectToDatabase)();
        const accounts = (0, db_1.getAccountsCollection)();
        // Find account by username
        const account = await accounts.findOne({ username, platform: 'instagram' });
        if (!account) {
            res.status(404).json({
                success: false,
                message: `Account with username "${username}" not found`
            });
            return;
        }
        // Update the account to remove the targetUsername from filteredUsers
        // Fixed $pull operator syntax
        const result = await accounts.updateOne({ _id: account._id }, {
            $pull: { filteredUsers: { targetUsername } },
            $set: { updatedAt: new Date() }
        });
        if (result.modifiedCount === 0) {
            res.status(404).json({
                success: false,
                message: `User "${targetUsername}" not found in filtered list`
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: `User "${targetUsername}" removed successfully from filtered users`
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger_1.default.error(`Error deleting filtered user by username: ${msg}`);
        res.status(500).json({
            success: false,
            message: 'Failed to delete filtered user',
            error: msg
        });
    }
};
exports.deleteFilteredUser = deleteFilteredUser;
