"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const authControllers_1 = require("../controllers/authControllers");
const router = express_1.default.Router();
// Register route
router.post('/register', authControllers_1.registerUser);
// Login route
router.post('/login', passport_1.default.authenticate('local'), authControllers_1.loginUser);
// Get current user route
router.get('/me', authControllers_1.getCurrentUser);
// Logout route
router.get('/logout', authControllers_1.logoutUser);
exports.default = router;
