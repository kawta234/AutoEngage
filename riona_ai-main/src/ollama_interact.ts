import * as fs from 'fs';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { getCommentsCollection, connectToDatabase, getUserCollection } from './config/db';
dotenv.config();

type OutputHandler = (message: string) => void;

type MessageType = Record<string, any>;

const defaultOutputHandler: OutputHandler = (message: string): void => {
    process.stdout.write(message);
};

const encodeImageToBase64 = (imagePath: string): string => {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
};

// Using a variable to store comments (in-memory storage)
let commentsMemory: { postId: string; comment: string; caption: string; timestamp?: Date }[] = [];

// Function to save the generated comment to a user-specific collection
export const saveInstagramComment = async (
    postId: string, 
    comment: string, 
    caption: string, 
    userId?: string // Ajout du paramètre userId qui peut être optionnel
) => {
    // Vérifier que la caption n'est pas tronquée
    console.log("Caption reçue pour sauvegarde:", caption);
    console.log("Longueur de la caption:", caption ? caption.length : 0);
    
    const commentData = {
        postId,
        comment,
        caption,           // Assurer que la caption complète est stockée
        timestamp: new Date(),
        status: 'pending', // Ajout du statut initial par défaut
        model: 'llama3.1'  // Ajout du modèle par défaut
    };
      
    try {
        // S'assurer que la connexion est établie avant d'accéder à la collection
        await connectToDatabase();
        
        let result;
        
        if (userId) {
            // Si un userId est fourni, utiliser la collection spécifique à l'utilisateur
            const userCollection = await getUserCollection(userId);
            console.log(`Utilisation de la collection utilisateur pour userId: ${userId}`);
            
            // Vérifier que l'objet est correctement formé avant insertion
            console.log("Données à insérer dans la collection utilisateur:", JSON.stringify(commentData, null, 2));
            
            // Ajouter le commentaire à la collection de l'utilisateur
            result = await userCollection.insertOne(commentData);
            console.log(`Commentaire enregistré dans la collection de l'utilisateur ${userId} avec l'ID:`, result.insertedId);
        } else {
            // Sinon, utiliser la collection générale des commentaires
            const commentsCollection = getCommentsCollection();
            
            // Vérifier que l'objet est correctement formé avant insertion
            console.log("Données à insérer dans la collection générale:", JSON.stringify(commentData, null, 2));
            
            // Ajouter le commentaire à la base de données générale
            result = await commentsCollection.insertOne(commentData);
            console.log("Commentaire enregistré dans la collection générale avec l'ID:", result.insertedId);
        }
        
        return true;
    } catch (error) {
        console.error("Erreur lors de l'enregistrement du commentaire dans la base de données:", error);
        return false;
    }
};

// Function to retrieve all saved comments from MongoDB, either from general or user-specific collection
export const getAllComments = async (userId?: string) => {
    try {
        // S'assurer que la connexion est établie avant d'accéder à la collection
        await connectToDatabase();
        
        let comments;
        
        if (userId) {
            // Si un userId est fourni, récupérer depuis la collection spécifique à l'utilisateur
            const userCollection = await getUserCollection(userId);
            comments = await userCollection.find({}).toArray();
            console.log(`Commentaires récupérés de la collection utilisateur ${userId}:`, comments.length);
        } else {
            // Sinon, récupérer depuis la collection générale
            const commentsCollection = getCommentsCollection();
            comments = await commentsCollection.find({}).toArray();
            console.log(`Commentaires récupérés de la collection générale:`, comments.length);
        }
        
        // Afficher un exemple pour vérifier si la caption complète est stockée
        if (comments.length > 0) {
            console.log("Exemple de caption stockée:", comments[0].caption);
            console.log("Longueur de cette caption:", comments[0].caption ? comments[0].caption.length : 0);
        }
        
        return comments;
    } catch (error) {
        console.error("Erreur lors de la récupération des commentaires:", error);
        return [];
    }
};

const interactWithOllama = async (
    prompt?: string,
    messages?: MessageType,
    imagePath?: string,
    model: string = 'llama3.1:latest',
    stream: boolean = false,
    outputHandler: OutputHandler = defaultOutputHandler,
    apiUrl: string = 'http://localhost:11434/api',
    format?: string,
    postId?: string,
    caption?: string,
    userId?: string  // Ajout du paramètre userId
): Promise<any> => {
    if (!apiUrl) {
        throw new Error('OLLAMA_API_URL is not set. Provide it via the apiUrl parameter or as an environment variable.');
    }

    const apiEndpoint = `${apiUrl}/${messages ? 'chat' : 'generate'}`;
    const data: any = { model, stream };

    if (messages) {
        data.messages = messages;
    } else if (prompt) {
        data.prompt = prompt;
        if (imagePath) {
            data.images = [encodeImageToBase64(imagePath)];
        }
    } else {
        throw new Error("Either messages for chat or a prompt for generate must be provided.");
    }

    if (format) {
        data.format = format;
    }

    console.log("Sending request to:", apiEndpoint);
    console.log("Request data:", JSON.stringify(data, null, 2));

    try {
        const response = await axios.post(apiEndpoint, data, { responseType: stream ? 'stream' : 'json' });
        
        if (!stream) {
            if (response.data) {
                // The API returns a single object, not an array to iterate
                const jsonResponse = response.data;
                console.log("Raw API response:", jsonResponse);
                
                // Si nous avons un Instagram post ID et une réponse
                if (postId && format === 'json' && jsonResponse.response) {
                    try {
                        // Try to parse the JSON response
                        let parsedData;
                        try {
                            parsedData = JSON.parse(jsonResponse.response);
                        } catch (e) {
                            console.log("Response wasn't a JSON string, using direct object");
                            parsedData = jsonResponse;
                        }
                        
                        // Extract the comment according to the structure
                        let comment = '';
                        if (Array.isArray(parsedData) && parsedData[0]?.comment) {
                            comment = parsedData[0].comment;
                        } else if (parsedData?.comment) {
                            comment = parsedData.comment;
                        }
                        
                        // If a comment was extracted, save it
                        if (comment) {
                            try {
                                // Utiliser le userId si disponible pour le stockage
                                const saveResult = await saveInstagramComment(postId, comment, caption || '', userId);
                                if (saveResult) {
                                    console.log(`Generated and saved comment ${userId ? 'for user ' + userId : ''}:`, comment);
                                } else {
                                    console.log("Generated comment but failed to save:", comment);
                                }
                            } catch (error) {
                                console.error("Error saving comment:", error);
                            }
                        }
                    } catch (error) {
                        console.error("Error processing and saving comment:", error);
                    }
                }
                // Return the entire response object for further processing
                return jsonResponse;
            }
            outputHandler("Received empty response");
            return "";
        } else {
            // Handle streaming response
            let responseData = '';
            response.data.on('data', (chunk: Buffer) => {
                const chunkStr = chunk.toString();
                responseData += chunkStr;
                outputHandler(chunkStr);
            });
            
            return new Promise((resolve) => {
                response.data.on('end', () => {
                    resolve(responseData);
                });
            });
        }
    } catch (error: any) {
        console.error("API request failed:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
        outputHandler(`Failed to retrieve data: ${error.response?.status || error.message}`);
        return "";
    }
};

export { interactWithOllama, encodeImageToBase64, defaultOutputHandler };