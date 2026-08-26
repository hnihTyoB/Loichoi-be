import { CollectionSort } from '../../common/constants/keyboard.constant';
import { CreatorSummaryDto, KeyboardListItemDto } from '../keyboard/keyboard.dto';

export interface CollectionItemDto {
  id: string;
  position: number;
  theme: KeyboardListItemDto;
  addedAt: Date | string;
}

export interface CollectionPublicDetailDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  isFeatured: boolean;
  creator: CreatorSummaryDto;
  itemsCount: number;
  items: CollectionItemDto[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CollectionListItemDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  isFeatured: boolean;
  creator: CreatorSummaryDto;
  itemsCount: number;
  previewThemes: Array<{
    id: string;
    name: string;
    slug: string;
    coverUrl: string;
  }>;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateCollectionDto {
  name: string;
  slug?: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
  themeIds?: string[];
}

export interface UpdateCollectionDto {
  name?: string;
  slug?: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
  isFeatured?: boolean;
}

export interface AddCollectionItemDto {
  themeId: string;
  position?: number;
}

export interface CollectionQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  isFeatured?: boolean;
  creator?: string;
  sort?: CollectionSort;
}

export interface CollectionManagementQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  isPublic?: boolean;
  isFeatured?: boolean;
  creator?: string;
  userId?: string;
  sort?: CollectionSort;
}
