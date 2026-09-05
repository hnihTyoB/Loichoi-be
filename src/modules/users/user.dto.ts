export interface UserQueryDto {
  email?: string;
  fullName?: string;
  roleName?: string;
  isActive?: boolean;
  sortBy?: 'createdAt' | 'email' | 'fullName';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreateUserDto {
  email: string;
  password: string;
  roleId: string;
}

export interface UpdateUserDto {
  isActive?: boolean;
}

export interface UserResponseDto {
  id: string;
  email: string;
  fullName?: string | null;
  username?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  phoneNumber?: string | null;
  roleId: string;
  role?: {
    id: string;
    name: string;
  };
  isActive: boolean;
  isCreator?: boolean;
  creatorStatus?: string;
  isFeaturedCreator?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
