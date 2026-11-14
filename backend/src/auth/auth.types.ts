import type { Request } from 'express';

export type RoleCode = 'REQUESTER' | 'TECHNICIAN' | 'SUPERVISOR' | 'ADMIN';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roles: RoleCode[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
