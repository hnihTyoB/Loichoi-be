import { Request, Response, NextFunction } from 'express';
import { CollectionService } from './collection.service';
import {
  CollectionQueryDto,
  CreateCollectionDto,
  UpdateCollectionDto,
  AddCollectionItemDto,
} from './collection.dto';

export class CollectionController {
  private readonly service = new CollectionService();

  findPublicList = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as CollectionQueryDto;
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
      const slug = req.params.slug;
      const data = await this.service.findPublicBySlug(slug);
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
      const body = req.body as CreateCollectionDto;
      const userId = req.user!.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const data = await this.service.create(body, userId, metadata);
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
      const id = req.params.id;
      const body = req.body as UpdateCollectionDto;
      const userId = req.user!.id;
      const userRole = req.user?.role;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const data = await this.service.update(id, body, userId, userRole, metadata);
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
      const id = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user?.role;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.delete(id, userId, userRole, metadata);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  addTheme = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const collectionId = req.params.id;
      const body = req.body as AddCollectionItemDto;
      const userId = req.user!.id;
      const userRole = req.user?.role;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.addTheme(
        collectionId,
        body.themeId,
        body.position,
        userId,
        userRole,
        metadata,
      );
      res.status(201).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  removeTheme = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const collectionId = req.params.id;
      const themeId = req.params.themeId;
      const userId = req.user!.id;
      const userRole = req.user?.role;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.removeTheme(
        collectionId,
        themeId,
        userId,
        userRole,
        metadata,
      );
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const collectionController = new CollectionController();
