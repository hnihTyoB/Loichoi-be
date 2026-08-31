import { Router } from 'express';
import { DiscordImportController } from './discord-import.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { PERMISSIONS } from '../../common/constants/permission.constant';
import {
  CreateImportJobSchema,
  ListImportJobsQuerySchema,
  UpdateDraftSchema,
  BulkApproveSchema,
  RejectImportSchema,
  ImportJobIdParamSchema,
} from './discord-import.validation';

const router = Router();
const controller = new DiscordImportController();

// POST /api/v1/imports — Receive raw thread data from Discord Bot / manual input
router.post(
  '/',
  authMiddleware,
  requirePermission(PERMISSIONS.IMPORT_MANAGE),
  validate(CreateImportJobSchema),
  controller.createImportJob,
);

// DELETE /api/v1/imports/reset — Purge all import jobs and threads for clean testing
router.delete(
  '/reset',
  authMiddleware,
  requirePermission(PERMISSIONS.IMPORT_MANAGE),
  controller.resetAllImports,
);

// POST /api/v1/imports/bulk-approve — Bulk approve (must be before /:id routes)
router.post(
  '/bulk-approve',
  authMiddleware,
  requirePermission(PERMISSIONS.IMPORT_APPROVE),
  validate(BulkApproveSchema),
  controller.bulkApprove,
);

// GET /api/v1/imports — List with filters
router.get(
  '/',
  authMiddleware,
  requirePermission(PERMISSIONS.IMPORT_READ),
  validate(ListImportJobsQuerySchema, 'query'),
  controller.listImportJobs,
);

// GET /api/v1/imports/:id — Detail
router.get(
  '/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.IMPORT_READ),
  validate(ImportJobIdParamSchema, 'params'),
  controller.getImportJobById,
);

// PATCH /api/v1/imports/:id/draft — Admin edits draft before approve
router.patch(
  '/:id/draft',
  authMiddleware,
  requirePermission(PERMISSIONS.IMPORT_MANAGE),
  validate(ImportJobIdParamSchema, 'params'),
  validate(UpdateDraftSchema),
  controller.updateDraft,
);

// POST /api/v1/imports/:id/approve — Approve single job → publish keyboard
router.post(
  '/:id/approve',
  authMiddleware,
  requirePermission(PERMISSIONS.IMPORT_APPROVE),
  validate(ImportJobIdParamSchema, 'params'),
  controller.approveImportJob,
);

// POST /api/v1/imports/:id/reject — Reject job
router.post(
  '/:id/reject',
  authMiddleware,
  requirePermission(PERMISSIONS.IMPORT_MANAGE),
  validate(ImportJobIdParamSchema, 'params'),
  validate(RejectImportSchema),
  controller.rejectImportJob,
);

// POST /api/v1/imports/:id/reprocess — Re-run parsing for failed jobs
router.post(
  '/:id/reprocess',
  authMiddleware,
  requirePermission(PERMISSIONS.IMPORT_MANAGE),
  validate(ImportJobIdParamSchema, 'params'),
  controller.reprocessImportJob,
);

export default router;
