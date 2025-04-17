// routes/instagramRoutes.ts
import express from 'express';
import { instagramLogin } from '../controllers/commentsControllers';

const router = express.Router();

router.post('/login', instagramLogin);

export default router;
