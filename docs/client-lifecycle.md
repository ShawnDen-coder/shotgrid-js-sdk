[English](client-lifecycle.md) · [简体中文](client-lifecycle.zh-CN.md)

# Client lifecycle and performance

Creating a client constructs Axios and service objects; it does not contact ShotGrid. The more significant cost of repeatedly constructing clients is losing their token cache and authentication coordination. Repeated data queries are a separate cost, handled by pagination and application query caching.

## One provider per shared identity

```ts
// server/shotgrid.ts
import { ShotGridClient, createClientProvider } from 'shotgrid-js-sdk'

export const getShotGrid = createClientProvider(() => new ShotGridClient({
  baseUrl: process.env.SHOTGRID_BASE_URL!,
  auth: {
    type: 'script',
    scriptName: process.env.SHOTGRID_SCRIPT_NAME!,
    scriptKey: process.env.SHOTGRID_SCRIPT_KEY!,
  },
}))
```

Import this same provider from routes, services and background tasks that use the same identity. The factory runs on the first call. Queries and bound entity wrappers are lightweight and do not need their own client. You may eagerly call `await getShotGrid().connect()` during application startup if startup should fail on authentication errors.

```ts
// Several routes use the same instance and token manager
const assets = await getShotGrid().query('Asset').select('code').limit(50).all()
const projects = await getShotGrid().find('Project', [], ['name'], { limit: 50 })
```

The helper deliberately has no process-global credential registry, hidden tenant cache or token persistence. Two separately created providers are two separate owners. Always put the provider in one central module or inject the same client/provider through the application's container.

## Choose the right scope

| Situation | Scope |
| --- | --- |
| Fixed site and script identity | Shared server module/application provider |
| Multiple studios/sites/scripts | An explicitly owned provider for each configured identity |
| User-specific session, sudo scope or permissions | Request/session-scoped client or a bounded application-managed user cache |
| SSR request | Share a fixed script SDK only if its identity is truly shared; keep user authorization context and QueryClient per request |
| Browser UI | One application RPC client and one query cache per logged-in scope; do not instantiate the script SDK per component |
| Background job process | Process-owned provider for its fixed identity |

A cache key must account for site, identity, impersonation/sudo scope and any permission/session configuration. Do not put access tokens or script secrets in cache keys. A process-global SDK whose token callback closes over “the current request user” is unsafe: the first acquired token could be reused by later users.

If your application owns a session cache, bound it, expire it, and evict on logout or permission changes. Do not share or refresh the same single-use refresh token in multiple independent clients/processes. Use one refresh-token owner or an external centralized token provider.

## SSR, HMR and serverless

A module provider is reused only within its module/runtime instance. Separate workers, serverless cold starts, duplicated bundles and development hot reload can each create a new instance. The SDK cannot safely turn those into one cross-process singleton. A distributed token/session owner must be provided by the application if that is required.

Keep the provider in a framework's server-only module (for example, add your framework's server-only import guard). Importing router or DTO **types** on the frontend is fine; importing a module containing environment-backed credentials at runtime is not.

SSR may call oRPC's server-side client directly, preserving its authorization middleware without sending a request back to the same application. Create that context per request. Never share a server-side QueryClient or a client-side query cache across different authenticated SSR requests.

## Result caching and request counts

`createClientProvider` reuses authentication, not query results. Every `all()`, `first()`, `find()` or write executes a new operation. Concurrent authentication/refresh is coordinated within one SDK instance, but independent data requests are not silently memoized.

Use TanStack Query or an equivalent application cache for UI data. The example query utilities use site/tenant/user-prefixed keys and include procedure input (project/page/limit). Identical in-flight queries share work; stale times determine later refetching. Clear or replace caches when identity changes. A query key is a cache partition, not server authorization.

Use limits and selected fields for interactive routes. Python-compatible `find()` defaults to all matching results; an unbounded `find` is usually the wrong HTTP endpoint default. Avoid retrying ambiguous writes in UI hooks; mutations need their own invalidation and idempotency design.
