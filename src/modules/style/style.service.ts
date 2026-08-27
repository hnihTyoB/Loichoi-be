import { StyleRepository } from './style.repository';
import { CreateStyleDto, UpdateStyleDto, StyleQueryDto } from './style.dto';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { toSlug } from '../../common/helpers/slug.helper';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';

export class StyleService {
  private readonly repository = new StyleRepository();

  async findPublicStyles() {
    return this.repository.findPublicStyles();
  }

  async findAll(query: StyleQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const style = await this.repository.findById(id);
    if (!style) {
      throw new AppError('Phong cách không tồn tại', 404, ERROR_CODE.STYLE_NOT_FOUND);
    }
    return style;
  }

  async create(
    data: CreateStyleDto,
    actorId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const slug = data.slug ? toSlug(data.slug) : toSlug(data.name);

    if (!slug) {
      throw new AppError('Không thể tạo định danh (slug) hợp lệ từ tên phong cách', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    const existingSlug = await this.repository.findBySlug(slug);
    if (existingSlug) {
      throw new AppError('Đường dẫn định danh (slug) của phong cách đã tồn tại', 409, ERROR_CODE.STYLE_SLUG_EXISTS);
    }

    const style = await this.repository.create({
      name: data.name,
      slug,
      description: data.description,
    });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.CREATE_STYLE,
      targetType: AUDIT_TARGET_TYPE.STYLE,
      targetId: style.id,
      details: {
        name: style.name,
        slug: style.slug,
        description: style.description,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return style;
  }

  async update(
    id: string,
    data: UpdateStyleDto,
    actorId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const style = await this.findById(id);

    let slug = style.slug;
    if (data.slug) {
      slug = toSlug(data.slug);
      if (slug !== style.slug) {
        const existing = await this.repository.findBySlug(slug);
        if (existing && existing.id !== id) {
          throw new AppError('Đường dẫn định danh (slug) của phong cách đã tồn tại', 409, ERROR_CODE.STYLE_SLUG_EXISTS);
        }
      }
    }

    const updated = await this.repository.update(id, {
      name: data.name,
      slug,
      description: data.description,
    });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_STYLE,
      targetType: AUDIT_TARGET_TYPE.STYLE,
      targetId: id,
      details: {
        before: {
          name: style.name,
          slug: style.slug,
          description: style.description,
        },
        after: {
          name: updated.name,
          slug: updated.slug,
          description: updated.description,
        },
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return updated;
  }

  async delete(
    id: string,
    actorId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const style = await this.findById(id);

    await this.repository.delete(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_STYLE,
      targetType: AUDIT_TARGET_TYPE.STYLE,
      targetId: id,
      details: { name: style.name, slug: style.slug, description: style.description },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return { message: 'Style deleted successfully' };
  }
}

export const styleService = new StyleService();
