// detectionInstagram.js

import axios from 'axios';
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// URL de la page Instagram à surveiller
const URL = 'https://www.instagram.com';
// Chemin du fichier contenant l'empreinte (hash) de la page
const hashFilePath = 'instagramPageHash.txt';

/**
 * Calcule le hash SHA-256 d'une chaîne de caractères.
 * @param {string} html - Le contenu HTML dont on souhaite calculer le hash.
 * @returns {string} La chaîne hexadécimale représentant le hash.
 */
function computeHash(html) {
  return createHash('sha256').update(html).digest('hex');
}

/**
 * Récupère le contenu HTML de la page Instagram.
 * @returns {Promise<string>} Le contenu HTML.
 */
async function fetchInstagramPage() {
  try {
    const response = await axios.get(URL);
    return response.data;
  } catch (error) {
    throw new Error(`Erreur lors de la récupération de la page : ${error}`);
  }
}

/**
 * Vérifie la présence de changements en comparant le hash actuel du contenu
 * avec celui stocké dans le fichier.
 * En cas de modification, c'est ici que vous pourrez intégrer la logique d'envoi d'email.
 */
async function checkForChanges() {
  try {
    // Récupérer le contenu de la page réelle
    const pageHtml = await fetchInstagramPage();
    const currentHash = computeHash(pageHtml);
    console.log("Hash actuel : " + currentHash);

    // Lecture du hash précédent depuis le fichier (s'il existe)
    let previousHash = existsSync(hashFilePath)
      ? readFileSync(hashFilePath, 'utf8')
      : null;

    if (previousHash && previousHash === currentHash) {
      console.log("Aucun changement détecté.");
    } else {
      console.log("Changement détecté !");
      // Ici, vous pouvez ajouter la logique pour envoyer l'email de notification.
      // Par exemple : sendNotificationEmail();

      // Mise à jour du fichier avec le nouveau hash
      writeFileSync(hashFilePath, currentHash, 'utf8');
    }
  } catch (error) {
    console.error("Erreur lors de la vérification des changements :", error);
  }
}

/**
 * Fonction de test permettant de simuler la détection de changements.
 * On utilise deux contenus fictifs pour tester :
 *  - fakeHtml1 : contenu initial (aucun changement attendu)
 *  - fakeHtml2 : contenu modifié (changement attendu)
 */
async function testCheckForChanges() {
  // Contenu de test initial et modifié
  const fakeHtml1 = '<html><body>Contenu initial</body></html>';
  const fakeHtml2 = '<html><body>Contenu modifié</body></html>';

  // Calcul des hashs correspondants
  const hash1 = computeHash(fakeHtml1);
  const hash2 = computeHash(fakeHtml2);

  // --- Test 1 : Vérification sans modification ---
  // On simule la première écriture avec le contenu initial
  writeFileSync(hashFilePath, hash1, 'utf8');
  console.log("Test 1 : Aucune modification attendue");
  // Lecture du hash stocké pour comparaison
  let storedHash = readFileSync(hashFilePath, 'utf8');
  if (storedHash === hash1) {
    console.log("Test réussi : Le hash initial est correctement enregistré.");
  } else {
    console.log("Test échoué : Problème lors de l'enregistrement du hash initial.");
  }

  // --- Test 2 : Simulation d'une modification ---
  // On restaure le hash initial, puis on simule un nouveau contenu modifié.
  writeFileSync(hashFilePath, hash1, 'utf8');
  console.log("Test 2 : Contenu modifié");
  // Fonction simulée qui compare le hash d'un contenu factice avec le hash stocké
  function checkFakePage(fakeHtml) {
    const currentHash = computeHash(fakeHtml);
    const previousHash = existsSync(hashFilePath)
      ? readFileSync(hashFilePath, 'utf8')
      : null;
    if (previousHash === currentHash) {
      return false; // Aucun changement
    } else {
      writeFileSync(hashFilePath, currentHash, 'utf8');
      return true; // Changement détecté
    }
  }
  
  const changeDetected = checkFakePage(fakeHtml2);
  if (changeDetected) {
    console.log("Test réussi : Le changement a été détecté et le hash mis à jour.");
  } else {
    console.log("Test échoué : Le changement n'a pas été détecté.");
  }
}

// Exécuter la fonction de test
testCheckForChanges();

// Pour utiliser sur la page réelle, décommentez la ligne suivante et commentez testCheckForChanges()
// checkForChanges();
