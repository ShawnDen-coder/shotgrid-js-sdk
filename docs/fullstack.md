[English](fullstack.md) · [简体中文](fullstack.zh-CN.md)

# Full-stack TypeScript integration

Recommended flow: browser → application HTTP/oRPC endpoint → shared server SDK → ShotGrid. The SDK handles ShotGrid transport/authentication; your application owns user sessions, authorization, result caching and its public API.

## Do we need RPC?

No. A conventional authenticated endpoint works with any frontend and is often the smallest addition to an existing application. [server/http.ts](../examples/fullstack/server/http.ts) and [browser/http.ts](../examples/fullstack/browser/http.ts) are a plain Fetch example. The endpoint validates a project ID, checks the caller's project access, limits results to 50, returns selected fields and hides upstream errors.

For a new full-stack TS application, oRPC is a useful optional layer: input validation and inferred inputs/results flow from the application router to its client. This repo contains checked integration recipes for **oRPC 1.15.7**, using its [v1 docs](https://v1.orpc.dev/docs/integrations/tanstack-query). RPC improves the application type boundary; it does not by itself reduce ShotGrid latency or combine upstream requests. Instance reuse and result caching address those separate costs. The main oRPC site may describe a newer beta API. Use the versions/API appropriate to your application; the SDK itself has no oRPC runtime dependency.

## oRPC source map

| File | Purpose |
| --- | --- |
| [server/client.ts](../examples/fullstack/server/client.ts) | Lazy shared SDK for one fixed script identity |
| [server/router.ts](../examples/fullstack/server/router.ts) | Authenticated, project-authorized, validated `assets.list` procedure |
| [server/handler.ts](../examples/fullstack/server/handler.ts) | Fetch-compatible `/rpc` handler with application context injection |
| [server/ssr.ts](../examples/fullstack/server/ssr.ts) | Request-scoped direct server-side router client |
| [browser/client.ts](../examples/fullstack/browser/client.ts) | Typed RPC client and site/tenant/user-scoped query utilities |
| [browser/react.ts](../examples/fullstack/browser/react.ts) | React `useAssets` hook factory |
| [browser/vue.ts](../examples/fullstack/browser/vue.ts) | Reactive Vue `useAssets` composable factory |

Copy these recipes into your application and adapt the business operations. They are not exports such as `shotgrid-js-sdk/orpc` or framework adapters bundled in the SDK.

Install optional packages in the application using the example:

```sh
pnpm add @orpc/server@1.15.7 @orpc/client@1.15.7 @orpc/tanstack-query@1.15.7 zod
# Choose the framework integration used by your app:
pnpm add @tanstack/react-query react
# or
pnpm add @tanstack/vue-query vue
```

## Serve a validated business API

```ts
import { getShotGrid } from './server/client'
import { createAssetRpcHandler } from './server/handler'
import type { AssetRpcContext } from './server/router'

// The application supplies real session verification and project authorization.
export function createApplicationApi(resolveContext: (request: Request) => Promise<AssetRpcContext>) {
  return createAssetRpcHandler({ getClient: getShotGrid, resolveContext })
}
```

Register the returned Fetch handler at `/rpc/*` in your server framework. Supply a verified session and the `canReadProject` authorization function from your existing auth layer. There is no allow-all production default. Use your framework's cookie/session, origin and CSRF protections for any write procedures you add.

The procedure's client input contains only project ID, page and a bounded limit. It does not accept arbitrary SDK paths, entity types, fields, credentials or sudo scope. The router selects a DTO allowlist and maps upstream failures to a generic `BAD_GATEWAY`. Add application-appropriate rate limits and timeouts before exposing a route publicly.

## Create a browser client

```ts
import { createAssetClient, createAssetQueries } from './browser/client'

const api = createAssetClient(new URL('/rpc', window.location.origin))
const queries = createAssetQueries(api, {
  siteId: 'primary',
  tenantId: 'your-current-tenant',
  userId: 'your-current-user',
})

const assets = await api.assets.list({ projectId: 123, limit: 20 })
// assets[number].code is inferred from the server's selected result.
```

The router import in the browser client is `import type`. It is erased; the server SDK, router implementation and its credentials are not part of the browser bundle. Browser build tests verify that boundary. Non-RPC applications can import only DTO types via `shotgrid-js-sdk/types`; that subpath intentionally provides no runtime export.

Create the client/query utilities once in your browser application's session setup. Recreate/clear the query cache and utilities on logout, tenant/site change or permission changes. Site/tenant/user cache labels never replace server authorization, and must not contain tokens.

## React hooks and Vue composables

Do not create a second SDK-owned caching/reactivity system. The recipes wrap TanStack Query's existing hooks, preserving its inference, deduplication, cancellation and cache lifecycle. oRPC's framework-independent query utilities work with either React Query or Vue Query. See its [TanStack Query integration](https://v1.orpc.dev/docs/integrations/tanstack-query).

React setup:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAssetHooks } from './browser/react'

// Browser bootstrap/session scope, not inside each component render.
const queryClient = new QueryClient()
const { useAssets } = createAssetHooks(queries)

function Assets() {
  const query = useAssets({ projectId: 123 })
  if (query.isPending) return <p>Loading…</p>
  if (query.error) return <p>Could not load assets.</p>
  return <ul>{query.data.map(asset => <li key={asset.id}>{asset.code}</li>)}</ul>
}

function App() {
  return <QueryClientProvider client={queryClient}><Assets /></QueryClientProvider>
}
```

Vue setup:

```ts
import { computed, ref } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createAssetComposables } from './browser/vue'

// On the browser application: app.use(VueQueryPlugin, { queryClient: new QueryClient() })
const { useAssets } = createAssetComposables(queries)

// Inside component setup():
const projectId = ref(123)
const query = useAssets(computed(() => ({ projectId: projectId.value })))
```

In Vue, register VueQueryPlugin before calling the composable. In React, mount hooks under QueryClientProvider. These examples disable automatic retries and use a 30-second stale time. Mutations should add explicit invalidation and application error handling; do not automatically retry upstream writes.

There are no first-class `shotgrid-js-sdk/react` or `/vue` peer dependencies yet. Shipping separate framework APIs is only worthwhile once there is shared SDK-specific behavior beyond these small application wrappers. Current recipes are typechecked with React 19 / Vue 3 and TanStack Query 5; the HTTP/RPC/query-cache flow is integration tested without mounting a UI.

## SSR without a loopback request

```ts
import { createSsrAssetClient } from './server/ssr'

export async function renderAssets(context: AssetRpcContext) {
  const api = createSsrAssetClient({ getClient: getShotGrid }, context)
  return api.assets.list({ projectId: 123 })
}
```

Create the context for each request, after session verification. The SDK may be shared only when its ShotGrid identity is fixed; authorization still runs per caller. Any QueryClient used for prefetching/dehydration must also be request-scoped. The direct client runs the same input validation and permission checks as the HTTP router.

## Logging boundary

The core has no logging dependency or Node environment lookup. Logging defaults to silence in both browser and server builds; a supplied logger sees only fixed auth messages and metadata such as grant type, HTTP status and attempt count. Raw exception text and token responses are not logged. Throwing loggers cannot mask the underlying request outcome.

SDK error causes remain accessible for server debugging but are non-enumerable. This is a guard against accidental JSON serialization, not a guarantee that `console.error(error)`, custom inspect functions, `message` or upstream `detail` are public-safe. Return your own messages/codes from the application API. The oRPC and HTTP examples discard upstream errors before responding.
