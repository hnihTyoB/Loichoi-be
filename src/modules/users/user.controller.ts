import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { UserQueryDto, CreateUserDto, UpdateUserDto } from './user.dto';

export class UserController {
  private readonly service = new UserService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as UserQueryDto;
      const result = await this.service.findAll(query);

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findById(req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateUserDto;
      const result = await this.service.create(body);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateUserDto;
      const result = await this.service.update(req.params.id, body);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  softDelete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      await this.service.softDelete(id, adminId);

      res.json({
        success: true,
        message: 'User soft-deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getUserSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = await this.service.getUserSessions(id);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  revokeUserSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, sessionId } = req.params;
      const adminId = req.user?.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      await this.service.revokeUserSession(id, sessionId, adminId, metadata);
      res.json({
        success: true,
        message: 'Phiên đăng nhập của người dùng đã được thu hồi thành công',
      });
    } catch (error) {
      next(error);
    }
  };

  revokeAllUserSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.service.revokeAllUserSessions(id, adminId, metadata);
      res.json({
        success: true,
        message: `Đã thu hồi toàn bộ (${result.count}) phiên đăng nhập của người dùng`,
      });
    } catch (error) {
      next(error);
    }
  };

  getUserDevices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = await this.service.getUserDevices(id);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteUserDevice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, deviceId } = req.params;
      const adminId = req.user?.id;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      await this.service.deleteUserDevice(id, deviceId, adminId, metadata);
      res.json({
        success: true,
        message: 'Thiết bị của người dùng đã được xóa thành công',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const userController = new UserController();
