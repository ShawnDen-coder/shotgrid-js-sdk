import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
// Erased by TypeScript: importing the router TYPE doesn't ship its server implementation.
import type { AssetRpcClient } from '../server/router'

export function createAssetClient(url: string | URL): AssetRpcClient {
  return createORPCClient(new RPCLink({ url }))
}

/** One query utility per browser app/session; use a new scope/cache when identity changes. */
export function createAssetQueries(
  client: AssetRpcClient,
  scope: { siteId: string; tenantId: string; userId: string },
) {
  return createTanstackQueryUtils(client, {
    path: ['shotgrid', scope.siteId, scope.tenantId, scope.userId],
  })
}

export type AssetQueries = ReturnType<typeof createAssetQueries>
export type AssetListInput = Parameters<AssetRpcClient['assets']['list']>[0]
