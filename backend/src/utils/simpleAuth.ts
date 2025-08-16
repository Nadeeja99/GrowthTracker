import crypto from 'crypto';

// Simple token generation (temporary replacement for JWT)
export const generateToken = (payload: any): string => {
  const data = JSON.stringify(payload) + Date.now() + Math.random();
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const verifyToken = (token: string): any => {
  // For now, just return a mock user ID
  // In production, you'd want proper JWT verification
  return { id: 'mock-user-id' };
};

export const generateAccessToken = (user: any): string => {
  return generateToken({
    id: user.id,
    email: user.email,
    username: user.username,
    type: 'access'
  });
};

export const generateRefreshToken = (user: any): string => {
  return generateToken({
    id: user.id,
    type: 'refresh'
  });
};
