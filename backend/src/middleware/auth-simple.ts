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

    // For now, just use a mock user
    // In production, you'd verify the token properly
    const mockUser = {
      id: 'mock-user-id',
      email: 'mock@example.com',
      username: 'mockuser'
    };

    // Add user to request
    req.user = mockUser;
    next();
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
