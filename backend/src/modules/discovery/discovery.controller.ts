import { Request, Response, NextFunction } from 'express';
import { searchRegistryService, SearchRegistryService } from './search-registry.service';
import { aiSearchPlannerService, AISearchPlannerService } from './ai-search-planner.service';
import { discoveryService, DiscoveryService } from './discovery.service';
import { linkedinAdapter, LinkedInAdapter } from './adapters/linkedin.adapter';
import { linkedInCompaniesService, LinkedInCompaniesService } from './linkedin-companies.service';
import { SearchDefinitionStatus, DiscoveryReferenceStatus, LinkedInCompanyStatus } from '@prisma/client';

export class DiscoveryController {
  constructor(
    private readonly registry: SearchRegistryService = searchRegistryService,
    private readonly planner: AISearchPlannerService = aiSearchPlannerService,
    private readonly discovery: DiscoveryService = discoveryService,
    private readonly lAdapter: LinkedInAdapter = linkedinAdapter,
    private readonly companiesService: LinkedInCompaniesService = linkedInCompaniesService
  ) {}

  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.registry.getDiscoveryStats();
      res.status(200).json({ status: 'success', data: stats });
    } catch (err) {
      next(err);
    }
  };

  getCoverageGaps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const gaps = await this.registry.analyzeCoverageGaps();
      res.status(200).json({ status: 'success', data: { gaps } });
    } catch (err) {
      next(err);
    }
  };

  getSearches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categorySlug = typeof req.query.categorySlug === 'string' ? req.query.categorySlug : undefined;
      const status = typeof req.query.status === 'string' ? (req.query.status as SearchDefinitionStatus) : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

      const result = await this.registry.getSearches({ categorySlug, status, search, page, limit });
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  generatePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dryRun = req.body?.dryRun !== false; // default true for safety preview
      const categorySlugs = Array.isArray(req.body?.categorySlugs) ? req.body.categorySlugs : undefined;
      const maxPerCategory = typeof req.body?.maxPerCategory === 'number' ? req.body.maxPerCategory : 6;
      const includeRemote = req.body?.includeRemote !== false;
      const includeCities = req.body?.includeCities !== false;
      const includeLocalTerms = req.body?.includeLocalTerms !== false;

      const plannedSearches = await this.planner.generateSearchPlan({
        categorySlugs,
        maxPerCategory,
        includeRemote,
        includeCities,
        includeLocalTerms,
      });

      if (dryRun) {
        res.status(200).json({
          status: 'success',
          data: {
            dryRun: true,
            totalGenerated: plannedSearches.length,
            searches: plannedSearches,
          },
        });
        return;
      }

      // Persist plan to registry
      const saveResult = await this.registry.savePlannedSearches(plannedSearches);

      res.status(201).json({
        status: 'success',
        data: {
          dryRun: false,
          totalGenerated: plannedSearches.length,
          ...saveResult,
          searches: plannedSearches,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const status = req.body?.status as SearchDefinitionStatus;

      if (!['ACTIVE', 'PAUSED', 'DISABLED'].includes(status)) {
        res.status(400).json({ status: 'error', message: 'Invalid status. Must be ACTIVE, PAUSED, or DISABLED.' });
        return;
      }

      const updated = await this.registry.updateStatus(id, status);
      res.status(200).json({ status: 'success', data: { search: updated } });
    } catch (err) {
      next(err);
    }
  };

  runSearch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await this.discovery.executeSearch(id);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  deleteSearch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await this.registry.deleteSearch(id);
      res.status(200).json({ status: 'success', message: 'Search definition deleted.' });
    } catch (err) {
      next(err);
    }
  };

  runAdaptiveOptimization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.discovery.runAdaptiveOptimization();
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  // =========================================================================
  // Discovery References (LinkedIn & URL Intake)
  // =========================================================================
  getReferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = typeof req.query.status === 'string' ? (req.query.status as DiscoveryReferenceStatus) : undefined;
      const sourceSlug = typeof req.query.sourceSlug === 'string' ? req.query.sourceSlug : undefined;
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

      const result = await this.discovery.getReferences({ status, sourceSlug, page, limit });
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  captureReference = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const result = await this.discovery.captureReference({
        url: req.body?.url,
        title: req.body?.title,
        companyName: req.body?.companyName,
        location: req.body?.location,
        workArrangement: req.body?.workArrangement,
        categorySlug: req.body?.categorySlug,
        notes: req.body?.notes,
        capturedByUserId: userId,
      });

      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  reviewReference = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const action = req.body?.action as 'ACCEPT' | 'REJECT';
      const notes = req.body?.notes;

      if (!['ACCEPT', 'REJECT'].includes(action)) {
        res.status(400).json({ status: 'error', message: 'Action must be ACCEPT or REJECT.' });
        return;
      }

      const result = await this.discovery.reviewReference(id, action, notes);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  getComplianceReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = this.lAdapter.getDiscoveryComplianceReport();
      res.status(200).json({ status: 'success', data: report });
    } catch (err) {
      next(err);
    }
  };

  // =========================================================================
  // LinkedIn Companies Directory (Admin Only)
  // =========================================================================
  getCompanies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const status = typeof req.query.status === 'string' ? (req.query.status as LinkedInCompanyStatus) : undefined;
      const industry = typeof req.query.industry === 'string' ? req.query.industry : undefined;
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

      const result = await this.companiesService.getCompanies({ search, status, industry, page, limit });
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  upsertCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.companiesService.upsertCompany(req.body);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  updateCompanyStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const status = req.body?.status as LinkedInCompanyStatus;
      if (!['ACTIVE', 'WATCHED', 'PAUSED'].includes(status)) {
        res.status(400).json({ status: 'error', message: 'Status must be ACTIVE, WATCHED, or PAUSED.' });
        return;
      }
      const result = await this.companiesService.updateStatus(id, status);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  deleteCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await this.companiesService.deleteCompany(id);
      res.status(200).json({ status: 'success', message: 'Company deleted successfully.' });
    } catch (err) {
      next(err);
    }
  };
}

export const discoveryController = new DiscoveryController();

