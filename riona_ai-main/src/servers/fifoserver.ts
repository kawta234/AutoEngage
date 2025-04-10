// fifoServer.ts
import { connectToDatabase } from '../config/db';
import { processQueue } from '../controllers/fifoProcessComments';

// Connexion à la base de données
connectToDatabase()
  .then(() => {
    console.log('Connecté à MongoDB pour le traitement FIFO');
    // Lancer le traitement FIFO
    processQueue();
  })
  .catch((err) => {
    console.error('Échec de la connexion à MongoDB dans le FIFO', err);
    process.exit(1);
  });
