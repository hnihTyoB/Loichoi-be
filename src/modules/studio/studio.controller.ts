import { Request, Response, NextFunction } from 'express';
import { StudioService } from './studio.service';
import {
  StudioThemeQueryDto,
  StudioCreateThemeDto,
  StudioUpdateThemeDto,
  StudioUpdateProfileDto,
  StudioApplyDto,
} from './studio.dto';

export class StudioController {
  private readonly service = new StudioService();

  getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const data = await this.service.getDashboardStats(userId);
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
      const userId = req.user!.id;
      const query = req.query as unknown as StudioThemeQueryDto;
      const result = await this.service.getCreatorThemes(userId, query);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  createTheme = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const body = req.body as StudioCreateThemeDto;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const data = await this.service.createTheme(userId, body, metadata);
      res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  updateTheme = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const themeId = req.params.id;
      const body = req.body as StudioUpdateThemeDto;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const data = await this.service.updateTheme(userId, themeId, body, metadata);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteTheme = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const themeId = req.params.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.deleteTheme(userId, themeId, metadata);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const body = req.body as StudioUpdateProfileDto;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const data = await this.service.updateProfile(userId, body, metadata);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  applyCreator = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const body = req.body as StudioApplyDto;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.applyCreator(userId, body, metadata);
      res.status(201).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const studioController = new StudioController();
