"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const logger_1 = __importStar(require("./config/logger"));
const utils_1 = require("./utils");
const db_1 = require("./config/db");
// Initialize environment variables
dotenv_1.default.config();
// Set up process-level error handlers
(0, logger_1.setupErrorHandlers)();
const app = (0, express_1.default)();
// Middleware setup
app.use((0, helmet_1.default)({ xssFilter: true, noSniff: true }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true, limit: '1kb' }));
app.use((0, cookie_parser_1.default)());
// Start the Instagram automation process
const runInstagramAgent = async () => {
    try {
        // Connect to database at startup
        await (0, db_1.connectToDatabase)();
        while (true) {
            logger_1.default.info("Starting Instagram automation iteration...");
            //await runInstagram(); // No userId parameter needed based on instagram_automation.ts
            logger_1.default.info("Instagram automation iteration finished.");
            // Wait for 30 seconds before next iteration
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }
    catch (error) {
        (0, utils_1.setup_HandleError)(error, "Error in Instagram automation:");
    }
};
// Start the application asynchronously
const startApp = async () => {
    try {
        await runInstagramAgent();
    }
    catch (error) {
        (0, utils_1.setup_HandleError)(error, "Error starting Instagram agent:");
    }
};
// Start the application
startApp();
// Export the Express app
exports.default = app;
