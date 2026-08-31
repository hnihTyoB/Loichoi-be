import { Request, Response, NextFunction } from 'express';
import { DiscordImportService } from './discord-import.service';
import type {
  CreateImportJobBody,
  ListImportJobsQuery,
  UpdateDraftBody,
  BulkApproveBody,
  RejectImportBody,
} from './discord-import.validation';

export class DiscordImportController {
  private readonly service = new DiscordImportService();

  // POST /imports
  createImportJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateImportJobBody;
      const actorId = req.user!.id;
      const result = await this.service.createImportJob(body, actorId);
      res.status(result.isNew ? 201 : 200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /imports
  listImportJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListImportJobsQuery;
      const result = await this.service.listImportJobs({
        status: query.status,
        validationStatus: query.validationStatus,
        isDuplicateCandidate: query.isDuplicateCandidate as boolean | undefined,
        minConfidence: query.minConfidence as number | undefined,
        hasFlags: query.hasFlags as boolean | undefined,
        page: query.page as number | undefined,
        limit: query.limit as number | undefined,
      });
      res.json({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /imports/:id
  getImportJobById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.service.getImportJobById(id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /imports/:id/draft
  updateDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const body = req.body as UpdateDraftBody;
      const actorId = req.user!.id;
      const result = await this.service.updateDraft(id, body, actorId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /imports/:id/approve
  approveImportJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const actorId = req.user!.id;
      const result = await this.service.approveImportJob(id, actorId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /imports/bulk-approve
  bulkApprove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as BulkApproveBody;
      const actorId = req.user!.id;
      const result = await this.service.bulkApprove(body.jobIds, actorId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /imports/:id/reject
  rejectImportJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const body = req.body as RejectImportBody;
      const actorId = req.user!.id;
      await this.service.rejectImportJob(id, body.reason, actorId);
      res.json({
        success: true,
        message: 'Import job rejected successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /imports/:id/reprocess
  reprocessImportJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const actorId = req.user!.id;
      await this.service.reprocessImportJob(id, actorId);
      res.json({
        success: true,
        message: 'Import job queued for reprocessing',
      });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /imports/reset
  resetAllImports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const result = await this.service.resetAllImports(actorId);
      res.json({
        success: true,
        data: result,
        message: 'Đã xóa toàn bộ dữ liệu import để thử nghiệm từ đầu',
      });
    } catch (error) {
      next(error);
    }
  };
}
