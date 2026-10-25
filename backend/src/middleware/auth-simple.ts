import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { verifyAccessToken } from '../utils/simpleAuth';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    timezone: string;
  };
}

export const authenticate = async (
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

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.',
      });
      return;
    }

    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, username: true, timezone: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found.',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    // TokenExpiredError extends JsonWebTokenError, so it must be checked first.
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: 'Token expired.' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, error: 'Invalid token.' });
    } else {
      res.status(500).json({ success: false, error: 'Token verification failed.' });
    }
  }
};
