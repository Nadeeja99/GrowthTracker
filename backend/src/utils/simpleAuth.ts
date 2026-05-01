import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRES = '7d';
const REFRESH_TOKEN_EXPIRES = '30d';

export const generateAccessToken = (user: { id: string; email: string; username: string }): string => {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
};

export const generateRefreshToken = (user: { id: string }): string => {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );
};

export const verifyToken = (token: string): { id: string; email?: string; username?: string; type: string } => {
  return jwt.verify(token, JWT_SECRET) as any;
};
