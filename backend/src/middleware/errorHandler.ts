import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

// Single place where thrown errors become HTTP responses. Routes throw (or let
// Prisma/Zod throw) and `express-async-errors` forwards async rejections here.
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const context = { requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0] };

  if (err instanceof ZodError) {
    logger.warn('Request rejected', { ...context, status: 400, fields: err.errors.map(e => e.path.join('.')) });
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      requestId: req.id,
      validationErrors: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  let statusCode = err.statusCode ?? 500;
  let message = err.message;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        statusCode = 409;
        message = 'A record with this value already exists';
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Record not found';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Related record does not exist';
        break;
      default:
        statusCode = 500;
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Client errors are expected traffic: log them briefly. Server errors get
  // the full stack, and their internal message is never sent to the client.
  if (statusCode >= 500) {
    logger.error('Request failed', { ...context, status: statusCode, error: err.message, stack: err.stack });
    message = 'Internal Server Error';
  } else {
    logger.warn('Request rejected', { ...context, status: statusCode, error: message });
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    requestId: req.id,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
