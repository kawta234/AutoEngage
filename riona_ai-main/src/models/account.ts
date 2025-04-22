// models/account.ts
import { ObjectId } from 'mongodb';

export interface IAccount {
  _id?: string;
  userId: string;    // Reference to user
  platform: string;  // 'instagram', could support others later
  username: string;  // Instagram username
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface IComment {
  _id: string;
  userId: string;    // User who created/owns this comment
  accountId: string; // Reference to the Instagram account
  postId: string;    // Instagram post ID
  comment: string;   // The actual comment text
  caption?: string;  // Post caption this is responding to
  status: string;    // 'pending', 'approved', 'rejected', etc.
  model?: string;    // AI model used
  createdAt: Date;
  updatedAt?: Date;
  postedAt?: Date;
}