// Updated server.ts with integrated authentication system
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import path from 'path';
import dotenv from 'dotenv';
import { connectToDatabase } from './config/db';
import { configurePassport } from './config/passport';
import authRoutes from './routes/authRoutes';
import commentRoutes from './routes/commentsRoutes';
import { isAuthenticated } from './midleware/auth';
import logger from './config/logger';
import instagramRoutes from './routes/instaRoute';
import linkedinRoutes from './routes/linkedinRoutes';

dotenv.config();

// Initialize Express app
const app = express();

const PORT = process.env.PORT || 3445;

// Parse request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configure sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport.js
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport
configurePassport();
app.use('/api/auth', authRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/linkedin', linkedinRoutes);
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/');  
  }
  res.sendFile(path.join(__dirname, 'public','login.html'));
});

app.get('/register', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public','register.html'));
});

// Route protégée pour l'interface d'analyse

app.get('/', isAuthenticated, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public','platform.html'));
});

// Utilisez ensuite express.static pour les assets statiques
app.use(express.static(path.join(__dirname, 'public')));


// Connect to database and start server
async function startServer() {
  try {
    await connectToDatabase();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
