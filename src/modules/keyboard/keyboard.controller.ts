import { Request, Response, NextFunction } from 'express';
import { KeyboardService } from './keyboard.service';
import {
  KeyboardQueryDto,
  KeyboardManagementQueryDto,
  CreateKeyboardDto,
  UpdateKeyboardDto,
} from './keyboard.dto';

export class KeyboardController {
  private readonly service = new KeyboardService();

  findPublicList = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as KeyboardQueryDto;
      const result = await this.service.findPublicList(query);
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
      const data = await this.service.findPublicBySlug(req.params.slug);
      res.json({
        success: true,
        data,
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

  download = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params.slug;
      const user = req.user;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const driveUrl = await this.service.processDownload(slug, user, metadata);

      // Chuyển hướng 302 trực tiếp sang Google Drive
      res.redirect(302, driveUrl);
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
