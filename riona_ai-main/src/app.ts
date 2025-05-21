import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { runInstagram } from './client/Instagram'; // Updated import path
import logger, { setupErrorHandlers } from './config/logger';
import { setup_HandleError } from './utils';
import { connectToDatabase } from './config/db';

// Initialize environment variables
dotenv.config();

// Set up process-level error handlers
setupErrorHandlers();

const app: Application = express();

// Middleware setup
app.use(helmet({ xssFilter: true, noSniff: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '1kb' }));
app.use(cookieParser());

// Start the Instagram automation process
const runInstagramAgent = async () => {
    try {
        // Connect to database at startup
        await connectToDatabase();
        
        while (true) {
            logger.info("Starting Instagram automation iteration...");
            //await runInstagram(); // No userId parameter needed based on instagram_automation.ts
            logger.info("Instagram automation iteration finished.");

            // Wait for 30 seconds before next iteration
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    } catch (error) {
        setup_HandleError(error, "Error in Instagram automation:");
    }
};

// Start the application asynchronously
const startApp = async () => {
    try {
        await runInstagramAgent();
    } catch (error) {
        setup_HandleError(error, "Error starting Instagram agent:");
    }
};

// Start the application
startApp();

// Export the Express app
export default app;