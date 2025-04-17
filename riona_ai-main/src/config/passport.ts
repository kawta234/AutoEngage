import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { IUser, User } from '../models/user';
import { ObjectId, Document, WithId } from 'mongodb';
import logger from './logger';
import { connectToDatabase } from './db';

// Define a type that represents the user as stored in MongoDB
type UserDocument = WithId<Document> & IUser;

// Added getUsersCollection function since it was missing
async function getUsersCollection() {
  const { db } = await connectToDatabase();
  return db.collection<IUser>('users');
}

export function configurePassport(): void {
  // Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const collection = await getUsersCollection();
        
        // Trouver l'utilisateur par username ou email
        const user = await collection.findOne({
          $or: [{ username }, { email: username }],
        }) as UserDocument | null;
        
        if (!user) {
          return done(null, false, { message: 'Incorrect username or password' });
        }
        
        // Vérifier que l'utilisateur est actif
        if (!user.isActive) {
          return done(null, false, { message: 'Account is disabled' });
        }
        
        // Ajoutez ici : instanciation et vérification du mot de passe
        const userInstance = new User(user);
        const isMatch = await userInstance.comparePassword(password);
        
        if (!isMatch) {
          return done(null, false, { message: 'Incorrect username or password' });
        }
        
        return done(null, user as IUser);
      } catch (error) {
        logger.error('Passport authentication error:', error);
        return done(error);
      }
    })
  );
  
  // Serialization with proper type handling
  passport.serializeUser((user: Express.User, done) => {
    const userWithId = user as unknown as UserDocument;
    const userId = userWithId._id?.toString();
    done(null, userId);
  });
  
  // Deserialization with proper type handling
  passport.deserializeUser(async (id: string, done) => {
    try {
      const collection = await getUsersCollection();
      const user = await collection.findOne({ _id: new ObjectId(id) }) as UserDocument | null;
      if (!user) {
        return done(null, undefined);
      }
      done(null, user as IUser);
    } catch (error) {
      logger.error('Passport deserialization error:', error);
      done(error);
    }
  });
}