import { Request, Response, NextFunction } from 'express';
import { jobsService } from './jobs.service';

export const getJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await jobsService.getPublicJobs(req.query as any, req.user?.userId);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getJobById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const job = await jobsService.getPublicJobById(jobId, req.user?.userId);
    res.status(200).json({
      status: 'success',
      data: { job },
    });
  } catch (err) {
    next(err);
  }
};

export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await jobsService.getCategories();
    res.status(200).json({
      status: 'success',
      data: { categories },
    });
  } catch (err) {
    next(err);
  }
};

export const getSources = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sources = await jobsService.getSources();
    res.status(200).json({
      status: 'success',
      data: { sources },
    });
  } catch (err) {
    next(err);
  }
};

export const saveJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await jobsService.saveJob(req.user!.userId, jobId);
    res.status(200).json({
      status: 'success',
      message: 'Job saved successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const unsaveJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await jobsService.unsaveJob(req.user!.userId, jobId);
    res.status(200).json({
      status: 'success',
      message: 'Job removed from saved list',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getSavedJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const result = await jobsService.getSavedJobs(req.user!.userId, page, limit);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const applyForJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await jobsService.applyForJob(
      req.user!.userId,
      jobId,
      req.body.coverNote
    );
    res.status(201).json({
      status: 'success',
      message: 'Application submitted successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getUserApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const result = await jobsService.getUserApplications(req.user!.userId, page, limit);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
