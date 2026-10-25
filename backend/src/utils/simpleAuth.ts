import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const ACCESS_TOKEN_EXPIRES = '7d';
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface AccessTokenPayload {
  id: string;
  email: string;
  username: string;
  type: 'access';
}

interface RefreshTokenPayload {
  id: string;
  type: 'refresh';
}

export const generateAccessToken = (user: { id: string; email: string; username: string }): string => {
  const payload: AccessTokenPayload = { id: user.id, email: user.email, username: user.username, type: 'access' };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
};

export const generateRefreshToken = (user: { id: string }): string => {
  const payload: RefreshTokenPayload = { id: user.id, type: 'refresh' };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL_MS / 1000 });
};

// Access and refresh tokens use different secrets *and* carry a `type` claim,
// so a long-lived refresh token can never be presented as an access token.
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
  if (decoded.type !== 'access' || typeof decoded.id !== 'string') {
    throw new jwt.JsonWebTokenError('Invalid token type');
  }
  return decoded as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  if (decoded.type !== 'refresh' || typeof decoded.id !== 'string') {
    throw new jwt.JsonWebTokenError('Invalid token type');
  }
  return decoded as RefreshTokenPayload;
};
