import { KeyboardPlatform, KeyboardStatus, KeyboardSort, ThemeAccessLevel } from '../../common/constants/keyboard.constant';

export interface KeyboardListItemDto {
  id: string;
  name: string;
  slug: string;
  coverUrl: string;
  platform: KeyboardPlatform;
  accessLevel: ThemeAccessLevel;
  requiredDiscordRoleIds: string[];
  downloadCount: number;
  publishedAt: Date | string | null;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
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
  publishedAt: Date | string | null;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
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
  publishedAt: Date | string | null;
  categoryNames: string[];
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
  publishedAt: Date | string | null;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  }>;
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
  previewImages?: CreateKeyboardPreviewImagePayload[];
}

export interface KeyboardQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  platform?: KeyboardPlatform;
  sort?: KeyboardSort;
}

export interface KeyboardManagementQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: KeyboardStatus;
  categoryId?: string;
  platform?: KeyboardPlatform;
  sort?: string;
}
