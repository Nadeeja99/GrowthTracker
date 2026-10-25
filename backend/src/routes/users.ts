import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { updateUserSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Update user profile
router.put('/profile', async (req: AuthRequest, res) => {
  const validatedData = updateUserSchema.parse(req.body);
  const userId = req.user!.id;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: validatedData,
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      timezone: true,
      avatar: true,
      updatedAt: true,
    }
  });

  logger.info('User profile updated', { userId });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user: updatedUser }
  });
});

export default router;
