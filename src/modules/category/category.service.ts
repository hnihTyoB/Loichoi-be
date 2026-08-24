import { CategoryRepository } from './category.repository';
import { CreateCategoryDto, UpdateCategoryDto, CategoryQueryDto } from './category.dto';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { toSlug } from '../../common/helpers/slug.helper';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';

export class CategoryService {
  private readonly repository = new CategoryRepository();

  async findPublicCategories() {
    return this.repository.findPublicCategories();
  }

  async findAll(query: CategoryQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const category = await this.repository.findById(id);
    if (!category) {
      throw new AppError('Danh mục không tồn tại', 404, ERROR_CODE.CATEGORY_NOT_FOUND);
    }
    return category;
  }

  async create(
    data: CreateCategoryDto,
    actorId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const slug = data.slug ? toSlug(data.slug) : toSlug(data.name);

    if (!slug) {
      throw new AppError('Không thể tạo định danh (slug) hợp lệ từ tên danh mục', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    const existingSlug = await this.repository.findBySlug(slug);
    if (existingSlug) {
      throw new AppError('Đường dẫn định danh (slug) của danh mục đã tồn tại', 409, ERROR_CODE.CATEGORY_SLUG_EXISTS);
    }

    const category = await this.repository.create({
      name: data.name,
      slug,
      isActive: data.isActive ?? true,
    });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.CREATE_CATEGORY,
      targetType: AUDIT_TARGET_TYPE.CATEGORY,
      targetId: category.id,
      details: { name: category.name, slug: category.slug, isActive: category.isActive },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return category;
  }

  async update(
    id: string,
    data: UpdateCategoryDto,
    actorId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const category = await this.findById(id);

    let slug = category.slug;
    if (data.slug) {
      slug = toSlug(data.slug);
      if (slug !== category.slug) {
        const existing = await this.repository.findBySlug(slug);
        if (existing && existing.id !== id) {
          throw new AppError('Đường dẫn định danh (slug) của danh mục đã tồn tại', 409, ERROR_CODE.CATEGORY_SLUG_EXISTS);
        }
      }
    }

    const updated = await this.repository.update(id, {
      name: data.name,
      slug,
      isActive: data.isActive,
    });

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_CATEGORY,
      targetType: AUDIT_TARGET_TYPE.CATEGORY,
      targetId: id,
      details: {
        before: { name: category.name, slug: category.slug, isActive: category.isActive },
        after: { name: updated.name, slug: updated.slug, isActive: updated.isActive },
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
    const category = await this.findById(id);

    const themeCount = await this.repository.countThemesByCategory(id);
    if (themeCount > 0) {
      throw new AppError(
        'Không thể xóa danh mục đang có theme sử dụng. Hãy chuyển sang trạng thái ẩn.',
        400,
        ERROR_CODE.CATEGORY_IN_USE,
      );
    }

    await this.repository.delete(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_CATEGORY,
      targetType: AUDIT_TARGET_TYPE.CATEGORY,
      targetId: id,
      details: { name: category.name, slug: category.slug },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return { message: 'Category deleted successfully' };
  }
}

export const categoryService = new CategoryService();
