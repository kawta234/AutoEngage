import mongoose, { Document, Schema, Model } from 'mongoose';
import { interactWithOllama } from '../../ollama_interact'; // Import the Ollama interaction function

// Define the interface for the Instagram comment schema
export interface InstagramComment {
    comment: string;       // The comment itself
    viralRate: number;     // The viral rate (0-100)
    commentTokenCount: number; // The token count of the comment
}

// Define the schema for Instagram comment
const instagramCommentSchema: Schema<InstagramComment> = new Schema({
    comment: { type: String, required: true },
    viralRate: { type: Number, required: true },
    commentTokenCount: { type: Number, required: true },
}, {
    timestamps: true,
});

// Create the model for the Instagram comment schema
const InstagramCommentModel: Model<InstagramComment> = mongoose.model<InstagramComment>('InstagramComment', instagramCommentSchema);

// Function to generate an Instagram comment using Ollama


// Example usage of the generateInstagramComment function
export const getInstagramCommentSchema = () => {
    return {
        description: `Lists comments that are engaging and have the potential to attract more likes and go viral.`,
        type: 'array',
        items: {
            type: 'object',
            properties: {
                comment: {
                    type: 'string',
                    description: 'A comment between 15 and 25 characters.',
                    nullable: false,
                },
                viralRate: {
                    type: 'number',
                    description: 'The viral rate, measured on a scale of 0 to 100.',
                    nullable: false,
                },
                commentTokenCount: {
                    type: 'number',
                    description: 'The total number of tokens in the comment.',
                    nullable: false,
                },
            },
            required: [
                'comment',
                'viralRate',
                'commentTokenCount'
            ],
        },
    };
};

// Define the interface for the Tweet document
interface ITweet extends Document {
    tweetContent: string;
    imageUrl: string;
    timeTweeted: Date;
}

// Define the schema for the Tweet document
const tweetSchema: Schema<ITweet> = new Schema({
    tweetContent: { type: String, required: true },
    imageUrl: { type: String, required: true },
    timeTweeted: { type: Date, default: Date.now },
});

// Create the model for the Tweet document
const Tweet: Model<ITweet> = mongoose.model<ITweet>('Tweet', tweetSchema);

export { Tweet };
