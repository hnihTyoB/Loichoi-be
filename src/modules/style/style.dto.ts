export interface StyleDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  themeCount?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PublicStyleDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  themeCount?: number;
}

export interface CreateStyleDto {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateStyleDto {
  name?: string;
  slug?: string;
  description?: string | null;
}

export interface StyleQueryDto {
  page?: number;
  limit?: number;
  search?: string;
}
