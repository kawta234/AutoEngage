import { getCommentsCollection } from '../config/db';
import { commentOnPostById } from './commentsControllers';
import { ObjectId } from 'mongodb';
import logger from '../config/logger';

// Fonction d'attente (delay)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fonction pour générer un délai aléatoire en millisecondes (par défaut entre 3000 et 10000 ms)
const getRandomDelay = (min = 3000, max = 10000): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export async function processQueue(): Promise<void> {
  try {
    const collection = getCommentsCollection();

    // Boucle pour traiter les commentaires en FIFO
    while (true) {
      // Récupère le commentaire "processing" dont lastUpdated est le plus ancien
      const comment = await collection.findOne(
        { status: 'processing' },
        { sort: { lastUpdated: 1 } }
      );

      // Si aucun commentaire n'est trouvé, attend 5 minutes avant de retenter
      if (!comment) {
        logger.info("Aucun commentaire en statut 'processing' à traiter.");
        logger.info("Attente de 2 minutes avant de vérifier à nouveau la file...");
        await delay(2 * 60 * 1000); // 5 minutes
        continue;
      }

      // Affichage des dates
      if (comment.timestamp) {
        logger.info(`Le commentaire ${comment._id} a été créé le ${comment.timestamp}`);
      }
      if (comment.lastUpdated) {
        logger.info(`Le commentaire ${comment._id} a été mis à jour le ${comment.lastUpdated}`);
      } else {
        logger.info(`Le commentaire ${comment._id} n'a pas encore de date de mise à jour.`);
      }

      logger.info(`Traitement du commentaire _id: ${comment._id}`);

      // Boucle pour retenter de poster le commentaire jusqu'au succès
      let result;
      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        attempt++;
        logger.info(`Tentative ${attempt} pour le commentaire ${comment._id}`);
        result = await commentOnPostById(comment.postId, comment.comment);

        if (result.success) {
          logger.info(`Le commentaire ${comment._id} a été posté avec succès à la tentative ${attempt}.`);
          break;
        } else {
          logger.error(`Tentative ${attempt} échouée pour le commentaire ${comment._id}: ${result.message}`);
          if (attempt === maxAttempts) {
            logger.error(`Le commentaire ${comment._id} n'a pas pu être posté après ${maxAttempts} tentatives.`);
            break;
          }
          // Attente aléatoire avant de retenter
          const retryDelay = getRandomDelay();
          logger.info(`Attente de ${retryDelay} ms avant la prochaine tentative pour le commentaire ${comment._id}`);
          await delay(retryDelay);
        }
      }

      // Mise à jour du statut et de la date de traitement
      await collection.updateOne(
        { _id: new ObjectId(comment._id) },
        { $set: { status: 'posted', lastUpdated: new Date() } }
      );

      // Attente aléatoire avant de traiter le commentaire suivant
      const waitDelay = getRandomDelay();
      logger.info(`Attente de ${waitDelay} ms avant de traiter le prochain commentaire`);
      await delay(waitDelay);
    }
  } catch (error) {
    logger.error('Erreur lors du traitement de la file (FIFO) des commentaires :', error);
  }
}
