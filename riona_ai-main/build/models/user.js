"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
class User {
    _id;
    username;
    email;
    password;
    firstName;
    familyName;
    displayName;
    phone;
    country;
    role;
    createdAt;
    updatedAt;
    lastLogin;
    isActive;
    constructor(userData) {
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
    static async hashPassword(password) {
        const salt = await bcrypt_1.default.genSalt(10);
        return bcrypt_1.default.hash(password, salt);
    }
    static async comparePassword(candidatePassword, hashedPassword) {
        return bcrypt_1.default.compare(candidatePassword, hashedPassword);
    }
}
exports.User = User;
