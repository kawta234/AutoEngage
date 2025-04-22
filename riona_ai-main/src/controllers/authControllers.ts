// controllers/authController.ts
import { Request, Response } from 'express';
import { connectToDatabase, getUsersCollection } from '../config/db';
import { User, IUser } from '../models/user';
import { ObjectId } from 'mongodb';
import logger from '../config/logger';

// Register a new user
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      username, 
      email, 
      password, 
      firstName, 
      familyName,
      displayName,
      phone,
      country 
    } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      res.status(400).json({ message: 'Username, email, and password are required' });
      return;
    }
    
    const collection = await getUsersCollection();
    
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
    const userData: IUser = {
      username,
      email,
      password: hashedPassword,
      firstName,
      familyName,
      displayName: displayName || username,
      phone,
      country,
      role: 'user' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };
    
    // Create a new User instance and insert into the collection
    const newUser = new User(userData);
    const result = await collection.insertOne(newUser);
    
    // Exclude the password when returning the new user data
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        ...userWithoutPassword,
        _id: result.insertedId
      }
    });
  } catch (error) {
    logger.error('Error registering user:', error);
    res.status(500).json({ message: 'Failed to register user' });
  }
};

// Login user (handled by Passport, this is a callback)
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // Update last login time
    const collection = await getUsersCollection();
    await collection.updateOne(
      { _id: new ObjectId((req.user as IUser)._id) },
      { $set: { lastLogin: new Date() } }
    );
    
    res.status(200).json({
      message: 'Login successful',
      user: {
        id: (req.user as IUser)._id,
        username: (req.user as IUser).username,
        displayName: (req.user as IUser).displayName,
        firstName: (req.user as IUser).firstName,
        familyName: (req.user as IUser).familyName,
        email: (req.user as IUser).email,
        role: (req.user as IUser).role
      }
    });
  } catch (err) {
    logger.error('Error updating last login:', err);
    // Still return success even if updating last login fails
    res.status(200).json({
      message: 'Login successful',
      user: {
        id: (req.user as IUser)._id,
        username: (req.user as IUser).username,
        displayName: (req.user as IUser).displayName,
        firstName: (req.user as IUser).firstName,
        familyName: (req.user as IUser).familyName,
        email: (req.user as IUser).email,
        role: (req.user as IUser).role
      }
    });
  }
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
      firstName: (req.user as IUser).firstName,
      familyName: (req.user as IUser).familyName,
      email: (req.user as IUser).email,
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

// Update user profile
export const updateUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.isAuthenticated()) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }
    
    const userId = (req.user as IUser)._id;
    const { firstName, familyName, displayName, phone, country } = req.body;
    
    const collection = await getUsersCollection();
    
    await collection.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          firstName,
          familyName,
          displayName: displayName || (req.user as IUser).displayName,
          phone,
          country,
          updatedAt: new Date()
        } 
      }
    );
    
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};