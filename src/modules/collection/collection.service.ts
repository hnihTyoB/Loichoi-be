import { CollectionRepository } from './collection.repository';
import { KeyboardRepository } from '../keyboard/keyboard.repository';
import { systemConfigService, SystemConfigService } from '../system-config/system-config.service';
import {
  CollectionQueryDto,
  CollectionManagementQueryDto,
  CreateCollectionDto,
  UpdateCollectionDto,
} from './collection.dto';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { toSlug } from '../../common/helpers/slug.helper';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../../common/constants/audit-log.constant';
import { FEATURE_FLAGS } from '../../common/constants/system-config.constant';
import { PERMISSIONS } from '../../common/constants/permission.constant';
import { ROLES } from '../../common/constants/role.constant';

export class CollectionService {
  private readonly repository = new CollectionRepository();
  private readonly keyboardRepository = new KeyboardRepository();
  private readonly systemConfigService: SystemConfigService = systemConfigService;

  private async ensureCollectionsEnabled() {
    const isCollectionsEnabled = await this.systemConfigService.isFeatureEnabled(
      FEATURE_FLAGS.COLLECTIONS_ENABLED,
      true,
    );
    if (!isCollectionsEnabled) {
      throw new AppError('Tính năng Bộ sưu tập tạm thời bị vô hiệu hóa', 403, ERROR_CODE.FEATURE_DISABLED);
    }
  }

  async findManagementList(query: CollectionManagementQueryDto) {
    return this.repository.findManagementList(query);
  }

  async findPublicList(query: CollectionQueryDto) {
    return this.repository.findPublicList(query);
  }

  async findPublicBySlug(slug: string) {
    const collection = await this.repository.findPublicBySlug(slug);
    if (!collection) {
      throw new AppError('Bộ sưu tập không tồn tại hoặc ở chế độ riêng tư', 404, ERROR_CODE.COLLECTION_NOT_FOUND);
    }
    return collection;
  }

  async findById(id: string) {
    const collection = await this.repository.findById(id);
    if (!collection) {
      throw new AppError('Bộ sưu tập không tồn tại', 404, ERROR_CODE.COLLECTION_NOT_FOUND);
    }
    return collection;
  }

  async create(
    data: CreateCollectionDto,
    userId: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.ensureCollectionsEnabled();

    let slug = toSlug(data.slug || data.name);
    const existing = await this.repository.findBySlug(slug);
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const collection = await this.repository.create({
      name: data.name,
      slug,
      description: data.description,
      coverUrl: data.coverUrl,
      isPublic: data.isPublic ?? true,
      userId,
    });

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.CREATE_COLLECTION,
      targetType: AUDIT_TARGET_TYPE.COLLECTION,
      targetId: collection.id,
      details: { name: collection.name, slug: collection.slug, isPublic: collection.isPublic },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return this.findPublicBySlug(collection.slug);
  }

  async update(
    id: string,
    data: UpdateCollectionDto,
    userId: string,
    userRole?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
    userPermissions?: string[],
  ) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Bộ sưu tập không tồn tại', 404, ERROR_CODE.COLLECTION_NOT_FOUND);
    }

    const canManageAll =
      userRole === ROLES.ADMIN ||
      userRole === 'ADMIN' ||
      Boolean(userPermissions?.includes(PERMISSIONS.COLLECTION_UPDATE));

    if (existing.userId !== userId && !canManageAll) {
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

    const updatePayload = { ...data };
    // Privilege Escalation Protection: Chỉ Admin hoặc user có quyền COLLECTION_UPDATE mới được gán isFeatured
    if (!canManageAll) {
      delete updatePayload.isFeatured;
    }

    const updated = await this.repository.update(id, {
      ...updatePayload,
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
    userPermissions?: string[],
  ) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError('Bộ sưu tập không tồn tại', 404, ERROR_CODE.COLLECTION_NOT_FOUND);
    }

    const canDeleteAll =
      userRole === ROLES.ADMIN ||
      userRole === 'ADMIN' ||
      Boolean(userPermissions?.includes(PERMISSIONS.COLLECTION_DELETE));

    if (existing.userId !== userId && !canDeleteAll) {
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
    userPermissions?: string[],
  ) {
    const existing = await this.repository.findById(collectionId);
    if (!existing) {
      throw new AppError('Bộ sưu tập không tồn tại', 404, ERROR_CODE.COLLECTION_NOT_FOUND);
    }

    const canManageAll =
      userRole === ROLES.ADMIN ||
      userRole === 'ADMIN' ||
      Boolean(userPermissions?.includes(PERMISSIONS.COLLECTION_UPDATE));

    if (userId && existing.userId !== userId && !canManageAll) {
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
    userPermissions?: string[],
  ) {
    const existing = await this.repository.findById(collectionId);
    if (!existing) {
      throw new AppError('Bộ sưu tập không tồn tại', 404, ERROR_CODE.COLLECTION_NOT_FOUND);
    }

    const canManageAll =
      userRole === ROLES.ADMIN ||
      userRole === 'ADMIN' ||
      Boolean(userPermissions?.includes(PERMISSIONS.COLLECTION_UPDATE));

    if (userId && existing.userId !== userId && !canManageAll) {
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
