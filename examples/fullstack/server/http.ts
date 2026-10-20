import type { ShotGridClient } from 'shotgrid-js-sdk'
import type { AssetDto } from '../shared'
import type { AssetRpcContext } from './router'

/** A plain Fetch endpoint: no RPC runtime is needed for this integration. */
export function createAssetsHttpHandler(dependencies: {
  getClient: () => ShotGridClient
  resolveContext: (request: Request) => AssetRpcContext | Promise<AssetRpcContext>
}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET')
      return new Response(null, { status: 405, headers: { Allow: 'GET' } })
    const context = await dependencies.resolveContext(request)
    if (!context.session) return Response.json({ error: 'Unauthenticated' }, { status: 401 })
    const projectId = Number(new URL(request.url).searchParams.get('projectId'))
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      return Response.json({ error: 'Invalid projectId' }, { status: 400 })
    }
    if (!(await context.canReadProject(context.session, projectId))) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    try {
      const assets = await dependencies
        .getClient()
        .query('Asset')
        .where('project', 'is', { type: 'Project', id: projectId })
        .select('code', 'sg_status_list')
        .orderBy('id')
        .limit(50)
        .signal(request.signal)
        .all()
      const result: AssetDto[] = assets.map(({ id, type, code, sg_status_list }) => ({
        id,
        type,
        code,
        sg_status_list,
      }))
      return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch {
      return Response.json({ error: 'Could not load assets.' }, { status: 502 })
    }
  }
}
