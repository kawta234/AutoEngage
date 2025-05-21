// routes/instaRoute.ts
import express from 'express';
import { 
  instagramLogin,
  setInstagramUsername,
  getInstagramStatus,
  saveFilteredUser,
  getFilteredUsers,
  deleteFilteredUser
} from '../controllers/commentsControllers';
import { runInstagram } from '../client/Instagram';

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
router.post('/filtered-users',  saveFilteredUser);
router.get('/filtered-users',  getFilteredUsers);
router.delete('/filtered-users/:targetUsername',  deleteFilteredUser);
router.post('/run', async (req, res, next) => {
  try {
    const { username, port } = req.body;
    await runInstagram(username, port);
    res.status(200).send({ message: 'Instagram process started successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
