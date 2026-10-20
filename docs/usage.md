[English](usage.md) · [简体中文](usage.zh-CN.md)

# Usage

## Connect and authenticate

```ts
import { ShotGridClient } from 'shotgrid-js-sdk'

const sg = new ShotGridClient({
  baseUrl: 'https://your-site.shotgrid.autodesk.com',
  auth: { type: 'script', scriptName: 'pipeline', scriptKey: 'server-side-secret' },
})

// Optional: requests also authenticate on demand.
await sg.connect()
```

Choose one authentication configuration:

| `auth.type` | Required fields           | Optional fields                                 |
| ----------- | ------------------------- | ----------------------------------------------- |
| `script`    | `scriptName`, `scriptKey` | `sudoAsLogin`, `sessionUuid`                    |
| `password`  | `username`, `password`    | `authToken` (2FA), `sudoAsLogin`, `sessionUuid` |
| `session`   | `sessionToken`            | —                                               |
| `refresh`   | `refreshToken`            | —                                               |
| `token`     | `getAccessToken` callback | Callback result may include `expiresAt`         |

The earlier `credentials: { grantType, ... }` configuration is still supported. Specify either `auth` or `credentials`, not both. `AuthService` remains exported for standalone token exchange.

A token provider avoids putting script credentials into clients that already have an authentication system:

```ts
const sg = new ShotGridClient({
  baseUrl: 'https://your-site.shotgrid.autodesk.com',
  auth: {
    type: 'token',
    getAccessToken: async () => ({
      accessToken: await obtainTokenFromYourBackend(),
      expiresAt: Date.now() + 60_000,
    }),
  },
})
```

`obtainTokenFromYourBackend` is supplied by your application. The callback is invoked on initial acquisition, before expiry when known, or after a rejected token. It must return a valid token. Only one acquisition runs at a time per client instance.

Built-in authentication stores the rotating access/refresh pair in memory. A refresh-token exchange is never automatically retried because refresh tokens are single-use. A rejected refresh (400/401) falls back to the original credentials, except in refresh-only mode; network/server failures propagate. A failed exchange discards the old pair so later requests cannot reuse a possibly consumed refresh token. A failed refresh-only client must be replaced with a client holding fresh credentials. A business request gets at most one recovery/replay after 401. Ambiguous network failures of writes are not automatically retried.

## Query and paginate

```ts
const filters = [
  ['project', 'is', { type: 'Project', id: 123 }],
  {
    filter_operator: 'any',
    filters: [
      ['sg_status_list', 'is', 'ip'],
      ['sg_status_list', 'is', 'wtg'],
    ],
  },
] as const

const assets = await sg.find('Asset', filters, ['code', 'project'], {
  order: [{ field_name: 'code', direction: 'asc' }],
  filter_operator: 'all',
  limit: 100,
  page: 2,
  retired_only: false,
  include_archived_projects: true,
})
```

Defaults follow the Python SDK: fields `['id']` plus the always-present `type`, sorting by `id` ascending, `filter_operator: 'all'`, active records, archived projects included, `limit: 0`, `page: 0`. `findOne` uses a one-record query and returns `null` when empty.

With `page: 0`, `limit: 0` collects all matching records; a positive limit caps the total. With a positive page, a positive limit is required and defines the logical page size. Internally, multiple REST requests may be needed to assemble that page. Pagination follows the server's next-page marker without following its host or losing the original filters.

For large queries, stream records and stop fetching by breaking the loop:

```ts
for await (const asset of sg.entity('Asset').iterate([], ['code'])) {
  console.log(asset.code)
}
```

`FindOptions.signal` accepts an `AbortSignal`. Query cancellation does not cancel a shared token exchange needed by other requests.

## Types and studio fields

```ts
import type { EntityLink } from 'shotgrid-js-sdk'

declare module 'shotgrid-js-sdk' {
  interface AssetFields {
    sg_pipeline_tag: string | null
  }

  interface EntitySchema {
    CustomEntity01: {
      code: string
      project: EntityLink<'Project'> | null
    }
  }
}

const asset = await sg.findOne('Asset', [], ['code', 'sg_pipeline_tag'])
// asset: { type: 'Asset'; id: number; code: string; sg_pipeline_tag: string | null } | null
```

The built-in registry covers common fields for Project, Asset, Shot, Task, Version, Sequence, and HumanUser. It describes field values when selected, not a guarantee that every studio has every field. The server remains authoritative. Register additional entities and fields with declaration merging; fields omitted from a query are omitted from its static result type.

Dot paths rooted in a registered field, e.g. `entity.Asset.code`, are accepted. Their projected value is `unknown` until a schema-aware path generator is added. Filter operands use `unknown` because relation operators support different argument shapes. Read-only metadata is excluded from typed write inputs.

