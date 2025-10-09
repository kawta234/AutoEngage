import { Browser, DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import { Server } from "proxy-chain";
import { IGpassword, IGusername } from "../secret";
import logger from "../config/logger";
import { Instagram_cookiesExist, loadCookies, saveCookies } from "../utils";
import { interactWithOllama } from "../ollama_interact"; // Ajustez le chemin si nécessaire
import { checkTargetUsernameMatch, getInstagramCookiesByUsername } from "./agentcontroller";

// --------------------------
// Déclaration globale des sélecteurs
// --------------------------
const postSelector = (index: number): string => `article:nth-of-type(${index + 1})`;

const captionSelectors: string[] = [
  'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.xt0psk2.x1i0vuye.xvs91rp.xo1l8bm.x5n08af.x10wh9bi.xpm28yp.x8viiok.x1o7cslx.x126k92a',];

const moreLinkSelector: string = 'span.x1lliihq';


// --------------------------
// Initialisation des plugins Puppeteer
// --------------------------
puppeteer.use(StealthPlugin());
puppeteer.use(
  AdblockerPlugin({
    interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
  })
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export async function runInstagram(username: string, minPort: number = 6000, maxPort: number = 7000): Promise<void> {
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
      protocolTimeout: 180000, 
      args: [
        `--proxy-server=${proxyUrl}`,
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
    
    const page = await browser.newPage();
    
    // Get Instagram cookies for the provided username
    const cookiesData = await getInstagramCookiesByUsername(username);
    if (!cookiesData || !cookiesData.cookies) {
      throw new Error("Could not retrieve Instagram cookies");
    }
    
    const cookies = cookiesData.cookies;
    
    logger.info(`Started proxy server for ${username} on port ${port}`);

    // First navigate to Instagram without cookies
    logger.info(`Navigating to Instagram homepage for ${username}...`);
    await page.goto("https://www.instagram.com/", { 
      waitUntil: "networkidle2",
      timeout: 60000 // Increase timeout to 60 seconds
    });
    
    // Apply cookies
    logger.info(`Applying cookies for ${username}...`);
    await page.setCookie(...cookies);
    logger.info(`Cookies applied successfully for ${username}`);
    
    // Reload the page to use the cookies
    await page.reload({ waitUntil: "networkidle2" });
    
    // Wait for a clear indication that we're logged in
    try {
      await page.waitForSelector("a[href='/direct/inbox/']", { timeout: 10000 });
      logger.info(`Logged into Instagram as ${username} via cookies.`);
    } catch (e) {
      logger.error(`Cookies invalid or expired for ${username}`);
      throw new Error(`Failed to log in as ${username}`);
    }
   while (true) {
    try {
      // Main feed-processing loop
      const targetCount = 500;
      const processedIDs = new Set<string>();

      while (processedIDs.size < targetCount) {
        await page.goto("https://www.instagram.com/", { waitUntil: "networkidle2" });
      await delay(2000);

      const postIDs = await extractPostIDs(page);
      const newIDs = postIDs.filter(id => !processedIDs.has(id));
      
      if (newIDs.length === 0) {
        logger.info("No new posts, scrolling...");
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await delay(3000);
        continue;
      }

      for (const postId of newIDs) {
        if (processedIDs.size >= targetCount) break;
        
        await generateCommentForPost(page, postId, username);
        await delay(2000); // Délai entre les deux générations
        await generateCommentForPost2(page, postId, username);
        
        processedIDs.add(postId);
        logger.info(`Processed post ${postId} as ${username} (${processedIDs.size}/${targetCount})`);
        await delay(5000);
      }

      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await delay(3000);
    
      }
      logger.info(`Completed a batch of ${targetCount} posts for ${username}. Starting a new batch...`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error in batch processing for ${username}: ${errorMessage}`);
      logger.info(`Restarting batch in 30 seconds...`);
      await delay(30000); // Attendre 30 secondes avant de redémarrer
    }
  }
} catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error(`Instagram agent error: ${errorMessage}`);
  } finally {
    // Cleanup resources
    if (browser) await browser.close();
    if (proxyServer) await proxyServer.close(true);
  }
}

// ACTION 1 : Extraire les IDs des posts du fil d'actualité et les stocker dans un tableau
async function extractPostIDs(page: any): Promise<string[]> {
  const postIDs: string[] = [];
  try {
    await page.waitForSelector("article", { timeout: 30000 });
  } catch (error) {
    console.error("Erreur lors de l'attente du sélecteur 'article' :", error);
    return postIDs;
  }

  // Récupérer tous les articles visibles
  const posts = await page.$$("article");
  for (let index = 0; index < posts.length; index++) {
    const currentPostSelector = postSelector(index);
    let postId = await page.evaluate((selector: string) => {
      const article = document.querySelector(selector);
      if (article) {
        const link = article.querySelector('a[href*="/p/"]');
        if (link) {
          const href = link.getAttribute("href");
          if (href) {
            const match = href.match(/\/p\/([^\/]+)\//);
            return match ? match[1] : "";
          }
        }
      }
      return "";
    }, currentPostSelector);
    if (postId && postId.trim().length > 0) {
      postIDs.push(postId);
    }
  }
  return postIDs;
}

// ACTION 2 : Ouvrir le post par son ID, liker le post et générer un commentaire pour sa légende
async function generateCommentForPost(page: any, postId: string, connectedUsername: string) {
  const postUrl = `https://www.instagram.com/p/${postId}/`;
  await page.goto(postUrl, { waitUntil: "networkidle2" });
  await delay(2000); // Attendre le chargement du contenu
  let postUsername = "";
  const usernameSelectors = [
    'a[href*="/"][role="link"]', // Sélecteur général basé sur votre HTML
    'h2.x6s0dn4 a', // Sélecteur spécifique basé sur votre exemple
    'span.xt0psk2 a', // Alternative basée sur votre HTML
    '.x1i10hfl.xjqpnuy.xa49m3k[role="link"]', // Sélecteur de classe détaillé basé sur votre HTML
    'article header a[role="link"]' // Autre possibilité de structure
  ];

  // Essayer chaque sélecteur de nom d'utilisateur jusqu'à obtenir un résultat non vide
  for (const sel of usernameSelectors) {
    try {
      const usernameElement = await page.$(sel);
      if (usernameElement) {
        postUsername = await usernameElement.evaluate((el: HTMLElement) => el.innerText.trim());
        if (postUsername && postUsername.trim().length > 0) {
          logger.info(`Nom d'utilisateur du post trouvé avec le sélecteur "${sel}" : ${postUsername}`);
          break;
        }
      }
    } catch (error) {
      // Continue avec le prochain sélecteur en cas d'erreur
      continue;
    }
  }

  // Si aucun sélecteur n'a fonctionné, essayer l'extraction via le titre de la page
  if (!postUsername || postUsername.trim().length === 0) {
    try {
      postUsername = await page.evaluate(() => {
        const titleText = document.title;
        // Format typique: "Nom d'utilisateur sur Instagram: "caption du post""
        const match = titleText.match(/^([^:]+) on Instagram/);
        return match ? match[1].trim() : "";
      });
      
      if (postUsername && postUsername.trim().length > 0) {
        logger.info(`Nom d'utilisateur du post extrait du titre de la page : ${postUsername}`);
      }
    } catch (error) {
      logger.warn("Erreur lors de l'extraction du nom d'utilisateur du post via le titre:", error);
    }
  }
  const { matched, accountData } = await checkTargetUsernameMatch(postUsername, connectedUsername);
  
  if (!matched) {
    logger.info(`Post username "${postUsername}" is not in our target list. Skipping...`);
    return;
  }

  logger.info(`Post username "${postUsername}" is in our target list. Proceeding...`);

  // Rest of your existing code for caption extraction and comment generation...
  
  let caption = "";
  // Essayer chaque sélecteur de légende jusqu'à obtenir une légende non vide
  for (const sel of captionSelectors) {
    const captionElement = await page.$(sel);
    if (captionElement) {
      caption = await captionElement.evaluate((el: HTMLElement) => el.innerText);
      if (caption && caption.trim().length > 0) {
        console.log(`Légende trouvée avec le sélecteur "${sel}" : ${caption}`);
        break;
      }
    } 
  }
  if (!caption || caption.trim().length === 0) {
    console.log(`Aucune légende trouvée pour le post ${postId}. Abandon de la génération de commentaire.`);
    return;
  }

  // Si un lien "more" est présent, cliquer pour étendre la légende
  const moreLink = await page.$(moreLinkSelector);
  if (moreLink) {
    console.log(`Extension de la légende pour le post ${postId}...`);
    await moreLink.click();
    await delay(1000);
    // Re-vérifier avec les mêmes sélecteurs pour récupérer la légende étendue
    for (const sel of captionSelectors) {
      const captionElement = await page.$(sel);
      if (captionElement) {
        caption = await captionElement.evaluate((el: HTMLElement) => el.innerText);
        if (caption && caption.trim().length > 0) {
          console.log(`Légende étendue trouvée avec le sélecteur "${sel}" : ${caption}`);
          break;
        }
      }
    }
  }

  // Construction du prompt pour la génération de commentaire
  const prompt = `Objective: Build community & engagement
  Tone: Warm, encouraging, supportive
  Content Style:\n• Casual and approachable
  • Positive reinforcement\n• Emoji usage
  • Short and sweet\nResult:
  ✅ High engagement & reach
  Read the ${caption}
  You are a thoughtful and friendly commentator who generates warm, uplifting, and engaging comments that make creators feel seen and appreciated.
    Your goal is to build connection and spark friendly dialogue in the comments section.
    Analysis Process:
    1. Identify the main emotion or message of the caption.y
    2. Reflect genuine appreciation or encouragement.
    3. Add a light personal touch or relatable reaction.
    4. Optionally include a friendly emoji or two (😊✨🙌❤️🔥💪).
    NO hashtags.\nRespond only with valid JSON. No introduction or explanation.
    Given the caption below—which may include bullet points, narratives, or multi-language sections—create a comment that:
    • Feels authentic and personal.
    • Spreads positivity and warmth.
    • Adds a small personal insight or supportive reaction.
    • Keeps a conversational and natural tone.
    • Optionally uses emojis to convey friendliness.
   
    Key Guidelines:\n\n• Keep it short and positive (10–15 words)
    • Use casual, real-world tone\n• Avoid sarcasm, negativity, or deep critique
    • Use emojis sparingly (1–3 max)
    • NO hashtags (ignore any from caption)
    • Show empathy and genuine interest
    NO em dashes (—) - use periods, commas, or other punctuation instead
    • Encourage continued sharing or conversation
    Output Format:\nGenerate one friendly comment based on this caption: \"{caption}\"/
    [\n  {\n    \"comment\": \"Your friendly reply here 😊\",\n    \"viralRate\": 90,\n    \"commentTokenCount\": 20\n  }\n]
    nOriginal Post: \"${caption}\""`;

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
      postId,
      caption,
      undefined, 
      postUsername,   // userId is undefined here
      connectedUsername  ,
      "instagram"
  );
    // Extraire le commentaire généré
    let extractedComment = "";
    try {
      const jsonResult =
        typeof result.response === "string"
          ? JSON.parse(result.response)
          : result;
      extractedComment = Array.isArray(jsonResult)
        ? jsonResult[0]?.comment
        : jsonResult?.comment;
    } catch (e) {
      console.log("Impossible d'extraire le commentaire pour la journalisation");
    }
    if (extractedComment) {
      console.log(`Commentaire généré pour le post ${postId} par ${connectedUsername}: "${extractedComment}"`);
    } else {
      console.log(`Commentaire généré pour le post ${postId}`);
    }
    
    // Ici, vous pourriez ajouter le code pour réellement poster le commentaire
  } catch (error) {
    console.error(`Erreur lors de la génération du commentaire pour le post ${postId} :`, error);
  }
}
async function generateCommentForPost2(page: any, postId: string, connectedUsername: string) {
  const postUrl = `https://www.instagram.com/p/${postId}/`;
  await page.goto(postUrl, { waitUntil: "networkidle2" });
  await delay(2000); // Attendre le chargement du contenu
  let postUsername = "";
  const usernameSelectors = [
    'a[href*="/"][role="link"]', // Sélecteur général basé sur votre HTML
    'h2.x6s0dn4 a', // Sélecteur spécifique basé sur votre exemple
    'span.xt0psk2 a', // Alternative basée sur votre HTML
    '.x1i10hfl.xjqpnuy.xa49m3k[role="link"]', // Sélecteur de classe détaillé basé sur votre HTML
    'article header a[role="link"]' // Autre possibilité de structure
  ];

  // Essayer chaque sélecteur de nom d'utilisateur jusqu'à obtenir un résultat non vide
  for (const sel of usernameSelectors) {
    try {
      const usernameElement = await page.$(sel);
      if (usernameElement) {
        postUsername = await usernameElement.evaluate((el: HTMLElement) => el.innerText.trim());
        if (postUsername && postUsername.trim().length > 0) {
          logger.info(`Nom d'utilisateur du post trouvé avec le sélecteur "${sel}" : ${postUsername}`);
          break;
        }
      }
    } catch (error) {
      // Continue avec le prochain sélecteur en cas d'erreur
      continue;
    }
  }

  // Si aucun sélecteur n'a fonctionné, essayer l'extraction via le titre de la page
  if (!postUsername || postUsername.trim().length === 0) {
    try {
      postUsername = await page.evaluate(() => {
        const titleText = document.title;
        // Format typique: "Nom d'utilisateur sur Instagram: "caption du post""
        const match = titleText.match(/^([^:]+) on Instagram/);
        return match ? match[1].trim() : "";
      });
      
      if (postUsername && postUsername.trim().length > 0) {
        logger.info(`Nom d'utilisateur du post extrait du titre de la page : ${postUsername}`);
      }
    } catch (error) {
      logger.warn("Erreur lors de l'extraction du nom d'utilisateur du post via le titre:", error);
    }
  }
  const { matched, accountData } = await checkTargetUsernameMatch(postUsername, connectedUsername);
  
  if (!matched) {
    logger.info(`Post username "${postUsername}" is not in our target list. Skipping...`);
    return;
  }

  logger.info(`Post username "${postUsername}" is in our target list. Proceeding...`);

  // Rest of your existing code for caption extraction and comment generation...
  
  let caption = "";
  // Essayer chaque sélecteur de légende jusqu'à obtenir une légende non vide
  for (const sel of captionSelectors) {
    const captionElement = await page.$(sel);
    if (captionElement) {
      caption = await captionElement.evaluate((el: HTMLElement) => el.innerText);
      if (caption && caption.trim().length > 0) {
        console.log(`Légende trouvée avec le sélecteur "${sel}" : ${caption}`);
        break;
      }
    } 
  }
  if (!caption || caption.trim().length === 0) {
    console.log(`Aucune légende trouvée pour le post ${postId}. Abandon de la génération de commentaire.`);
    return;
  }

  // Si un lien "more" est présent, cliquer pour étendre la légende
  const moreLink = await page.$(moreLinkSelector);
  if (moreLink) {
    console.log(`Extension de la légende pour le post ${postId}...`);
    await moreLink.click();
    await delay(1000);
    // Re-vérifier avec les mêmes sélecteurs pour récupérer la légende étendue
    for (const sel of captionSelectors) {
      const captionElement = await page.$(sel);
      if (captionElement) {
        caption = await captionElement.evaluate((el: HTMLElement) => el.innerText);
        if (caption && caption.trim().length > 0) {
          console.log(`Légende étendue trouvée avec le sélecteur "${sel}" : ${caption}`);
          break;
        }
      }
    }
  }

  // Construction du prompt pour la génération de commentaire
  const prompt = `Respond only with valid JSON. No introduction or explanation.

Read the ${caption} 
You are a thoughtful commentator who generates engaging, contrarian comments that challenge assumptions while respecting the creator's work. Your goal is to spark meaningful dialogue with the creator without undermining their authority in front of their audience.
Analysis Process:

Identify the main topic and underlying assumptions in the caption
Find a contrarian angle or alternative perspective
Research recent information or trends related to the topic (cross-pollination)
Connect to broader societal patterns or systemic issues
Craft a response that honors the creator's effort while opening debate
NO hashtags
Respond only with valid JSON. No introduction or explanation.

Given the caption below—which may include bullet points, narratives, or multi-language sections—create an engaging comment that:

Shows genuine interest in the topic.
Adds value through personal insight.
Shares a personal insight or experience.
Maintains a professional yet friendly tone.
References specific content points.
Optionally tags relevant accounts.

Example structure:
"[Observation about content] + [Personal insight/connection] + [Personal insight or experience]"

Key Guidelines:

Write naturally and conversationally (avoid placeholder brackets or template formats)
Protect creator's authority: Frame challenges as additions/extensions rather than contradictions
Present alternative perspectives as "what if" scenarios or complementary angles
Avoid direct disagreement that could undermine credibility in front of followers
Use natural punctuation instead of em dashes
STRICTLY NO hashtags in your comments (ignore any hashtags from the original caption)
Include cross-pollination with recent relevant information when possible
Aim to create intellectual curiosity, not doubt about the creator's expertise
 Requirements:

Short punchy statements (20-50 characters) OR longer analytical paragraphs (50-100 characters)
Natural, conversational tone (avoid titles, headers, or formal structures)
NO em dashes (—) - use periods, commas, or other punctuation instead
NO hashtags in comments (ignore hashtags from original caption)
Output Format:
Generate one thoughtful comment based on this caption: "{caption}"/
[
  {
    "comment": "Your engaging reply here",
    "viralRate": 85,
    "commentTokenCount": 24
  }
]


Original Post: "${caption}"`;

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
      postId,
      caption,
      undefined, 
      postUsername,   // userId is undefined here
      connectedUsername  ,
      "instagram"
  );
    // Extraire le commentaire généré
    let extractedComment = "";
    try {
      const jsonResult =
        typeof result.response === "string"
          ? JSON.parse(result.response)
          : result;
      extractedComment = Array.isArray(jsonResult)
        ? jsonResult[0]?.comment
        : jsonResult?.comment;
    } catch (e) {
      console.log("Impossible d'extraire le commentaire pour la journalisation");
    }
    if (extractedComment) {
      console.log(`Commentaire généré pour le post ${postId} par ${connectedUsername}: "${extractedComment}"`);
    } else {
      console.log(`Commentaire généré pour le post ${postId}`);
    }
    
    // Ici, vous pourriez ajouter le code pour réellement poster le commentaire
  } catch (error) {
    console.error(`Erreur lors de la génération du commentaire pour le post ${postId} :`, error);
  }
}
