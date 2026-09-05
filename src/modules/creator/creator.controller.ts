import { Request, Response, NextFunction } from 'express';
import { CreatorService } from './creator.service';
import { KeyboardService } from '../keyboard/keyboard.service';
import { CreatorQueryDto, CreatorApplicationQueryDto, RejectCreatorApplicationDto } from './creator.dto';
import { KeyboardQueryDto } from '../keyboard/keyboard.dto';

export class CreatorController {
  private readonly service = new CreatorService();
  private readonly keyboardService = new KeyboardService();

  findPublicList = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as CreatorQueryDto;
      const result = await this.service.findPublicList(query);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getProfileByUsername = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const username = req.params.username;
      const currentUserId = req.user?.id;
      const data = await this.service.getProfileByUsername(username, currentUserId);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getCreatorThemes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const username = req.params.username;
      const currentUserId = req.user?.id;
      const query = req.query as unknown as KeyboardQueryDto;

      const result = await this.keyboardService.findPublicList(
        {
          ...query,
          creator: username,
        },
        currentUserId,
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  toggleFollow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const username = req.params.username;
      const currentUserId = req.user!.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.toggleFollow(username, currentUserId, metadata);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getUserFollowing = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.user!.id;
      const query = req.query as unknown as { page?: number; limit?: number };
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;

      const result = await this.service.getUserFollowing(currentUserId, page, limit);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  findApplications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as CreatorApplicationQueryDto;
      const result = await this.service.findApplications(query);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  approveApplication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId;
      const adminId = req.user?.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.approveApplication(userId, adminId, metadata);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  rejectApplication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId;
      const { reason } = req.body as RejectCreatorApplicationDto;
      const adminId = req.user?.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.rejectApplication(userId, reason, adminId, metadata);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  revokeCreator = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId;
      const adminId = req.user?.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.revokeCreator(userId, adminId, metadata);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const creatorController = new CreatorController();
