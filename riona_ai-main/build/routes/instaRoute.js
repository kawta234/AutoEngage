"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/instaRoute.ts
const express_1 = __importDefault(require("express"));
const commentsControllers_1 = require("../controllers/commentsControllers");
const Instagram_1 = require("../client/Instagram");
const agentcontroller_1 = require("../client/agentcontroller");
const router = express_1.default.Router();
// Make sure we can read JSON or form‑encoded bodies
router.use(express_1.default.json());
router.use(express_1.default.urlencoded({ extended: true }));
// Login route
router.post('/login', commentsControllers_1.instagramLogin);
// Username route: allow either `username` or `instagramUsername` from your interface
router.post('/username', (req, _res, next) => {
    if (!req.body.username && req.body.instagramUsername) {
        req.body.username = req.body.instagramUsername;
    }
    next();
}, commentsControllers_1.setInstagramUsername);
// Status route
router.get('/status', commentsControllers_1.getInstagramStatus);
router.post('/filtered-users', commentsControllers_1.saveFilteredUser);
router.get('/filtered-users', commentsControllers_1.getFilteredUsers);
router.delete('/filtered-users/:targetUsername', commentsControllers_1.deleteFilteredUser);
router.post('/run', async (req, res, next) => {
    try {
        const { username, port } = req.body;
        await (0, Instagram_1.runInstagram)(username, port);
        res.status(200).send({ message: 'Instagram process started successfully' });
    }
    catch (error) {
        next(error);
    }
});
router.get('/cookies', agentcontroller_1.getCookies);
exports.default = router;
