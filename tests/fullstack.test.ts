import assert from 'node:assert/strict'
import test from 'node:test'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { QueryClient } from '@tanstack/react-query'
import { createAssetQueries } from '../examples/fullstack/browser/client'
import { createAssetRpcHandler } from '../examples/fullstack/server/handler'
import type { AssetRpcClient, AssetRpcContext } from '../examples/fullstack/server/router'
import { createSsrAssetClient } from '../examples/fullstack/server/ssr'
import { createClientProvider } from '../src'
import { fixture, record } from './helpers'

const session = { userId: 'artist', tenantId: 'studio' }
function app(context: AssetRpcContext) {
  const { sg, calls } = fixture(() => ({
    data: [record(1, { code: 'Hero', sg_status_list: 'ip', private_field: 'hidden' })],
  }))
  let created = 0
  const getClient = createClientProvider(() => {
    created++
    return sg
  })
  const handle = createAssetRpcHandler({ getClient, resolveContext: () => context })
  const client: AssetRpcClient = createORPCClient(
    new RPCLink({
      url: 'https://app.example/rpc',
      fetch: (request, init) => handle(new Request(request, init)),
    }),
  )
  return { client, calls, getClient, created: () => created }
}

test('oRPC carries selected results across HTTP and reuses the SDK provider', async () => {
  const { client, calls, created } = app({ session, canReadProject: async () => true })
  const result = await client.assets.list({ projectId: 123 })
  await client.assets.list({ projectId: 123, page: 2 })
  assert.deepEqual(result, [{ id: 1, type: 'Asset', code: 'Hero', sg_status_list: 'ip' }])
  assert.equal(created(), 1)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].params['page[size]'], 50)
  assert.equal(calls[1].params['page[number]'], 2)
})

test('RPC rejects unauthenticated, unauthorized and unbounded queries before using the SDK', async () => {
  const anonymous = app({ session: null, canReadProject: async () => true })
  await assert.rejects(anonymous.client.assets.list({ projectId: 123 }), { code: 'UNAUTHORIZED' })
  assert.equal(anonymous.created(), 0)
  const denied = app({ session, canReadProject: async () => false })
  await assert.rejects(denied.client.assets.list({ projectId: 123 }), { code: 'FORBIDDEN' })
  assert.equal(denied.created(), 0)
  const allowed = app({ session, canReadProject: async () => true })
  await assert.rejects(allowed.client.assets.list({ projectId: 123, limit: 101 }), {
    code: 'BAD_REQUEST',
  })
  assert.equal(allowed.created(), 0)
})

test('query options share in-flight results and partition cache keys by identity', async () => {
  const { client, calls } = app({ session, canReadProject: async () => true })
  const options = createAssetQueries(client, {
    siteId: 'main',
    ...session,
  }).assets.list.queryOptions({ input: { projectId: 123 }, staleTime: 30_000 })
  const queryClient = new QueryClient()
  try {
    const [left, right] = await Promise.all([
      queryClient.fetchQuery(options),
      queryClient.fetchQuery(options),
    ])
    assert.deepEqual(left, right)
    assert.equal(calls.length, 1)
    const other = createAssetQueries(client, {
      siteId: 'main',
      ...session,
      userId: 'other',
    }).assets.list.queryOptions({ input: { projectId: 123 }, staleTime: 30_000 })
    assert.notDeepEqual(options.queryKey, other.queryKey)
    await queryClient.fetchQuery(other)
    assert.equal(calls.length, 2)
  } finally {
    queryClient.clear()
  }
})

test('SSR calls the router directly and retains per-request authorization', async () => {
  const { getClient, calls } = app({ session, canReadProject: async () => true })
  const allowed = createSsrAssetClient({ getClient }, { session, canReadProject: async () => true })
  assert.equal((await allowed.assets.list({ projectId: 123 }))[0].code, 'Hero')
  const denied = createSsrAssetClient(
    { getClient },
    { session: null, canReadProject: async () => true },
  )
  await assert.rejects(denied.assets.list({ projectId: 123 }), { code: 'UNAUTHORIZED' })
  assert.equal(calls.length, 1)
})

test('plain HTTP is an alternative to RPC and keeps upstream/private fields out of responses', async () => {
  const { createAssetsHttpHandler } = await import('../examples/fullstack/server/http')
  const { sg } = fixture(() => ({
    data: [record(1, { code: 'Hero', sg_status_list: 'ip', secret: 'hidden' })],
  }))
  const handler = createAssetsHttpHandler({
    getClient: () => sg,
    resolveContext: () => ({ session, canReadProject: async () => true }),
  })
  const result = await handler(new Request('https://app.example/api/assets?projectId=123'))
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), [
    { id: 1, type: 'Asset', code: 'Hero', sg_status_list: 'ip' },
  ])
  assert.equal(
    (await handler(new Request('https://app.example/api/assets?projectId=invalid'))).status,
    400,
  )
})
