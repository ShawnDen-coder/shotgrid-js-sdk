[English](README.md) · [简体中文](README.zh-CN.md)

# shotgrid-js-sdk

TypeScript SDK for Autodesk Flow Production Tracking (ShotGrid / Shotgun), with typed fluent queries, OAuth token management, and Python-style entity methods. Built for server tools and full-stack TypeScript applications.

## Server: initialize once, reuse across routes

```ts
// server/shotgrid.ts — import this provider from your server routes/services
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

```ts
// server/assets.ts
import { getShotGrid } from './shotgrid'

export async function listAssets(projectId: number) {
  return getShotGrid()
    .query('Asset')
    .where('project', 'is', { type: 'Project', id: projectId })
    .select('code', 'sg_status_list')
    .orderBy('code')
    .limit(50)
    .all()
}
```

The provider constructs one client lazily per provider instance. That client shares its in-flight authentication and rotating token pair. Export the provider once; do not create it inside every handler or component. Reuse it only for the same site, identity and permission scope. [Lifecycle and multi-user guidance](docs/client-lifecycle.md).

## Frontend: call your application API

Keep script credentials on the server. Your authenticated route checks project access and returns a bounded list; a [plain HTTP example](examples/fullstack/server/http.ts) is included.

```ts
// Browser code — import only the DTO type, not the credential-bearing server module
import type { SelectedEntity } from 'shotgrid-js-sdk/types'

type AssetDto = SelectedEntity<'Asset', readonly ['code', 'sg_status_list']>

export async function loadAssets(projectId: number, signal?: AbortSignal): Promise<AssetDto[]> {
  const response = await fetch(`/api/assets?projectId=${projectId}`, { signal })
  if (!response.ok) throw new Error('Could not load assets.')
  return response.json()
}
```

Want end-to-end inferred inputs/results? The [oRPC example](docs/fullstack.md) includes a validated router, Fetch handler, typed browser client, and React hooks / Vue composables built on TanStack Query. These are application recipes, not required SDK dependencies. SSR can call the same router directly without an HTTP loopback.

## Install

```sh
npm install shotgrid-js-sdk
# or
pnpm add shotgrid-js-sdk
```

This branch introduces a new API and has not been published as a compatibility release. Both ESM and CommonJS builds include TypeScript declarations. Node.js 22+ is the supported server baseline.

## Query your way

```ts
// Fluent: immutable, lazy builders with selected-field and operand inference
const base = getShotGrid().entity('Asset').query()
  .where('project', 'is', { type: 'Project', id: 123 })

const hero = await base.where('code', 'is', 'Hero').select('code', 'project').first()
const active = await base.where('sg_status_list', 'is', 'ip').select('code').all()

// Python-style calls remain available
const same = await getShotGrid().findOne('Asset', [['code', 'is', 'Hero']], ['code', 'project'])
```

`first()` / `findOne()` return an entity or `null`. `all()` / `find()` return flat entity arrays. No HTTP happens until a terminal call. Builders can be branched; they do not cache results. Use `iterate()` for large result sets and application query libraries for UI result caching.

Typed CRUD, batch operations, summaries and schema reads are also available. `sg.rest` preserves the original REST wire format. Extend the entity registry for your studio's fields.

- [Usage, authentication and fluent API](docs/usage.md)
- [Client lifecycle, performance and tenant isolation](docs/client-lifecycle.md)
- [HTTP, oRPC, React, Vue and SSR integration](docs/fullstack.md)
- [Python compatibility and migration](docs/python-compatibility.md)
- [Dependencies and runtime validation](docs/dependencies.md)
- [Typed workflow example](examples/python-compatible.ts)

## Scope and logging

Core runtime dependencies do not include oRPC, React, Vue, a query cache, or a logging library. Logging is opt-in, defaults to silence, and uses no Node-specific logger or environment lookup. Built-in auth logs omit raw errors and credentials; logger failures do not alter request behavior.

Error causes are retained for debugging but are non-enumerable to avoid accidentally serializing Axios configuration. That does not make whole errors safe to send to browsers: expose application-level messages and selected fields, as the examples do.

Full Python parity, uploads/downloads, text-search compatibility, filter presets, schema writes, and Schema-to-TypeScript generation remain outside the current high-level API. Dates remain API strings. Tests use protocol fixtures rather than a real ShotGrid site.

## Development

[CONTRIBUTING.md](CONTRIBUTING.md) covers Biome, pre-commit checks, type assertions, browser builds and package checks. [Module architecture](docs/architecture.md) describes the internal boundaries.

References: [Python SDK](https://developers.shotgridsoftware.com/python-api/reference.html), [REST API](https://developers.shotgridsoftware.com/rest-api/).
