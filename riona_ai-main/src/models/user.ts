// models/user.ts
import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';

export interface IUser {
  _id?: ObjectId;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  familyName?: string;
  displayName?: string;
  phone?: string;
  country?: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export class User implements IUser {
  _id?: ObjectId;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  familyName?: string;
  displayName?: string;
  phone?: string;
  country?: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  isActive: boolean;

  constructor(userData: IUser) {
    this._id = userData._id;
    this.username = userData.username;
    this.email = userData.email;
    this.password = userData.password;
    this.firstName = userData.firstName;
    this.familyName = userData.familyName;
    this.displayName = userData.displayName || userData.username;
    this.phone = userData.phone;
    this.country = userData.country;
    this.role = userData.role || 'user';
    this.createdAt = userData.createdAt || new Date();
    this.updatedAt = userData.updatedAt;
    this.lastLogin = userData.lastLogin;
    this.isActive = userData.isActive !== undefined ? userData.isActive : true;
  }

  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  static async comparePassword(candidatePassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, hashedPassword);
  }
}