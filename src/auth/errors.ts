import { AxiosError } from 'axios'
import type { ShotGridErrorResponse } from '../types/shotgrid-error'

export class AuthServiceError extends Error {
  readonly status?: number
  readonly code?: number
  readonly title?: string
  readonly detail?: string
  readonly cause?: unknown

  constructor(
    message: string,
    options?: {
      status?: number
      code?: number
      title?: string
      detail?: string
      cause?: unknown
    },
  ) {
    super(message)
    this.name = 'AuthServiceError'
    this.status = options?.status
    this.code = options?.code
    this.title = options?.title
    this.detail = options?.detail
    Object.defineProperty(this, 'cause', {
      value: options?.cause,
      configurable: true,
      enumerable: false,
    })
  }
}

export function toAuthServiceError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) {
    return error
  }

  if (error instanceof AxiosError) {
    const status = error.response?.status
    const errorPayload = error.response?.data as ShotGridErrorResponse | undefined
    const firstError = errorPayload?.errors?.[0]

    const detail = firstError?.detail
    const title = firstError?.title
    const code = firstError?.code

    const message = detail || title || error.message || 'ShotGrid authentication failed.'

    return new AuthServiceError(message, {
      status,
      code,
      title,
      detail,
      cause: error,
    })
  }

  return new AuthServiceError('Unexpected authentication error.', {
    cause: error,
  })
}
