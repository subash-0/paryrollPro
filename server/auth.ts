import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { storage } from './storage';
import { InsertUser, LoginUser, User } from '@shared/schema';

// JWT secret key - in a real app, should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'payroll_app_secret_key';
const JWT_EXPIRES_IN = '24h';

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Generate JWT token
export function generateToken(user: User): string {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verify JWT token
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Register a new user
export async function registerUser(userData: InsertUser): Promise<User> {
  // Check if username already exists
  const existingUser = await storage.getUserByUsername(userData.username);
  if (existingUser) {
    throw new Error('Username already exists');
  }
  
  // Hash the password
  const hashedPassword = await hashPassword(userData.password);
  
  // Create the user with hashed password
  const user = await storage.createUser({
    ...userData,
    password: hashedPassword
  });
  
  return user;
}

// Login user
export async function loginUser(loginData: LoginUser): Promise<{ user: User, token: string }> {
  const user = await storage.getUserByUsername(loginData.username);
  if (!user) {
    throw new Error('Invalid username or password');
  }
  
  const isPasswordValid = await verifyPassword(loginData.password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid username or password');
  }
  
  const token = generateToken(user);
  
  return { user, token };
}

// Authentication middleware
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    let token: string | undefined;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    // Add user data to request
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed' });
  }
}

// Authorization middleware for admin role
export function authorizeAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  next();
}
