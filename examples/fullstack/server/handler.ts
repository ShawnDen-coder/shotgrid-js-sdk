import { RPCHandler } from '@orpc/server/fetch'
import { type AssetRouterDependencies, type AssetRpcContext, createAssetRouter } from './router'

export function createAssetRpcHandler(
  dependencies: AssetRouterDependencies & {
    resolveContext: (request: Request) => AssetRpcContext | Promise<AssetRpcContext>
  },
) {
  const handler = new RPCHandler(createAssetRouter(dependencies))
  return async (request: Request): Promise<Response> => {
    const context = await dependencies.resolveContext(request)
    const result = await handler.handle(request, { prefix: '/rpc', context })
    return result.response ?? new Response('Not found', { status: 404 })
  }
}
