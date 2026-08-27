import { KeyboardPlatform, KeyboardStatus, KeyboardSort, ThemeAccessLevel } from '../../common/constants/keyboard.constant';

export interface CreatorSummaryDto {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

export interface KeyboardColorSummaryDto {
  id: string;
  name: string;
  slug: string;
  hex: string;
}

export interface KeyboardStyleSummaryDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface KeyboardListItemDto {
  id: string;
  name: string;
  slug: string;
  coverUrl: string;
  platform: KeyboardPlatform;
  accessLevel: ThemeAccessLevel;
  requiredDiscordRoleIds: string[];
  downloadCount: number;
  likeCount: number;
  isFeatured: boolean;
  isLiked?: boolean;
  publishedAt: Date | string | null;
  author: CreatorSummaryDto | null;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  colors: KeyboardColorSummaryDto[];
  styles: KeyboardStyleSummaryDto[];
}

export interface KeyboardPublicDetailDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string;
  platform: KeyboardPlatform;
  accessLevel: ThemeAccessLevel;
  requiredDiscordRoleIds: string[];
  downloadCount: number;
  likeCount: number;
  isFeatured: boolean;
  isLiked?: boolean;
  publishedAt: Date | string | null;
  author: CreatorSummaryDto | null;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  colors: KeyboardColorSummaryDto[];
  styles: KeyboardStyleSummaryDto[];
  previewImages: Array<{
    id: string;
    url: string;
    altText: string | null;
    position: number;
  }>;
}

export interface KeyboardManagementListItemDto {
  id: string;
  name: string;
  slug: string;
  coverUrl: string;
  driveUrl: string;
  platform: KeyboardPlatform;
  status: KeyboardStatus;
  accessLevel: ThemeAccessLevel;
  requiredDiscordRoleIds: string[];
  downloadCount: number;
  likeCount: number;
  isFeatured: boolean;
  publishedAt: Date | string | null;
  author: CreatorSummaryDto | null;
  categoryNames: string[];
  colorNames: string[];
  styleNames: string[];
  colors: KeyboardColorSummaryDto[];
  styles: KeyboardStyleSummaryDto[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface KeyboardManagementDetailDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string;
  driveUrl: string;
  platform: KeyboardPlatform;
  status: KeyboardStatus;
  accessLevel: ThemeAccessLevel;
  requiredDiscordRoleIds: string[];
  downloadCount: number;
  likeCount: number;
  isFeatured: boolean;
  publishedAt: Date | string | null;
  author: CreatorSummaryDto | null;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  }>;
  colors: KeyboardColorSummaryDto[];
  styles: KeyboardStyleSummaryDto[];
  previewImages: Array<{
    id: string;
    url: string;
    altText: string | null;
    position: number;
    createdAt: Date | string;
  }>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateKeyboardPreviewImagePayload {
  url: string;
  altText?: string;
  position: number;
}

export interface CreateKeyboardDto {
  name: string;
  slug?: string;
  description?: string;
  coverUrl: string;
  driveUrl: string;
  platform: KeyboardPlatform;
  status?: KeyboardStatus;
  accessLevel?: ThemeAccessLevel;
  requiredDiscordRoleIds?: string[];
  categoryIds: string[];
  colorIds?: string[];
  styleIds?: string[];
  isFeatured?: boolean;
  previewImages?: CreateKeyboardPreviewImagePayload[];
}

export interface UpdateKeyboardDto {
  name?: string;
  slug?: string;
  description?: string;
  coverUrl?: string;
  driveUrl?: string;
  platform?: KeyboardPlatform;
  status?: KeyboardStatus;
  accessLevel?: ThemeAccessLevel;
  requiredDiscordRoleIds?: string[];
  categoryIds?: string[];
  colorIds?: string[];
  styleIds?: string[];
  isFeatured?: boolean;
  previewImages?: CreateKeyboardPreviewImagePayload[];
}

export interface KeyboardQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  categories?: string;
  color?: string;
  colors?: string;
  style?: string;
  styles?: string;
  platform?: KeyboardPlatform;
  accessLevel?: ThemeAccessLevel;
  isFeatured?: boolean;
  creator?: string;
  sort?: KeyboardSort;
}

export interface KeyboardManagementQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: KeyboardStatus;
  categoryId?: string;
  colorId?: string;
  styleId?: string;
  platform?: KeyboardPlatform;
  isFeatured?: boolean;
  sort?: string;
}

export interface GetThemeImageUploadUrlDto {
  contentType: string;
  imageType?: 'COVER' | 'PREVIEW';
}

export interface GetThemeImageUploadUrlResponseDto {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

export interface GetThemeBatchImageUploadUrlsDto {
  files: Array<{
    contentType: string;
    imageType?: 'COVER' | 'PREVIEW';
  }>;
}

export interface GetThemeBatchImageUploadUrlsResponseDto {
  items: GetThemeImageUploadUrlResponseDto[];
}
