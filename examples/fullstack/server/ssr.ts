import { createRouterClient } from '@orpc/server'
import { type AssetRouterDependencies, type AssetRpcContext, createAssetRouter } from './router'

/** Construct per SSR request: context belongs to that request, SDK reuse belongs to its identity. */
export function createSsrAssetClient(
  dependencies: AssetRouterDependencies,
  context: AssetRpcContext,
) {
  return createRouterClient(createAssetRouter(dependencies), { context })
}
