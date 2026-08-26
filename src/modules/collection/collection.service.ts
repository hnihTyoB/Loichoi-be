import { CollectionRepository } from './collection.repository';
import { KeyboardRepository } from '../keyboard/keyboard.repository';
import { systemConfigService, SystemConfigService } from '../system-config/system-config.service';
import {
  CollectionQueryDto,
  CreateCollectionDto,
  UpdateCollectionDto,
} from './collection.dto';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { toSlug } from '../../common/helpers/slug.helper';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';
import { FEATURE_FLAGS } from '../../common/constants/system-config.constant';

export class CollectionService {
  private readonly repository = new CollectionRepository();
  private readonly keyboardRepository = new KeyboardRepository();
  private readonly systemConfigService: SystemConfigService = systemConfigService;

  async findPublicList(query: CollectionQueryDto) {
    return this.repository.findPublicList(query);
  }

  async findPublicBySlug(slug: string) {
    const col = await this.repository.findPublicBySlug(slug);
    if (!col) {
      throw new AppError('Bộ sưu tập không tồn tại hoặc ở chế độ riêng tư', 404, ERROR_CODE.COLLECTION_NOT_FOUND);
    }
    return col;
  }

  async create(
    data: CreateCollectionDto,
    userId: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const isCollectionsEnabled = await this.systemConfigService.isFeatureEnabled(
      FEATURE_FLAGS.COLLECTIONS_ENABLED,
      true,
    );

    if (!isCollectionsEnabled) {
      throw new AppError('Tính năng Bộ sưu tập tạm thời bị vô hiệu hóa', 403, ERROR_CODE.FEATURE_DISABLED);
    }

    const slug = data.slug ? toSlug(data.slug) : toSlug(data.name);

    if (!slug) {
      throw new AppError('Không thể tạo định danh (slug) hợp lệ từ tên bộ sưu tập', 400, ERROR_CODE.VALIDATION_ERROR);
    }

    const existingSlug = await this.repository.findBySlug(slug);
    if (existingSlug) {
      throw new AppError('Đường dẫn định danh (slug) của bộ sưu tập đã tồn tại', 409, ERROR_CODE.COLLECTION_SLUG_EXISTS);
    }

    // Xác thực các theme nếu có truyền themeIds
    if (data.themeIds && data.themeIds.length > 0) {
      for (const themeId of data.themeIds) {
        const theme = await this.keyboardRepository.findById(themeId);
        if (!theme || theme.status !== 'PUBLISHED') {
          throw new AppError(`Theme có ID ${themeId} không tồn tại hoặc chưa được phát hành`, 400, ERROR_CODE.THEME_NOT_FOUND);
        }
      }
    }

    const col = await this.repository.create({
      ...data,
      slug,
      userId,
    });

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.CREATE_COLLECTION,
      targetType: AUDIT_TARGET_TYPE.COLLECTION,
      targetId: col.id,
      details: { name: col.name, slug: col.slug, isPublic: col.isPublic },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return this.findPublicBySlug(col.slug);
  }

  async update(
    id: string,
    data: UpdateCollectionDto,
    userId: string,
    userRole?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Bộ sưu tập không tồn tại', 404, ERROR_CODE.COLLECTION_NOT_FOUND);
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new AppError('Bạn không có quyền chỉnh sửa bộ sưu tập này', 403, ERROR_CODE.NOT_COLLECTION_OWNER);
    }

    let slug = existing.slug;
    if (data.slug) {
      slug = toSlug(data.slug);
      if (slug !== existing.slug) {
        const existingSlug = await this.repository.findBySlug(slug);
        if (existingSlug && existingSlug.id !== id) {
          throw new AppError('Đường dẫn định danh (slug) của bộ sưu tập đã tồn tại', 409, ERROR_CODE.COLLECTION_SLUG_EXISTS);
        }
      }
    }

