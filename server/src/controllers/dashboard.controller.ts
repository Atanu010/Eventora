import type { NextFunction, Request, Response } from 'express'
import { getDashboardSummary } from '../services/dashboard.service'

export async function summary(request: Request, response: Response, next: NextFunction): Promise<void> {
  try { response.json(await getDashboardSummary(request.authUser!)) } catch (error) { next(error) }
}