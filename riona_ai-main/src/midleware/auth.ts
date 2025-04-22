// middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

// middleware pour vérifier que l'utilisateur est connecté
export const isAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    next();
    return;
  }

  const isAjax = req.get('X-Requested-With') === 'XMLHttpRequest';
  if (isAjax || req.path.startsWith('/api/')) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  res.redirect('/login');
};

// middleware pour vérifier le rôle admin
export const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const isAuth = req.isAuthenticated && req.isAuthenticated();
  if (isAuth && req.user && (req.user as any).role === 'admin') {
    next();
    return;
  }

  logger.warn(
    `Unauthorized admin access attempt by user: ${
      (req.user as any)?.username ?? 'unauthenticated'
    }`
  );

  const isAjax = req.get('X-Requested-With') === 'XMLHttpRequest';
  if (isAjax || req.path.startsWith('/api/')) {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
    return;
  }

  res.status(403).send('Forbidden: Admin access required');
};
