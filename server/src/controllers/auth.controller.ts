import type { NextFunction, Request, Response } from 'express'
import {
  authenticateUser,
  createAccessToken,
  findAuthenticatedUser,
  registerUser,
} from '../services/auth.service'
import { AppError } from '../utils/errors'
import { loginSchema, registerSchema } from '../validation/auth.schemas'

export async function register(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const input = registerSchema.parse(request.body)
    const user = await registerUser(input.name, input.email, input.password)
    response.status(201).json({ user })
  } catch (error) {
    next(error)
  }
}

export async function login(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(request.body)
    const user = await authenticateUser(input.email, input.password)
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }
    response.json({ accessToken: createAccessToken(user), user })
  } catch (error) {
    next(error)
  }
}

export async function me(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    if (!request.authUser) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required')
    }
    const user = await findAuthenticatedUser(request.authUser.id)
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required')
    }
    response.json(user)
  } catch (error) {
    next(error)
  }
}