## Mutations, batch and summary

```ts
await sg.update(
  'Asset',
  42,
  {
    shots: [{ type: 'Shot', id: 123 }],
  },
  { shots: 'add' },
)

const results = await sg.batch([
  { request_type: 'create', entity_type: 'Asset', data: { code: 'Prop' } },
  { request_type: 'update', entity_type: 'Asset', entity_id: 42, data: { sg_status_list: 'fin' } },
])

const totals = await sg.summarize('Asset', [], [{ field: 'id', type: 'count' }], {
  grouping: [{ field: 'sg_asset_type', type: 'exact', direction: 'asc' }],
})
```

`create(entity, data, returnFields?)` requests the written fields plus additional requested fields. `update(entity, id, data, modes?)` requests the fields being changed. Results are flat objects with numeric `id` and API `type`. Relationship values retain link objects or arrays. Mutation inputs and filter arrays are not modified.

Batches use Python's `entity_type`/`entity_id` keys and are sent as one atomic REST batch. Results preserve input order. An empty batch returns `[]` without HTTP. See the compatibility document for deletion limitations.

## Schema and raw REST

```ts
const entities = await sg.schema.entityRead()
const fields = await sg.schema.fieldRead('Asset')
const code = await sg.schema.fieldRead('Asset', 'code', 123)

const raw = await sg.rest.search(
  'assets',
  {
    filters: [['code', 'is', 'Hero']],
  },
  { params: { fields: 'code', 'page[size]': 50 } },
)
```

Schema reads remove the response envelope; a single-field read returns an object keyed by field name. Raw REST helpers preserve the API envelope and accept REST endpoint names. High-level methods convert API names (`Asset`, `HumanUser`, `CustomEntity01`) into REST paths (`assets`, `human_users`, `custom_entity_01s`). `sg.rest` performs no such entity-name conversion.

`sg.rest.request<T>(method, path, options)` accepts a `signal`, `params`, `data`, and `contentType`. Convenience methods include `get`, `post`, `put`, `delete`, `search`, `list`, `read`, `create`, `update`, `remove`, `batch`, and `schema`. Paths are relative to the configured API version and query parameters are supplied separately. Absolute URLs and traversal paths are rejected.

## Configuration and errors

Client configuration includes `apiVersion` (default `v1.1`), `timeoutMs` (15 seconds), `leewayMs` (30 seconds, capped to half the token lifetime), `maxRetries` (2 for eligible token exchanges), `retryBaseDelayMs` (300), `logger`, and an injectable Axios `httpClient`. An injected instance must have its API `baseURL`, timeout and any desired defaults configured.

```ts
import { ShotGridClientError } from 'shotgrid-js-sdk'

try {
  await sg.find('Asset', [])
} catch (error) {
  if (error instanceof ShotGridClientError) {
    console.error(error.kind, error.status, error.code, error.detail)
  }
  throw error
}
```

HTTP/authentication failures use `ShotGridClientError` with `kind: 'http_error' | 'auth_failed' | 'unexpected'`; standalone token exchanges use `AuthServiceError`. Invalid local arguments or malformed entity responses throw `TypeError`; cancellation before a request may throw an abort error. Error `cause` may contain Axios request configuration, so do not serialize it into public logs. Logging is opt-in with `logger: console` or your own implementation. Auth logs omit raw exception messages, and logger failures are isolated. Error causes are non-enumerable but still sensitive when explicitly inspected.

## Fluent queries

```ts
const base = sg.query('Asset')
  .where('project', 'is', { type: 'Project', id: 123 })

const assets = await base
  .whereAny(['sg_status_list', 'is', 'ip'], ['sg_status_list', 'is', 'wtg'])
  .select('code', 'project')
  .orderBy('code')
  .limit(50)
  .page(1)
  .all()

const first = await base.where('code', 'is', 'Hero').select('code').first()
```

`sg.query(type)` and `sg.entity(type).query()` are equivalent. Every builder method returns a new query. Selection replaces the previous selection; `where` / `filter` calls add AND conditions; `whereAny` adds a nested OR group. Repeated `orderBy` calls append sort fields. `retiredOnly`, `includeArchivedProjects`, and `signal` set their corresponding options.

`all`, `first` and `iterate` are the only executing methods. `first` respects a selected logical page if one is supplied; otherwise it requests only one record. Builders are not thenables, do not implicitly run on `await query`, and do not memoize their results. `.where` infers operand types from registered fields for identity, comparison, membership and temporal operators. Python-style `filter` groups retain flexible `unknown` operands; deep field values remain `unknown`.

Use [createClientProvider](client-lifecycle.md) to share the SDK instance across server modules, and the [full-stack recipes](fullstack.md) to connect browser code without exposing credentials.
