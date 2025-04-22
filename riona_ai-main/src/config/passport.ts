import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { IUser, User } from '../models/user';
import { ObjectId } from 'mongodb';
import logger from './logger';
import { connectToDatabase, getUsersCollection } from './db';

export async function configurePassport(): Promise<void> {
  // Ensure database is connected before configuring passport
  await connectToDatabase();

  // Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const collection = getUsersCollection();
        
        // Find user by username or email
        const user = await collection.findOne({
          $or: [{ username }, { email: username }],
        });
        
        if (!user) {
          return done(null, false, { message: 'Incorrect username or password' });
        }
        
        // Check if user is active
        if (!user.isActive) {
          return done(null, false, { message: 'Account is disabled' });
        }
        
        // Make sure we have a proper hash to compare against
        const passwordHash = user.password;
        if (typeof passwordHash !== 'string') {
          logger.error('Invalid password hash format in database');
          return done(null, false, { message: 'Authentication error' });
        }
        
        // Make sure password is a string
        if (typeof password !== 'string') {
          logger.error('Invalid password format provided');
          return done(null, false, { message: 'Authentication error' });
        }
        
        // Use the static comparePassword method
        try {
          const isMatch = await User.comparePassword(password, passwordHash);
          
          if (!isMatch) {
            return done(null, false, { message: 'Incorrect username or password' });
          }
          
          return done(null, user);
        } catch (bcryptError) {
          logger.error('Password comparison error:', bcryptError);
          return done(null, false, { message: 'Authentication error' });
        }
      } catch (error) {
        logger.error('Passport authentication error:', error);
        return done(error);
      }
    })
  );
  
  // Serialization
  passport.serializeUser((user: Express.User, done) => {
    const userId = (user as any)._id?.toString();
    done(null, userId);
  });
  
  // Deserialization
  passport.deserializeUser(async (id: string, done) => {
    try {
      if (!ObjectId.isValid(id)) {
        return done(null, false);
      }
      
      const collection = getUsersCollection();
      const user = await collection.findOne({ _id: new ObjectId(id) });
      
      if (!user) {
        return done(null, false);
      }
      
      done(null, user);
    } catch (error) {
      logger.error('Passport deserialization error:', error);
      done(error);
    }
  });
}

// Function to initialize passport in your app
export async function initializePassport(app: any): Promise<void> {
  await configurePassport();
  
  app.use(passport.initialize());
  app.use(passport.session());
  
  logger.info('Passport initialized successfully');
}