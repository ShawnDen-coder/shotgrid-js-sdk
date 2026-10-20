import { AxiosError } from 'axios'
import { ShotGridClientError } from '../types/client-error'
import type { ShotGridErrorResponse } from '../types/shotgrid-error'

export function toClientError(error: unknown): ShotGridClientError {
  if (error instanceof AxiosError) {
    const status = error.response?.status
    const errorPayload = error.response?.data as ShotGridErrorResponse | undefined
    const firstError = errorPayload?.errors?.[0]

    const detail = firstError?.detail
    const title = firstError?.title
    const code = firstError?.code

    const message = detail ?? title ?? error.message ?? 'ShotGrid request failed.'

    return new ShotGridClientError(message, {
      kind: 'http_error',
      status,
      code,
      title,
      detail,
      cause: error,
    })
  }

  return new ShotGridClientError(error instanceof Error ? error.message : 'Unknown error', {
    kind: 'unexpected',
    cause: error,
  })
}
