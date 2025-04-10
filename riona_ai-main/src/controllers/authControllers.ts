import { Request, Response } from 'express';
import { getUsersCollection } from '../config/db';
import { User, IUser } from '../models/user';
import { ObjectId } from 'mongodb';
import logger from '../config/logger';

// Register a new user
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, displayName } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      res.status(400).json({ message: 'Username, email, and password are required' });
      return;
    }
    
    const collection = getUsersCollection();
    
    // Check if username or email already exists
    const existingUser = await collection.findOne({
      $or: [{ username }, { email }]
    });
    
    if (existingUser) {
      res.status(400).json({ message: 'Username or email already exists' });
      return;
    }
    
    // Hash password and create user
    const hashedPassword = await User.hashPassword(password);
    const userData = {
      username,
      email,
      password: hashedPassword,
      displayName: displayName || username,
      role: 'user' as const,
      createdAt: new Date(),
      isActive: true
    };

    // Create a new User instance and insert into the collection
    const newUser = new User(userData);
    await collection.insertOne(newUser);
    
    // Exclude the password when returning the new user data
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    logger.error('Error registering user:', error);
    res.status(500).json({ message: 'Failed to register user' });
  }
};

// Login user (handled by Passport, this is a callback)
export const loginUser = (req: Request, res: Response): void => {
  // Update last login time
  const collection = getUsersCollection();
  collection.updateOne(
    { _id: new ObjectId((req.user as IUser)._id) },
    { $set: { lastLogin: new Date() } }
  ).catch(err => logger.error('Error updating last login:', err));
  
  res.status(200).json({
    message: 'Login successful',
    user: {
      id: (req.user as IUser)._id,
      username: (req.user as IUser).username,
      displayName: (req.user as IUser).displayName,
      role: (req.user as IUser).role
    }
  });
};

// Get current user
export const getCurrentUser = (req: Request, res: Response): void => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ message: 'Not authenticated' });
    return;
  }
  
  res.status(200).json({
    user: {
      id: (req.user as IUser)._id,
      username: (req.user as IUser).username,
      displayName: (req.user as IUser).displayName,
      role: (req.user as IUser).role
    }
  });
};


export const logoutUser = (req: Request, res: Response): void => {
  req.logout((err) => {
    if (err) {
      logger.error('Error during logout:', err);
      return res.status(500).json({ message: 'Failed to logout' });
    }
    return res.redirect('/login');
  });
};



