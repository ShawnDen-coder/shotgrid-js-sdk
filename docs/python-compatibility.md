[English](python-compatibility.md) · [简体中文](python-compatibility.zh-CN.md)

# Python compatibility and migration

The high-level API follows the [official Python SDK](https://developers.shotgridsoftware.com/python-api/reference.html) where the [REST API](https://developers.shotgridsoftware.com/rest-api/) supports equivalent behavior. This is a compatibility layer, not a port of Python's JSON-RPC transport. Tests currently use documented REST-shaped fixtures, not a live Python-versus-REST server comparison.

## Call mapping

| Python                                                   | TypeScript                                              | Result                                     |
| -------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------ |
| `sg.connect()`                                           | `await sg.connect()`                                    | Connection/authentication check            |
| `sg.find(entity, filters, fields, ...)`                  | `await sg.find(entity, filters, fields, options)`       | Flat entity array                          |
| `sg.find_one(entity, filters, fields, ...)`              | `await sg.findOne(entity, filters, fields, options)`    | Flat entity or `null`                      |
| `sg.create(entity, data, return_fields)`                 | `await sg.create(entity, data, returnFields)`           | Flat created entity                        |
| `sg.update(entity, id, data, multi_entity_update_modes)` | `await sg.update(entity, id, data, modes)`              | Flat updated entity                        |
| `sg.delete(entity, id)`                                  | `await sg.delete(entity, id)`                           | Boolean, subject to REST limitations below |
| `sg.revive(entity, id)`                                  | `await sg.revive(entity, id)`                           | Boolean from REST `meta.did_revive`        |
| `sg.batch(requests)`                                     | `await sg.batch(requests)`                              | Ordered entity/boolean results             |
| `sg.summarize(...)`                                      | `await sg.summarize(entity, filters, fields, options)`  | `summaries` and `groups`                   |
| `sg.schema_entity_read(...)`                             | `await sg.schema.entityRead(projectId?)`                | Entity schema map                          |
| `sg.schema_field_read(...)`                              | `await sg.schema.fieldRead(entity, field?, projectId?)` | Field schema map                           |

The fluent `sg.query(entity)` API is an additional TypeScript-first interface. It delegates to the same business operations; Python parity remains a behavioral guide rather than a requirement to copy every signature. Methods use camelCase. Entity fields, filter groups and compatible options keep Python names, including `sg_status_list`, `filter_operator`, `include_archived_projects`, and `multi_entity_update_modes` in batch operations.

Python:

```py
asset = sg.find_one(
    "Asset",
    [["code", "is", "Hero"]],
    ["code", "project"],
    include_archived_projects=True,
)
```

TypeScript:

```ts
const asset = await sg.findOne('Asset', [['code', 'is', 'Hero']], ['code', 'project'], {
  include_archived_projects: true,
})
```

## Behavior contract

- `find` defaults to all matches, `['id']`, ascending `id`, active records, archived projects included, and AND filters. Always-present `id`/`type` remain in each record.
- `findOne` returns `null` when no record matches. It accepts filters, not a record ID; use `[['id', 'is', id]]`.
- Python nested `{ filter_operator, filters }` groups translate recursively to REST `{ logical_operator, conditions }`. Variadic operands such as `['created_at', 'in_last', 1, 'DAY']` are packed into REST's array argument.
- `find` assembles REST pages. A positive `page` uses `limit` as its logical page size; this implementation rejects a positive page without a positive limit. `iterate` adds async streaming.
- Records are flattened from REST `attributes` and `relationships`. IDs become positive safe integer numbers. Ordinary attribute JSON is not recursively rewritten.
- `create` and `update` request the written fields in their server response. Additional create return fields are included. Multi-entity `set`/`add`/`remove` modes become per-field REST update objects.
- Batches retain operation order and transaction boundaries. Validation occurs before sending the batch; the SDK never simulates a batch using separate writes.

## Deliberate differences and remaining gaps

| Area                 | Current behavior                                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Async                | All network calls return Promises; constructors do not make network requests.                                                                                                                                                                                  |
| Authentication       | REST token grants or a token provider; no equivalent of Python's `get_session_token` is claimed.                                                                                                                                                               |
| Datetimes            | API date/datetime strings are preserved; no Python timezone or `datetime` conversion.                                                                                                                                                                          |
| Delete               | REST returns 204. The wrapper first queries retired records to return `false` for an already-retired ID; missing records still raise the REST error. The check and delete are separate requests, so a concurrent retirement can race.                          |
| Batch delete         | Successful REST delete entries normalize to `true` unless the server explicitly returns a boolean. Python's exact already-retired `false` behavior cannot be guaranteed without a server-provided flag. No preflight writes or transaction splitting are used. |
| IDs                  | High-level IDs are numbers; original string/number ID representations remain available in `sg.rest`.                                                                                                                                                           |
| Type registry        | Common fields are included; studio-specific fields/entities require declaration merging. It is not a complete site schema.                                                                                                                                     |
| Dot paths            | Passed through, with projected values typed as `unknown`.                                                                                                                                                                                                      |
| Filter presets       | `additional_filter_presets` has no high-level compatibility adapter yet.                                                                                                                                                                                       |
| Files                | No high-level upload/download/thumbnail helpers or automatic uploads from `image`/`filmstrip_image` inputs.                                                                                                                                                    |
| Other Python methods | Text search, schema writes, complete schema reads, activity/following and work schedules have no high-level compatibility helpers yet. Use documented REST endpoints through `sg.rest` where available.                                                        |
| Errors               | Structured TypeScript errors, not Python's exception hierarchy.                                                                                                                                                                                                |

Do not infer missing-record behavior from any 404 alone, silently drop unsupported options, or claim complete Python compatibility. A live-site parity suite is the next validation step before publishing a compatibility release.

## Migrating earlier SDK code

This redesign changes high-level returns and removes ambiguous top-level raw HTTP helpers. It should ship as a breaking API release; this branch does not bump or publish the package version.

| Earlier call                                                | Replacement retaining REST behavior                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `client.get/post/put/delete(path, ...)`                     | `client.rest.get/post/put/delete(path, ...)`                               |
| `client.search/list/read(...)`                              | `client.rest.search/list/read(...)`                                        |
| `client.create/update(...)` returning `.data`               | `client.rest.create/update(...)`, or use high-level flat results           |
| `client.remove(...)`                                        | `client.rest.remove(...)`, or high-level `client.delete(entity, id)`       |
| `client.batch(...)` with `entity`/`record_id`               | `client.rest.batch(...)`                                                   |
| `client.schema(...)`                                        | `client.rest.schema(...)`                                                  |
| `client.authenticate()`                                     | Still supported; prefer `client.connect()` or `client.auth.authenticate()` |
| REST `BatchRequest`, `FilterCondition`, `FilterGroup` types | `RestBatchRequest`, `RestFilterCondition`, `RestFilterGroup`               |

For high-level methods, pass the API entity type (`Asset`), not the plural REST path (`assets`). For raw helpers, pass the endpoint name your site accepts. The legacy `credentials` option still works; `tslog` is no longer required. Previous browser demo configuration has been replaced by server-side environment examples.
