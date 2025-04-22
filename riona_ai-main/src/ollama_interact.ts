// src/ollama_interact.ts

import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';
import {
  connectToDatabase,
  getCommentsCollection,
  getUserCollectionByUserId
} from './config/db';

dotenv.config();

type OutputHandler = (message: string) => void;
type MessageType = Record<string, any>;

const defaultOutputHandler: OutputHandler = (message: string): void => {
  process.stdout.write(message);
};

/**
 * Read an image file and return its Base64 representation.
 */
const encodeImageToBase64 = (imagePath: string): string => {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
};

/**
 * Send a prompt or chat to Ollama, optionally stream the result, and
 * if a postId+format==='json' is provided, parse & save the comment
 * under the correct Instagram account.
 */
// Modification to saveInstagramComment function in ollama_interact.ts
export const saveInstagramComment = async (
  postId: string, 
  comment: string, 
  caption: string, 
  userId?: string,
  username?: string
) => {
  // Vérifier que la caption n'est pas tronquée
  console.log("Caption reçue pour sauvegarde:", caption);
  console.log("Longueur de la caption:", caption ? caption.length : 0);
  
  const commentData = {
      postId,
      comment,
      caption,
      timestamp: new Date(),
      status: 'pending',
      model: 'llama3.1',
      username: username || 'unknown_user'
  };
    
  try {
      // S'assurer que la connexion est établie avant d'accéder à la collection
      await connectToDatabase();
      
      let result;
      
      if (userId) {
          // Si un userId est fourni, utiliser la collection spécifique à l'utilisateur
          const userCollection = getUserCollectionByUserId(userId); // Use the new function
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

// Modify the interactWithOllama function to accept username parameter
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
  userId?: string,
  username?: string  // Add username parameter
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
                              // Pass username to saveInstagramComment
                              const saveResult = await saveInstagramComment(
                                  postId, 
                                  comment, 
                                  caption || '', 
                                  userId,
                                  username // Pass the username to save with comment
                              );
                              if (saveResult) {
                                  console.log(`Generated and saved comment ${username ? 'for Instagram user ' + username : ''} ${userId ? '(userId: ' + userId + ')' : ''}:`, comment);
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