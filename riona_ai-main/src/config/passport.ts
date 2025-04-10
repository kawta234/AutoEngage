// config/passport.ts
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { getUsersCollection } from './db';
import { IUser, User } from '../models/user';
import { ObjectId } from 'mongodb';
import logger from './logger';

// Removed the import causing the error:
// import { User as ExpressUser } from 'express-serve-static-core';

export function configurePassport(): void {
  // Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const collection = getUsersCollection();
  
        // Trouver l'utilisateur par username ou email
        const user = await collection.findOne({
          $or: [{ username }, { email: username }],
        });
  
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
  
        return done(null, user);
      } catch (error) {
        logger.error('Passport authentication error:', error);
        return done(error);
      }
    })
  );
  
// Dans config/passport.ts

  // Local Strategy reste inchangée
  
  // @ts-ignore - Ignorer les erreurs de typage pour ces fonctions
  passport.serializeUser((user: IUser & { _id?: string }, done: (err: any, id?: string) => void) => {
    done(null, user._id?.toString());
  });
  
  passport.deserializeUser(async (id: string, done: (err: any, user?: IUser) => void) => {
    try {
      const collection = getUsersCollection();
      const user = await collection.findOne({ _id: new ObjectId(id) });
      if (user === null) {
        return done(null, undefined);
      }
      done(null, user);
    } catch (error) {
      logger.error('Passport deserialization error:', error);
      done(error);
    }
  });
  
  


}
