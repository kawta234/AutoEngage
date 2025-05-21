import express from 'express';
import { 
  getAllComments, 
  getCommentById, 
  rejectComment, 
  approveComment,  
  postComment,
  updateComment
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
// Endpoint pour définir les filtres Instagram

// Endpoint pour déclencher manuellement le processus FIFO (optionnel)
router.post('/trigger-fifo', async (_req, res, _next) => {
  try {
    const { username, port } = _req.body;
    
    // If port is not provided, use a default port
    const portToUse = port || 3000; // or whatever default you want to use
    
    await processQueue(username, portToUse);
    res.status(200).send({ 
      message: `Instagram process started successfully for ${username}`,
      port: portToUse
    });
  } catch (error) {
    console.error('Error in trigger-fifo endpoint:', error);
    res.status(500).send({ 
      message: 'Failed to start Instagram process',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Filtered Users Routes

export default router;