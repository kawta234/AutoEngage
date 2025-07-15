"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// fifoServer.ts
const db_1 = require("../config/db");
// Connexion à la base de données
(0, db_1.connectToDatabase)()
    .then(() => {
    console.log('Connecté à MongoDB pour le traitement FIFO');
    // Lancer le traitement FIFO
    //processQueue();
})
    .catch((err) => {
    console.error('Échec de la connexion à MongoDB dans le FIFO', err);
    process.exit(1);
});
