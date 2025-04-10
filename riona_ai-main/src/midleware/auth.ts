// middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

// Middleware to check if user is authenticated
export const isAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Check if this is an API request or a page request
  if (req.xhr || req.path.startsWith('/api/')) {
    res.status(401).json({ message: 'Unauthorized' });
  } else {
    res.redirect('/login');
  }
};

// Middleware to check if user is an admin
export const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated() && req.user && (req.user as any).role === 'admin') {
    return next();
  }
  
  logger.warn(`Unauthorized admin access attempt by user: ${req.user ? (req.user as any).username : 'unauthenticated'}`);
  
  // Check if this is an API request or a page request
  if (req.xhr || req.path.startsWith('/api/')) {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
  } else {
    res.status(403).send('Forbidden: Admin access required');
  }
};
