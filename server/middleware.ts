import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

// Add user property to Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        username: string;
        role: string;
      };
    }
  }
}

// Middleware to validate request body with Zod schema
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.body);
      req.body = result;
      next();
    } catch (error: any) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors || error.message 
      });
    }
  };
}

// Error handling middleware
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({ message });
}

// Not found middleware
export function notFound(req: Request, res: Response) {
  res.status(404).json({ message: 'Route not found' });
}

// Transaction handling middleware
export function withTransaction(handler: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // For in-memory storage, we don't need actual transaction handling,
      // but in a real database implementation, we would start a transaction here
      
      // Execute the handler
      const result = await handler(req, res, next);
      
      // If the handler returns something, send it as response
      if (result !== undefined) {
        res.json(result);
      }
      
      // In a real database implementation, we would commit the transaction here
    } catch (error) {
      // In a real database implementation, we would rollback the transaction here
      next(error);
    }
  };
}
