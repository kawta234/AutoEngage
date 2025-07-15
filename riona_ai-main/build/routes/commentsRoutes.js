"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const commentsControllers_1 = require("../controllers/commentsControllers");
// Import de la fonction processQueue depuis le fichier FIFO
const fifoProcessComments_1 = require("../controllers/fifoProcessComments");
const router = express_1.default.Router();
// Récupérer tous les commentaires
router.get('/', commentsControllers_1.getAllComments);
// Récupérer un commentaire par son ID
router.get('/:id', commentsControllers_1.getCommentById);
// Mettre à jour un commentaire
router.put('/:id', commentsControllers_1.updateComment);
// Rejeter un commentaire (le supprimer)
router.post('/:id/reject', commentsControllers_1.rejectComment);
// Approuver un commentaire (poster sur Instagram et mettre à jour le statut)
router.post('/:id/approve', commentsControllers_1.approveComment);
// Poster un commentaire (sans modifier le statut dans la base de données)
router.post('/:id/comment', commentsControllers_1.postComment);
// Endpoint pour définir les filtres Instagram
// Endpoint pour déclencher manuellement le processus FIFO (optionnel)
router.post('/trigger-fifo', async (_req, res, _next) => {
    try {
        const { username, port } = _req.body;
        // If port is not provided, use a default port
        const portToUse = port || 3000; // or whatever default you want to use
        await (0, fifoProcessComments_1.processQueue)(username, portToUse);
        res.status(200).send({
            message: `Instagram process started successfully for ${username}`,
            port: portToUse
        });
    }
    catch (error) {
        console.error('Error in trigger-fifo endpoint:', error);
        res.status(500).send({
            message: 'Failed to start Instagram process',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Filtered Users Routes
exports.default = router;
