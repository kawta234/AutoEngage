"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = runAgent;
const ollama_interact_1 = require("../ollama_interact");
// Interface for comment data
async function runAgent() {
    try {
        const result = await (0, ollama_interact_1.interactWithOllama)( /* your parameters */);
        // Handle different response formats
        let response;
        if (typeof result === 'string') {
            try {
                response = JSON.parse(result);
            }
            catch (e) {
                console.error("Failed to parse JSON response:", e);
                throw new Error('Invalid JSON response');
            }
        }
        else {
            response = result;
        }
        // Ensure we have an array
        if (!Array.isArray(response)) {
            if (typeof response === 'object' && response !== null) {
                response = [response]; // Wrap single object in array
            }
            else {
                throw new Error('Invalid response format: not an array or object');
            }
        }
        // Validate and format response
        if (!response[0]?.comment) {
            throw new Error('Invalid response format: missing comment');
        }
        const formattedResponse = response.map(item => ({
            comment: item.comment,
            viralRate: typeof item.viralRate === 'number' ? item.viralRate : parseInt(item.viralRate) || 50,
            commentTokenCount: typeof item.commentTokenCount === 'number' ? item.commentTokenCount : parseInt(item.commentTokenCount) || item.comment.split(/\s+/).length
        }));
        return formattedResponse;
    }
    catch (error) {
        console.error("Error in runAgent:", error);
        // Return a fallback comment
        return [{
                comment: "This is really interesting! Thanks for sharing.",
                viralRate: 50,
                commentTokenCount: 8
            }];
    }
}
