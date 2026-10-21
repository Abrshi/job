import { Request, Response } from 'express';
import { sourcesService, SourcesService } from './sources.service';
import { sourceScheduler, SourceScheduler } from '../scheduler/scheduler.service';

function getParamId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : (id as string);
}

export class SourcesController {
  constructor(
    private readonly service: SourcesService = sourcesService,
    private readonly scheduler: SourceScheduler = sourceScheduler
  ) {}

  listSources = async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    const result = await this.service.getSources({ page, limit, isActive });
    res.status(200).json({
      status: 'success',
      data: result,
    });
  };

  getSource = async (req: Request, res: Response) => {
    const source = await this.service.getSourceById(getParamId(req));
    res.status(200).json({
      status: 'success',
      data: { source },
    });
  };

  createSource = async (req: Request, res: Response) => {
    const source = await this.service.createSource(req.body);
    await this.scheduler.refreshSchedule();
    res.status(201).json({
      status: 'success',
      data: { source },
    });
  };

  updateSource = async (req: Request, res: Response) => {
    const source = await this.service.updateSource(getParamId(req), req.body);
    await this.scheduler.refreshSchedule();
    res.status(200).json({
      status: 'success',
      data: { source },
    });
  };

  triggerRun = async (req: Request, res: Response) => {
    const run = await this.service.runCollection(getParamId(req));
    res.status(200).json({
      status: 'success',
      message: 'Collection run triggered successfully',
      data: { run },
    });
  };

  getSourceRuns = async (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 20;
    const runs = await this.service.getRunsForSource(getParamId(req), limit);
    res.status(200).json({
      status: 'success',
      data: { runs },
    });
  };

  getSourceStats = async (req: Request, res: Response) => {
    const stats = await this.service.getSourceStats(getParamId(req));
    res.status(200).json({
      status: 'success',
      data: { stats },
    });
  };

  getAllRuns = async (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 30;
    const runs = await this.service.getAllRuns(limit);
    res.status(200).json({
      status: 'success',
      data: { runs },
    });
  };
}

export const sourcesController = new SourcesController();
