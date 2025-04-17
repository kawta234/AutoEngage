// src/controllers/queueProcessor.ts

import { getCommentsCollection } from '../config/db';
import { commentOnPostById } from './commentsControllers';
import { ObjectId } from 'mongodb';
import logger from '../config/logger';

// Delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Random delay between min and max ms
const getRandomDelay = (min = 3000, max = 10000): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export async function processQueue(): Promise<void> {
  try {
    const collection = getCommentsCollection();

    while (true) {
      // Find oldest “processing” comment
      const queued = await collection.findOne(
        { status: 'processing' },
        { sort: { lastUpdated: 1 } }
      );

      if (!queued) {
        logger.info("Aucun commentaire en statut 'processing' à traiter.");
        logger.info("Attente de 2 minutes avant de vérifier à nouveau la file...");
        await delay(2 * 60 * 1000);
        continue;
      }

      // Cast and rename to avoid shadowing
      const queuedComment = queued as {
        _id: ObjectId;
        postId: string;
        comment: string;
        timestamp?: Date;
        lastUpdated?: Date;
        userId?: string;
      };

      // Log creation / update dates
      if (queuedComment.timestamp) {
        logger.info(`Comment ${queuedComment._id} créé le ${queuedComment.timestamp}`);
      }
      if (queuedComment.lastUpdated) {
        logger.info(`Comment ${queuedComment._id} mis à jour le ${queuedComment.lastUpdated}`);
      } else {
        logger.info(`Comment ${queuedComment._id} n'a pas encore de date de mise à jour.`);
      }

      logger.info(`Traitement du commentaire _id: ${queuedComment._id}`);

      // Try up to 3 times
      let attempt = 0;
      const maxAttempts = 3;
      let result: { success: boolean; message: string } = { success: false, message: '' };

      while (attempt < maxAttempts) {
        attempt++;
        logger.info(`Tentative ${attempt} pour le commentaire ${queuedComment._id}`);

        const userIdToUse = queuedComment.userId || 'system';
        result = await commentOnPostById(
          userIdToUse,
          queuedComment.postId,
          queuedComment.comment
        );

        if (result.success) {
          logger.info(
            `Le commentaire ${queuedComment._id} a été posté avec succès à la tentative ${attempt}.`
          );
          break;
        } else {
          logger.error(
            `Tentative ${attempt} échouée pour le commentaire ${queuedComment._id}: ${result.message}`
          );
          if (attempt < maxAttempts) {
            const retryDelay = getRandomDelay();
            logger.info(
              `Attente de ${retryDelay} ms avant la prochaine tentative pour le commentaire ${queuedComment._id}`
            );
            await delay(retryDelay);
          }
        }
      }

      // Update status based on final result
      await collection.updateOne(
        { _id: queuedComment._id },
        {
          $set: {
            status: result.success ? 'posted' : 'failed',
            lastUpdated: new Date(),
            ...(result.success ? { postedAt: new Date() } : { error: result.message })
          }
        }
      );

      // Wait a bit before the next item
      const waitDelay = getRandomDelay();
      logger.info(`Attente de ${waitDelay} ms avant de traiter le prochain commentaire`);
      await delay(waitDelay);
    }
  } catch (error) {
    logger.error('Erreur lors du traitement de la file (FIFO) des commentaires :', error);
  }
}
