"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = exports.isAuthenticated = void 0;
const logger_1 = __importDefault(require("../config/logger"));
// middleware pour vérifier que l'utilisateur est connecté
const isAuthenticated = (req, res, next) => {
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
exports.isAuthenticated = isAuthenticated;
// middleware pour vérifier le rôle admin
const isAdmin = (req, res, next) => {
    const isAuth = req.isAuthenticated && req.isAuthenticated();
    if (isAuth && req.user && req.user.role === 'admin') {
        next();
        return;
    }
    logger_1.default.warn(`Unauthorized admin access attempt by user: ${req.user?.username ?? 'unauthenticated'}`);
    const isAjax = req.get('X-Requested-With') === 'XMLHttpRequest';
    if (isAjax || req.path.startsWith('/api/')) {
        res.status(403).json({ message: 'Forbidden: Admin access required' });
        return;
    }
    res.status(403).send('Forbidden: Admin access required');
};
exports.isAdmin = isAdmin;
