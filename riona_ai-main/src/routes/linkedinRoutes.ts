// routes/instaRoute.ts
import express from 'express';

import {linkedinLogin, setLinkedinUsername} from '../controllers/commentlink';
import { 
    saveFilteredUser,
    getFilteredUsers,
    deleteFilteredUser
  } from '../controllers/commentlink';
import { runLinkedIn } from '../client/linkedin/linkedin';
import { processQueue } from '../controllers/fifolink';


interface CookieResponse {
  success: boolean;
  data?: {
    cookies: any[];
    username: string;
  };
  message?: string;
}
const router = express.Router();

// Make sure we can read JSON or form‑encoded bodies
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Login route

router.post('/login', linkedinLogin);
// Username route: allow either `username` or `instagramUsername` from your interface

router.post(
  '/username',
  (req, _res, next) => {
    if (!req.body.username && req.body.setLinkedinUsername) {
      req.body.username = req.body.setLinkedinUsername;
    }
    next();
  },
  setLinkedinUsername
);

router.post('/filtered-users',  saveFilteredUser);
router.get('/filtered-users',  getFilteredUsers);
router.delete('/filtered-users/:targetUsername',  deleteFilteredUser);
router.post('/run', async (req, res, next) => {
  try {
    const { username, port } = req.body;
    await runLinkedIn(username, port);
    res.status(200).send({ message: 'Instagram process started successfully' });
  } catch (error) {
    next(error);
  }
});
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
export default router;
