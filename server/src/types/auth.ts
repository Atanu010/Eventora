export type UserRole = 'attendee' | 'organizer' | 'admin'

export interface UserRecord {
  id: string
  name: string
  email: string
  password_hash: string
  role: UserRole
}

export interface SafeUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface JwtClaims {
  sub: string
  role: UserRole
}
