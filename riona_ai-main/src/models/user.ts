// models/User.ts
import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';

// Dans models/User.ts
export interface IUser {
    _id?: ObjectId;
    username: string;
    email: string;
    password: string;
    displayName?: string;
    role: 'admin' | 'user';
    createdAt: Date;
    lastLogin?: Date;
    isActive: boolean;
    comparePassword?: (candidatePassword: string) => Promise<boolean>;
  }
  

export class User implements IUser {
  _id?: ObjectId;
  username: string;
  email: string;
  password: string;
  displayName?: string;
  role: 'admin' | 'user';
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;

  constructor(user: IUser) {
    this._id = user._id;
    this.username = user.username;
    this.email = user.email;
    this.password = user.password;
    this.displayName = user.displayName;
    this.role = user.role || 'user';
    this.createdAt = user.createdAt || new Date();
    this.lastLogin = user.lastLogin;
    this.isActive = user.isActive !== undefined ? user.isActive : true;
  }

  async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
    
  }
  

  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
}
