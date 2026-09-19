export type UserRole = 'attendee' | 'organizer' | 'admin'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface AuthResponse {
  accessToken: string
  user: AuthUser
}
