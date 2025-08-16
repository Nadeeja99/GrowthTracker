import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        error.message = 'Duplicate field value entered';
        error.statusCode = 400;
        break;
      case 'P2025':
        error.message = 'Record not found';
        error.statusCode = 404;
        break;
      case 'P2003':
        error.message = 'Foreign key constraint failed';
        error.statusCode = 400;
        break;
      default:
        error.message = 'Database operation failed';
        error.statusCode = 500;
    }
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    error.message = 'Invalid data provided';
    error.statusCode = 400;
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    error.message = 'Validation failed';
    error.statusCode = 400;
    const validationErrors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    
    res.status(400).json({
      success: false,
      error: error.message,
      validationErrors,
    });
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
    error.statusCode = 401;
  }

  // Mongoose validation errors (if using MongoDB in future)
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message);
    error.message = message.join(', ');
    error.statusCode = 400;
  }

  // Mongoose cast error (if using MongoDB in future)
  if (err.name === 'CastError') {
    error.message = 'Resource not found';
    error.statusCode = 404;
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
