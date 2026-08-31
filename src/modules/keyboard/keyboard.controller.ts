import { Request, Response, NextFunction } from 'express';
import { KeyboardService } from './keyboard.service';
import {
  KeyboardQueryDto,
  KeyboardManagementQueryDto,
  CreateKeyboardDto,
  UpdateKeyboardDto,
  GetThemeImageUploadUrlDto,
  GetThemeBatchImageUploadUrlsDto,
} from './keyboard.dto';

export class KeyboardController {
  private readonly service = new KeyboardService();

  getImageUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as GetThemeImageUploadUrlDto;
      const userId = req.user!.id;
      const result = await this.service.getImageUploadUrl(userId, body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getBatchImageUploadUrls = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as GetThemeBatchImageUploadUrlsDto;
      const userId = req.user!.id;
      const result = await this.service.getBatchImageUploadUrls(userId, body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findPublicList = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as KeyboardQueryDto;
      const currentUserId = req.user?.id;
      const result = await this.service.findPublicList(query, currentUserId);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  findPublicBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.user?.id;
      const data = await this.service.findPublicBySlug(req.params.slug, currentUserId);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  toggleLike = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params.slug;
      const userId = req.user!.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.toggleLike(slug, userId, metadata);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  findUserLikedThemes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      const result = await this.service.findUserLikedThemes(userId, page, limit);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  findManagementList = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as KeyboardManagementQueryDto;
      const result = await this.service.findManagementList(query);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  findManagementById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findManagementById(req.params.id);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateKeyboardDto;
      const actorId = req.user?.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const data = await this.service.create(body, actorId, metadata);
      res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateKeyboardDto;
      const actorId = req.user?.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const data = await this.service.update(req.params.id, body, actorId, metadata);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.delete(req.params.id, actorId, metadata);
      res.json({
        success: true,
        message: result.message,
        archived: result.archived,
      });
    } catch (error) {
      next(error);
    }
  };

  bulkDelete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ids } = req.body as { ids: string[] };
      const actorId = req.user?.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.bulkDelete(ids, actorId, metadata);
      res.json({
        success: true,
        data: result,
        message: `Đã xóa thành công ${result.totalDeleted}/${result.totalRequested} giao diện bàn phím`,
      });
    } catch (error) {
      next(error);
    }
  };

  download = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params.slug;
      const user = req.user;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const downloadUrl = await this.service.processDownload(slug, user, metadata);

      if (req.query.format === 'json' || req.headers.accept?.includes('application/json') || req.is('application/json')) {
        res.json({
          success: true,
          data: {
            downloadUrl,
          },
        });
        return;
      }

      // Chuyển hướng 302 trực tiếp tới nguồn tải đã được allowlist.
      res.redirect(302, downloadUrl);
    } catch (error) {
      next(error);
    }
  };

  resetUserQuota = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.params.userId;
      const actorId = req.user?.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.resetUserQuota(targetUserId, actorId, metadata);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const keyboardController = new KeyboardController();
