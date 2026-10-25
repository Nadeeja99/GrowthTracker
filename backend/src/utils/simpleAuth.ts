import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// Short-lived: clients refresh silently via the httpOnly refresh cookie.
const ACCESS_TOKEN_EXPIRES = '15m';
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface AccessTokenPayload {
  id: string;
  email: string;
  username: string;
  type: 'access';
  /** User.tokenVersion at issue time; a mismatch means the session was revoked. */
  ver: number;
}

interface RefreshTokenPayload {
  id: string;
  type: 'refresh';
  ver: number;
}

type TokenUser = { id: string; email: string; username: string; tokenVersion: number };

export const generateAccessToken = (user: TokenUser): string => {
  const payload: AccessTokenPayload = { id: user.id, email: user.email, username: user.username, type: 'access', ver: user.tokenVersion };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES, jwtid: randomUUID() });
};

export const generateRefreshToken = (user: Pick<TokenUser, 'id' | 'tokenVersion'>): string => {
  const payload: RefreshTokenPayload = { id: user.id, type: 'refresh', ver: user.tokenVersion };
  // A unique id makes every issued token distinct, so rotation always yields a new value.
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL_MS / 1000, jwtid: randomUUID() });
};

// Access and refresh tokens use different secrets *and* carry a `type` claim,
// so a long-lived refresh token can never be presented as an access token.
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
  if (decoded.type !== 'access' || typeof decoded.id !== 'string') {
    throw new jwt.JsonWebTokenError('Invalid token type');
  }
  // Tokens issued before versioning existed carry no `ver`; treat them as version 0.
  return { ...decoded, ver: typeof decoded.ver === 'number' ? decoded.ver : 0 } as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  if (decoded.type !== 'refresh' || typeof decoded.id !== 'string') {
    throw new jwt.JsonWebTokenError('Invalid token type');
  }
  return { ...decoded, ver: typeof decoded.ver === 'number' ? decoded.ver : 0 } as RefreshTokenPayload;
};
