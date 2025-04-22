// routes/instaRoute.ts
import express from 'express';
import { 
  instagramLogin,
  setInstagramUsername,
  getInstagramStatus
} from '../controllers/commentsControllers';

const router = express.Router();

// Make sure we can read JSON or form‑encoded bodies
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Login route
router.post('/login', instagramLogin);

// Username route: allow either `username` or `instagramUsername` from your interface
router.post(
  '/username',
  (req, _res, next) => {
    if (!req.body.username && req.body.instagramUsername) {
      req.body.username = req.body.instagramUsername;
    }
    next();
  },
  setInstagramUsername
);

// Status route
router.get('/status', getInstagramStatus);

export default router;
