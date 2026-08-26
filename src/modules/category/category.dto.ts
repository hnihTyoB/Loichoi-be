export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  orderIndex: number;
  themeCount?: number;
}

export interface CategoryManagementDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  orderIndex: number;
  isActive: boolean;
  themeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  orderIndex?: number;
  isActive?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  orderIndex?: number;
  isActive?: boolean;
}

export interface CategoryQueryDto {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}
