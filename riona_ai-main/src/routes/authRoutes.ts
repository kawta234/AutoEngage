import express from 'express';
import passport from 'passport';
import { registerUser, loginUser, getCurrentUser, logoutUser } from '../controllers/authControllers';

const router = express.Router();

// Register route
router.post('/register', registerUser);

// Login route
router.post('/login', passport.authenticate('local'), loginUser);

// Get current user route
router.get('/me', getCurrentUser);

// Logout route
router.get('/logout', logoutUser);

export default router;
