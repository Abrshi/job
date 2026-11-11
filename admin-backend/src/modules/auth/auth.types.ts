export type UserRole = 'CANDIDATE' | 'EMPLOYER' | 'ADMIN';

export interface AuthUserPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole;
  isEmailVerified: boolean;
  avatarUrl?: string | null;
  createdAt: Date;
}

export interface RegisterDTO {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: 'CANDIDATE' | 'EMPLOYER';
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

