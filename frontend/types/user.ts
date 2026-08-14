/**
 * User role enumeration
 */
export enum Role {
  Lead = 'Lead',
  Contributor = 'Contributor',
  Viewer = 'Viewer'
}

/**
 * User interface
 */
export interface User {
  id: string
  name: string
  email: string
  role: Role
  color?: string  // Assigned for cursor rendering
}

/**
 * User session interface
 */
export interface UserSession {
  user: User
  token: string
  expiresAt: number
}

/**
 * Permission check result
 */
export interface PermissionResult {
  allowed: boolean
  reason?: string
}
