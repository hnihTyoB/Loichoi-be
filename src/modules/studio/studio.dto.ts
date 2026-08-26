import { KeyboardPlatform, KeyboardStatus, ThemeAccessLevel } from '../../common/constants/keyboard.constant';
import { CreateKeyboardPreviewImagePayload } from '../keyboard/keyboard.dto';

export interface StudioDailyDownloadStatDto {
  date: string;
  downloads: number;
}

export interface StudioTopThemeDto {
  id: string;
  name: string;
  slug: string;
  coverUrl: string;
  downloadCount: number;
  likeCount: number;
  status: KeyboardStatus;
}

export interface StudioStatsDto {
  totalThemes: number;
  publishedThemesCount: number;
  draftThemesCount: number;
  totalDownloads: number;
  totalLikes: number;
  totalFollowers: number;
  recentDownloadsTrend: StudioDailyDownloadStatDto[];
  topThemes: StudioTopThemeDto[];
}

export interface StudioThemeListItemDto {
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
  categoryNames: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface StudioCreateThemeDto {
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

export interface StudioUpdateThemeDto {
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

export interface StudioUpdateProfileDto {
  username?: string;
  fullName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  socialLinks?: Record<string, string> | null;
}

export interface StudioApplyDto {
  username: string;
  bio?: string;
  socialLinks?: Record<string, string>;
}

export interface StudioThemeQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: KeyboardStatus;
  categoryId?: string;
  sort?: string;
}
