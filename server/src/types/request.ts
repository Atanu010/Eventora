import type { UserRole } from './auth'

export interface AuthenticatedUser {
  id: string
  role: UserRole
}
