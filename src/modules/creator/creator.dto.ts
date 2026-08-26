import { CreatorSort } from '../../common/constants/keyboard.constant';

export interface CreatorProfileStatsDto {
  themesCount: number;
  downloadsCount: number;
  followersCount: number;
  likesCount: number;
  collectionsCount: number;
}

export interface CreatorPublicProfileDto {
  id: string;
  fullName: string | null;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isCreator: boolean;
  isFeaturedCreator: boolean;
  socialLinks: Record<string, string> | null;
  stats: CreatorProfileStatsDto;
  isFollowing?: boolean;
  joinedAt: Date | string;
}

export interface CreatorListItemDto {
  id: string;
  fullName: string | null;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isCreator: boolean;
  isFeaturedCreator: boolean;
  stats: CreatorProfileStatsDto;
}

export interface CreatorQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  isFeatured?: boolean;
  sort?: CreatorSort;
}

export interface FollowResultDto {
  creatorId: string;
  username: string;
  isFollowing: boolean;
  followerCount: number;
  message: string;
}
