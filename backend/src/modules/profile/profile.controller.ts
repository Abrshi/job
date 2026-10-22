import { Request, Response, NextFunction } from 'express';
import { profileService } from './profile.service';

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await profileService.getProfile(req.user!.userId);
    res.status(200).json({
      status: 'success',
      data: { profile },
    });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await profileService.updateProfile(req.user!.userId, req.body);
    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: { profile },
    });
  } catch (err) {
    next(err);
  }
};

