// instagram_automation.ts
import { Browser, DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import { Server } from "proxy-chain";
import { IGpassword, IGusername } from "../secret";
import logger from "../config/logger";
import { Instagram_cookiesExist, loadCookies, saveCookies } from "../utils";
import { interactWithOllama } from "../ollama_interact"; // Ajustez le chemin si nécessaire

// --------------------------
// Déclaration globale des sélecteurs
// --------------------------
const postSelector = (index: number): string => `article:nth-of-type(${index + 1})`;

const captionSelectors: string[] = [
  'span.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.xt0psk2.x1i0vuye.xvs91rp.xo1l8bm.x5n08af.x10wh9bi.x1wdrske.x8viiok.x18hxmgj',
  'div.C4VMK > span'
];

const moreLinkSelector: string = 'span.x1lliihq';

const commentBoxSelector: string = 'textarea[aria-label="Add a comment…"][placeholder="Add a comment…"]';

// Nouveau : Sélecteur pour le bouton "Like" sur une page de post
const likeButtonSelector: string = 'svg[aria-label="Like"]';

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
const COOKIES_PATH = "./cookies/Instagramcookies.json";

export async function runInstagram(): Promise<void> {
  // Start proxy server (optional)
  const proxyServer = new Server({ port: 8000 });
  await proxyServer.listen();
  const proxyUrl = `http://localhost:8000`;

  const browser = await puppeteer.launch({
    headless: true,
    args: [`--proxy-server=${proxyUrl}`],
  });
  const page = await browser.newPage();

  // Ensure we only log in via cookies
  const cookiesExist = await Instagram_cookiesExist();
  logger.info(`Cookies exist: ${cookiesExist}`);

  if (!cookiesExist) {
    logger.error("No Instagram cookies found; cannot log in.");
    await browser.close();
    await proxyServer.close(true);
    return;
  }

  // Load and apply cookies
  const cookies = await loadCookies(COOKIES_PATH);
  await page.setCookie(...cookies);
  logger.info("Instagram cookies loaded.");

  // Verify cookie-based login
  await page.goto("https://www.instagram.com/", { waitUntil: "networkidle2" });
  const loggedInIndicator = await page.$("a[href='/direct/inbox/']");
  if (!loggedInIndicator) {
    logger.error("Cookies invalid or expired; please refresh your cookies file.");
    await browser.close();
    await proxyServer.close(true);
    return;
  }
  logger.info("Logged into Instagram via cookies.");

  // Optional snapshot
  await page.screenshot({ path: "logged_in.png" });

  const targetCount = 500;
  const processedIDs = new Set<string>();

  while (processedIDs.size < targetCount) {
    // Ensure feed
    await page.goto("https://www.instagram.com/", { waitUntil: "networkidle2" });
    await delay(2000);

    // Extract post IDs
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
      await generateCommentForPost(page, postId);
      processedIDs.add(postId);
      logger.info(`Processed post ${postId} (${processedIDs.size}/${targetCount})`);
      await delay(5000);
    }

    // Scroll for more
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await delay(3000);
  }

  await browser.close();
  await proxyServer.close(true);
}

//

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
async function generateCommentForPost(page: any, postId: string) {
  const postUrl = `https://www.instagram.com/p/${postId}/`;
  await page.goto(postUrl, { waitUntil: "networkidle2" });
  await delay(2000); // Attendre le chargement du contenu

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

Read the ${caption} provided, which could be structured in various ways (bullet points, narratives, multi-language sections, etc.). Now, create an attractive, engaging comment that directly responds to the caption’s themes. The comment should:

• Reflect on the key ideas in a genuine and appealing tone.
• Vary in structure and length—feel free to be brief or elaborate.
• Optionally include a follow-up question to spark discussion, or simply offer an observation.
• Embrace randomness in style, ensuring each comment is uniquely crafted while remaining relevant to the caption’s content.
Your response must be a valid JSON array with exactly one object:

[
  {
    "comment": "Your engaging reply here",
    "viralRate": 85,
    "commentTokenCount": 24
  }
]

Requirements:
- "comment" must be between 15-25 characters, relevant to caption
- "viralRate" must be a number (0-100)
- "commentTokenCount" must accurately count tokens in comment
- Response must be ONLY a JSON array with no additional text

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
      caption
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
      console.log(`Commentaire généré pour le post ${postId} : "${extractedComment}"`);
    } else {
      console.log(`Commentaire généré pour le post ${postId}`);
    }
  } catch (error) {
    console.error(`Erreur lors de la génération du commentaire pour le post ${postId} :`, error);
  }
}

