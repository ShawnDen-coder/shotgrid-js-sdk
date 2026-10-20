import { ORPCError, os, type RouterClient } from '@orpc/server'
import type { ShotGridClient } from 'shotgrid-js-sdk'
import { z } from 'zod'

export interface AppSession {
  userId: string
  tenantId: string
}
export interface AssetRpcContext {
  /** Populated by the application's trusted session middleware, never request input. */
  session: AppSession | null
  canReadProject: (session: AppSession, projectId: number) => Promise<boolean>
}
export interface AssetRouterDependencies {
  getClient: () => ShotGridClient
}

/** Expose a bounded business operation rather than a public arbitrary-query proxy. */
export function createAssetRouter({ getClient }: AssetRouterDependencies) {
  const authenticated = os.$context<AssetRpcContext>().use(async ({ context, next }) => {
    if (!context.session) throw new ORPCError('UNAUTHORIZED')
    return next({ context: { session: context.session } })
  })

  const list = authenticated
    .input(
      z
        .object({
          projectId: z.number().int().positive(),
          limit: z.number().int().min(1).max(100).default(50),
          page: z.number().int().min(1).max(1000).default(1),
        })
        .strict(),
    )
    .handler(async ({ input, context, signal }) => {
      if (!(await context.canReadProject(context.session, input.projectId)))
        throw new ORPCError('FORBIDDEN')
      try {
        const query = getClient()
          .query('Asset')
          .where('project', 'is', { type: 'Project', id: input.projectId })
          .select('code', 'sg_status_list')
          .orderBy('id')
          .limit(input.limit)
          .page(input.page)
        const assets = await (signal ? query.signal(signal) : query).all()
        // Keep an explicit DTO allowlist even if an upstream response includes extra fields.
        return assets.map((asset) => ({
          id: asset.id,
          type: asset.type,
          code: asset.code,
          sg_status_list: asset.sg_status_list,
        }))
      } catch {
        // Don't send upstream error messages, Axios config, tokens or causes to browsers.
        throw new ORPCError('BAD_GATEWAY', { message: 'Could not load assets.' })
      }
    })

  return { assets: { list } }
}

export type AssetRouter = ReturnType<typeof createAssetRouter>
export type AssetRpcClient = RouterClient<AssetRouter>
