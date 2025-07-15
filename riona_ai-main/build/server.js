"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Updated server.ts with integrated authentication system
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db");
const passport_2 = require("./config/passport");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const commentsRoutes_1 = __importDefault(require("./routes/commentsRoutes"));
const auth_1 = require("./midleware/auth");
const logger_1 = __importDefault(require("./config/logger"));
// If your file is named instaRoute.ts (singular)
// If your file is named instaRoutes.ts (plural)
const instaRoute_1 = __importDefault(require("./routes/instaRoute"));
// Other routes...
// This makes the endpoint /api/instagram/login
// Load environment variables
dotenv_1.default.config();
// Initialize Express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3445;
// Parse request bodies
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
// Configure sessions
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
// Initialize Passport.js
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Configure Passport
(0, passport_2.configurePassport)();
app.use('/api/auth', authRoutes_1.default);
app.use('/api/comments', commentsRoutes_1.default);
app.use('/api/instagram', instaRoute_1.default);
app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.sendFile(path_1.default.join(__dirname, 'public', 'login.html'));
});
app.get('/register', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.sendFile(path_1.default.join(__dirname, 'public', 'register.html'));
});
// Route protégée pour l'interface d'analyse
app.get('/', auth_1.isAuthenticated, (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, 'public', 'index.html'));
});
// Utilisez ensuite express.static pour les assets statiques
app.use(express_1.default.static(path_1.default.join(__dirname, 'public')));
// Connect to database and start server
async function startServer() {
    try {
        await (0, db_1.connectToDatabase)();
        app.listen(PORT, () => {
            logger_1.default.info(`Server running on port ${PORT}`);
        });
    }
    catch (error) {
        logger_1.default.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
