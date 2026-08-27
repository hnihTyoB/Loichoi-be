export interface ColorDto {
  id: string;
  name: string;
  slug: string;
  hex: string;
  themeCount?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PublicColorDto {
  id: string;
  name: string;
  slug: string;
  hex: string;
  themeCount?: number;
}

export interface CreateColorDto {
  name: string;
  slug?: string;
  hex: string;
}

export interface UpdateColorDto {
  name?: string;
  slug?: string;
  hex?: string;
}

export interface ColorQueryDto {
  page?: number;
  limit?: number;
  search?: string;
}
