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

export const confirmExtractedProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await profileService.confirmExtractedProfile(req.user!.userId, req.body);
    res.status(200).json({
      status: 'success',
      message: 'Extracted CV data confirmed and imported into profile',
      data: { profile },
    });
  } catch (err) {
    next(err);
  }
};

// Experience
export const addExperience = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experience = await profileService.addExperience(req.user!.userId, req.body);
    res.status(201).json({ status: 'success', data: { experience } });
  } catch (err) {
    next(err);
  }
};

export const updateExperience = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const experience = await profileService.updateExperience(req.user!.userId, id, req.body);
    res.status(200).json({ status: 'success', data: { experience } });
  } catch (err) {
    next(err);
  }
};

export const deleteExperience = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await profileService.deleteExperience(req.user!.userId, id);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

// Education
export const addEducation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const education = await profileService.addEducation(req.user!.userId, req.body);
    res.status(201).json({ status: 'success', data: { education } });
  } catch (err) {
    next(err);
  }
};

export const updateEducation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const education = await profileService.updateEducation(req.user!.userId, id, req.body);
    res.status(200).json({ status: 'success', data: { education } });
  } catch (err) {
    next(err);
  }
};

export const deleteEducation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await profileService.deleteEducation(req.user!.userId, id);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

// Certifications
export const addCertification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const certification = await profileService.addCertification(req.user!.userId, req.body);
    res.status(201).json({ status: 'success', data: { certification } });
  } catch (err) {
    next(err);
  }
};

export const deleteCertification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await profileService.deleteCertification(req.user!.userId, id);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

// Projects
export const addProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await profileService.addProject(req.user!.userId, req.body);
    res.status(201).json({ status: 'success', data: { project } });
  } catch (err) {
    next(err);
  }
};

export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await profileService.deleteProject(req.user!.userId, id);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

// Skills
export const addSkill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skill = await profileService.addSkill(req.user!.userId, req.body);
    res.status(201).json({ status: 'success', data: { skill } });
  } catch (err) {
    next(err);
  }
};

export const deleteSkill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await profileService.deleteSkill(req.user!.userId, id);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

// Languages
export const addLanguage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const language = await profileService.addLanguage(req.user!.userId, req.body);
    res.status(201).json({ status: 'success', data: { language } });
  } catch (err) {
    next(err);
  }
};

export const deleteLanguage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await profileService.deleteLanguage(req.user!.userId, id);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

// Achievements
export const addAchievement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const achievement = await profileService.addAchievement(req.user!.userId, req.body);
    res.status(201).json({ status: 'success', data: { achievement } });
  } catch (err) {
    next(err);
  }
};

export const deleteAchievement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await profileService.deleteAchievement(req.user!.userId, id);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};
