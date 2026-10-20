import { ShotGridClientError } from '../types/client-error'

export function validateApiPath(path: string): void {
  // Never send site credentials to caller-supplied absolute URLs or traversal paths.
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /[\\?#]/.test(path) ||
    path.split('/').some((part) => {
      try {
        const decoded = decodeURIComponent(part)
        return decoded === '..' || decoded === '.' || /[\\/]/.test(decoded)
      } catch {
        return true
      }
    })
  ) {
    throw new ShotGridClientError(
      'Expected an API-relative path without traversal or query strings.',
      {
        kind: 'unexpected',
      },
    )
  }
}

export function entityPath(entity: string, id?: number | string): string {
  const path = `/entity/${encodeURIComponent(entity)}`
  return id === undefined ? path : `${path}/${encodeURIComponent(id)}`
}
