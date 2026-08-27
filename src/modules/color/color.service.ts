import { ColorRepository } from './color.repository';
import { CreateColorDto, UpdateColorDto, ColorQueryDto } from './color.dto';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { toSlug } from '../../common/helpers/slug.helper';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';

export class ColorService {
  private readonly repository = new ColorRepository();

  async findPublicColors() {
    return this.repository.findPublicColors();
  }

  async findAll(query: ColorQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const color = await this.repository.findById(id);
    if (!color) {
      throw new AppError('Màu sắc không tồn tại', 404, ERROR_CODE.COLOR_NOT_FOUND);
    }
    return color;
  }

  async create(
    data: CreateColorDto,
    actorId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const slug = data.slug ? toSlug(data.slug) : toSlug(data.name);

    if (!slug) {
      throw new AppError('Không thể tạo định danh (slug) hợp lệ từ tên màu', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    const existingSlug = await this.repository.findBySlug(slug);
    if (existingSlug) {
      throw new AppError('Đường dẫn định danh (slug) của màu đã tồn tại', 409, ERROR_CODE.COLOR_SLUG_EXISTS);
    }

    const hex = data.hex.toUpperCase();

    const color = await this.repository.create({
      name: data.name,
      slug,
      hex,
    });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.CREATE_COLOR,
      targetType: AUDIT_TARGET_TYPE.COLOR,
      targetId: color.id,
      details: {
        name: color.name,
        slug: color.slug,
        hex: color.hex,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return color;
  }

  async update(
    id: string,
    data: UpdateColorDto,
    actorId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const color = await this.findById(id);

    let slug = color.slug;
    if (data.slug) {
      slug = toSlug(data.slug);
      if (slug !== color.slug) {
        const existing = await this.repository.findBySlug(slug);
        if (existing && existing.id !== id) {
          throw new AppError('Đường dẫn định danh (slug) của màu đã tồn tại', 409, ERROR_CODE.COLOR_SLUG_EXISTS);
        }
      }
    }

    const hex = data.hex ? data.hex.toUpperCase() : undefined;

    const updated = await this.repository.update(id, {
      name: data.name,
      slug,
      hex,
    });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_COLOR,
      targetType: AUDIT_TARGET_TYPE.COLOR,
      targetId: id,
      details: {
        before: {
          name: color.name,
          slug: color.slug,
          hex: color.hex,
        },
        after: {
          name: updated.name,
          slug: updated.slug,
          hex: updated.hex,
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
    const color = await this.findById(id);

    await this.repository.delete(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_COLOR,
      targetType: AUDIT_TARGET_TYPE.COLOR,
      targetId: id,
      details: { name: color.name, slug: color.slug, hex: color.hex },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return { message: 'Color deleted successfully' };
  }
}

export const colorService = new ColorService();
