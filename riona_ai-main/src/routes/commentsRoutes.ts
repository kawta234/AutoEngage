import express from 'express';
import { 
  getAllComments, 
  getCommentById, 
  rejectComment, 
  approveComment,  
  postComment,
  updateComment,
  instagramLogin  // Ajout de l'import pour la fonction de login
} from '../controllers/commentsControllers';
// Import de la fonction processQueue depuis le fichier FIFO
import { processQueue } from '../controllers/fifoProcessComments';

const router = express.Router();

// Récupérer tous les commentaires
router.get('/', getAllComments);

// Récupérer un commentaire par son ID
router.get('/:id', getCommentById);

// Mettre à jour un commentaire
router.put('/:id', updateComment);

// Rejeter un commentaire (le supprimer)
router.post('/:id/reject', rejectComment);

// Approuver un commentaire (poster sur Instagram et mettre à jour le statut)
router.post('/:id/approve', approveComment);

// Poster un commentaire (sans modifier le statut dans la base de données)
router.post('/:id/comment', postComment);

// Endpoint pour déclencher manuellement le processus FIFO (optionnel)
router.post('/trigger-fifo', async (_req, res) => {
  try {
    processQueue();
    res.status(200).json({ message: 'Le processus FIFO a été déclenché.' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message || 'Erreur lors du déclenchement du FIFO' });
  }
});
router.post('/instagram/login', instagramLogin);
export default router;
