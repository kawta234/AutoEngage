// Dans le fichier index.ts
import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { runInstagram } from './client/Instagram';
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

const runAgents = async () => {
    try {
        // Attendre que la connexion à la base de données soit établie
        await connectToDatabase();
        
        while (true) {
            logger.info("Starting Instagram agent iteration...");
            await runInstagram();
            logger.info("Instagram agent iteration finished.");

            // Wait for 30 seconds before next iteration
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    } catch (error) {
        setup_HandleError(error, "Error in runAgents:");
    }
};

// Démarrer l'application de façon asynchrone
const startApp = async () => {
    try {
        await runAgents();
    } catch (error) {
        setup_HandleError(error, "Error running agents:");
    }
};

startApp();

export default app;