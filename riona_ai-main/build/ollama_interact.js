"use strict";
// src/ollama_interact.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultOutputHandler = exports.encodeImageToBase64 = exports.interactWithOllama = exports.saveInstagramComment = void 0;
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db");
dotenv_1.default.config();
const defaultOutputHandler = (message) => {
    process.stdout.write(message);
};
exports.defaultOutputHandler = defaultOutputHandler;
/**
 * Read an image file and return its Base64 representation.
 */
const encodeImageToBase64 = (imagePath) => {
    const imageBuffer = fs_1.default.readFileSync(imagePath);
    return imageBuffer.toString('base64');
};
exports.encodeImageToBase64 = encodeImageToBase64;
/**
 * Save an Instagram comment to the database
 * Stores the comment in either a user-specific collection or the general comments collection
 */
const saveInstagramComment = async (postId, comment, caption, userId, username, postUsername // Added postUsername parameter
) => {
    // Verify caption is not truncated
    console.log("Caption received for saving:", caption);
    console.log("Caption length:", caption ? caption.length : 0);
    const commentData = {
        postId,
        comment,
        caption,
        timestamp: new Date(),
        status: 'pending',
        model: 'llama3.1',
        username: username || 'unknown_user',
        postUsername: postUsername || 'unknown_post_user' // Store the post author username
    };
    try {
        // Ensure the connection is established before accessing the collection
        await (0, db_1.connectToDatabase)();
        let result;
        if (userId) {
            // If a userId is provided, use the user-specific collection
            const userCollection = (0, db_1.getUserCollectionByUserId)(userId);
            console.log(`Using user collection for userId: ${userId}`);
            // Verify the object is properly formed before insertion
            console.log("Data to insert in user collection:", JSON.stringify(commentData, null, 2));
            // Add the comment to the user's collection
            result = await userCollection.insertOne(commentData);
            console.log(`Comment saved in user ${userId}'s collection with ID:`, result.insertedId);
        }
        else {
            // Otherwise, use the general comments collection
            const commentsCollection = (0, db_1.getCommentsCollection)();
            // Verify the object is properly formed before insertion
            console.log("Data to insert in general collection:", JSON.stringify(commentData, null, 2));
            // Add the comment to the general database
            result = await commentsCollection.insertOne(commentData);
            console.log("Comment saved in general collection with ID:", result.insertedId);
        }
        return true;
    }
    catch (error) {
        console.error("Error while saving comment to database:", error);
        return false;
    }
};
exports.saveInstagramComment = saveInstagramComment;
/**
 * Interact with the Ollama API to generate content
 * Can be used for generating comments, responding to prompts, etc.
 */
const interactWithOllama = async (prompt, messages, imagePath, model = 'llama3.1:latest', stream = false, outputHandler = defaultOutputHandler, apiUrl = 'http://localhost:11434/api', format, postId, caption, userId, postUsername, username // Username of the post author
) => {
    if (!apiUrl) {
        throw new Error('OLLAMA_API_URL is not set. Provide it via the apiUrl parameter or as an environment variable.');
    }
    const apiEndpoint = `${apiUrl}/${messages ? 'chat' : 'generate'}`;
    const data = { model, stream };
    if (messages) {
        data.messages = messages;
    }
    else if (prompt) {
        data.prompt = prompt;
        if (imagePath) {
            data.images = [encodeImageToBase64(imagePath)];
        }
    }
    else {
        throw new Error("Either messages for chat or a prompt for generate must be provided.");
    }
    if (format) {
        data.format = format;
    }
    console.log("Sending request to:", apiEndpoint);
    console.log("Request data:", JSON.stringify(data, null, 2));
    try {
        const response = await axios_1.default.post(apiEndpoint, data, { responseType: stream ? 'stream' : 'json' });
        if (!stream) {
            if (response.data) {
                // The API returns a single object, not an array to iterate
                const jsonResponse = response.data;
                console.log("Raw API response:", jsonResponse);
                // If we have an Instagram post ID and a response
                if (postId && format === 'json' && jsonResponse.response) {
                    try {
                        // Try to parse the JSON response
                        let parsedData;
                        try {
                            parsedData = JSON.parse(jsonResponse.response);
                        }
                        catch (e) {
                            console.log("Response wasn't a JSON string, using direct object");
                            parsedData = jsonResponse;
                        }
                        // Extract the comment according to the structure
                        let comment = '';
                        if (Array.isArray(parsedData) && parsedData[0]?.comment) {
                            comment = parsedData[0].comment;
                        }
                        else if (parsedData?.comment) {
                            comment = parsedData.comment;
                        }
                        // If a comment was extracted, save it
                        if (comment) {
                            try {
                                // Pass both usernames to saveInstagramComment
                                const saveResult = await (0, exports.saveInstagramComment)(postId, comment, caption || '', userId, username, // Username of commenter
                                postUsername // Username of post author
                                );
                                if (saveResult) {
                                    console.log(`Generated and saved comment by ${username || 'unknown user'} on ${postUsername || 'unknown'}'s post ${userId ? '(userId: ' + userId + ')' : ''}:`, comment);
                                }
                                else {
                                    console.log("Generated comment but failed to save:", comment);
                                }
                            }
                            catch (error) {
                                console.error("Error saving comment:", error);
                            }
                        }
                    }
                    catch (error) {
                        console.error("Error processing and saving comment:", error);
                    }
                }
                // Return the entire response object for further processing
                return jsonResponse;
            }
            outputHandler("Received empty response");
            return "";
        }
        else {
            // Handle streaming response
            let responseData = '';
            response.data.on('data', (chunk) => {
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
    }
    catch (error) {
        console.error("API request failed:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
        outputHandler(`Failed to retrieve data: ${error.response?.status || error.message}`);
        return "";
    }
};
exports.interactWithOllama = interactWithOllama;
