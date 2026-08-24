export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  themeCount?: number;
}

export interface CategoryManagementDto {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  themeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  isActive?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  slug?: string;
  isActive?: boolean;
}

export interface CategoryQueryDto {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}
