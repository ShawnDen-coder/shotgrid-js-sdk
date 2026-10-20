import type { ShotGridClient } from './client'

/**
 * Reuse one lazily-created client per provider. Declare/export this once in your
 * application's server module, scoped to one site, identity and permission set.
 * No process-global registry or cross-user token sharing is introduced.
 */
export function createClientProvider<T extends ShotGridClient>(factory: () => T): () => T {
  let client: T | undefined
  return () => {
    client ??= factory()
    return client
  }
}