    const updated = await this.repository.update(id, {
      ...data,
      slug,
    });

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.UPDATE_COLLECTION,
      targetType: AUDIT_TARGET_TYPE.COLLECTION,
      targetId: id,
      details: {
        before: { name: existing.name, slug: existing.slug, isPublic: existing.isPublic },
        after: { name: updated.name, slug: updated.slug, isPublic: updated.isPublic },
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return this.findPublicBySlug(updated.slug);
  }

  async delete(
    id: string,
    userId: string,
    userRole?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Bộ sưu tập không tồn tại', 404, ERROR_CODE.COLLECTION_NOT_FOUND);
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new AppError('Bạn không có quyền xóa bộ sưu tập này', 403, ERROR_CODE.NOT_COLLECTION_OWNER);
    }

    await this.repository.delete(id);

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.DELETE_COLLECTION,
      targetType: AUDIT_TARGET_TYPE.COLLECTION,
      targetId: id,
      details: { name: existing.name, slug: existing.slug },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      message: 'Đã xóa bộ sưu tập thành công',
    };
  }

  async addTheme(
    collectionId: string,
    themeId: string,
    position?: number,
    userId?: string,
    userRole?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.repository.findById(collectionId);
    if (!existing) {
      throw new AppError('Bộ sưu tập không tồn tại', 404, ERROR_CODE.COLLECTION_NOT_FOUND);
    }

    if (userId && existing.userId !== userId && userRole !== 'ADMIN') {
      throw new AppError('Bạn không có quyền chỉnh sửa bộ sưu tập này', 403, ERROR_CODE.NOT_COLLECTION_OWNER);
    }

    const theme = await this.keyboardRepository.findById(themeId);
    if (!theme || theme.status !== 'PUBLISHED') {
      throw new AppError('Giao diện bàn phím không tồn tại hoặc chưa được phát hành', 404, ERROR_CODE.THEME_NOT_FOUND);
    }

    const isInCollection = await this.repository.isThemeInCollection(collectionId, themeId);
    if (isInCollection) {
      throw new AppError('Theme này đã có trong bộ sưu tập', 409, ERROR_CODE.COLLECTION_ITEM_EXISTS);
    }

    const maxThemes = await this.systemConfigService.get<number>('collections.max_themes_per_collection', 100);
    const currentCount = await this.repository.countCollectionItems(collectionId);
    if (currentCount >= maxThemes) {
      throw new AppError(`Bộ sưu tập đã đạt giới hạn tối đa ${maxThemes} theme`, 400, ERROR_CODE.VALIDATION_ERROR);
    }

    const item = await this.repository.addTheme(collectionId, themeId, position);

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.ADD_COLLECTION_ITEM,
      targetType: AUDIT_TARGET_TYPE.COLLECTION,
      targetId: collectionId,
      details: { themeId, themeName: theme.name, position: item.position },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      message: 'Đã thêm theme vào bộ sưu tập thành công',
      item,
    };
  }

  async removeTheme(
    collectionId: string,
    themeId: string,
    userId?: string,
    userRole?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.repository.findById(collectionId);
    if (!existing) {
      throw new AppError('Bộ sưu tập không tồn tại', 404, ERROR_CODE.COLLECTION_NOT_FOUND);
    }

    if (userId && existing.userId !== userId && userRole !== 'ADMIN') {
      throw new AppError('Bạn không có quyền chỉnh sửa bộ sưu tập này', 403, ERROR_CODE.NOT_COLLECTION_OWNER);
    }

    const isInCollection = await this.repository.isThemeInCollection(collectionId, themeId);
    if (!isInCollection) {
      throw new AppError('Theme này không có trong bộ sưu tập', 404, ERROR_CODE.COLLECTION_ITEM_NOT_FOUND);
    }

    await this.repository.removeTheme(collectionId, themeId);

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.REMOVE_COLLECTION_ITEM,
      targetType: AUDIT_TARGET_TYPE.COLLECTION,
      targetId: collectionId,
      details: { themeId },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      message: 'Đã xóa theme khỏi bộ sưu tập thành công',
    };
  }
}

export const collectionService = new CollectionService();
