import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { verifyToken } from '../utils/simpleAuth';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
    else if (req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.',
      });
      return;
    }

    // For now, use a mock user or find/create a test user
    // In production, you'd verify the token properly
    try {
      // Try to find or create a test user
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: 'test@example.com' },
            { username: 'testuser' }
          ]
        }
      });

      if (!user) {
        // Create a test user if none exists
        user = await prisma.user.create({
          data: {
            email: 'test@example.com',
            username: 'testuser',
            password: 'hashed-password-placeholder', // Not used in mock auth
          }
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        username: user.username
      };
      next();
    } catch (error) {
      // Fallback to mock user if database operation fails
      const mockUser = {
        id: 'mock-user-id',
        email: 'mock@example.com',
        username: 'mockuser'
      };
      req.user = mockUser;
      next();
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Token verification failed.',
    });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      // For now, just use a mock user
      const mockUser = {
        id: 'mock-user-id',
        email: 'mock@example.com',
        username: 'mockuser'
      };
      req.user = mockUser;
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
