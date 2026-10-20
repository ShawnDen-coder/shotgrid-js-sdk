[English](architecture.md) · [简体中文](architecture.zh-CN.md)

# Module architecture

The public client composes services. Services own behavior, adapters own REST differences, and the HTTP layer owns authorization/recovery. Generic Axios configuration does not leak into the typed entity API.

| Module                                  | Responsibility                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `src/client-provider.ts` | Explicit, lazy ownership of one client per application identity |
| `src/entities/builder.ts` | Immutable fluent query state and typed terminal operations |
| `src/logging.ts` | Optional logger boundary; failures do not affect SDK behavior |
| `src/client.ts`                         | Construct services and expose the public API                                 |
| `src/auth/service.ts`                   | Token endpoint requests and eligible exchange retries                        |
| `src/auth/grants.ts`                    | Public auth configuration and OAuth form encoding                            |
| `src/auth/token-manager.ts`             | In-memory token pair, expiry, one in-flight acquisition, external provider   |
| `src/auth/tokens.ts`, `errors.ts`       | Token payload validation/conversion and auth error translation               |
| `src/http/transport.ts`                 | Authorized requests, one 401 recovery, signals, timeout inherited from Axios |
| `src/http/rest-client.ts`               | Raw REST verbs and resource helpers preserving response envelopes            |
| `src/http/paths.ts`, `errors.ts`        | Safe API paths and HTTP error translation                                    |
| `src/entities/service.ts`               | Python-compatible entity operations and pagination                           |
| `src/entities/filters.ts`, `query.ts`   | Filter translation and Python query defaults                                 |
| `src/entities/records.ts`               | Record flattening and numeric IDs                                            |
| `src/entities/mutations.ts`, `batch.ts` | Multi-entity writes and atomic batch mapping                                 |
| `src/entities/names.ts`                 | API type to REST path naming                                                 |
| `src/entities/repository.ts`            | Bound-entity convenience calls, delegating to EntityService                  |
| `src/entities/summary.ts`               | Summary request adaptation                                                   |
| `src/schema/service.ts`                 | Schema reads and response shape adaptation                                   |
| `src/types/`                            | Public configuration, entity registry, selected fields and wire types        |

`src/auth.ts` retains earlier standalone AuthService imports. Package consumers use `src/index.ts` through the public package export; implementation modules are not separate package entry points.

## Request flow

1. A typed method validates local arguments and translates Python-shaped filters/options.
2. RestClient encodes the endpoint operation; Transport requests a cached token from TokenManager.
3. TokenManager shares authentication or refresh across requests. A refresh-only source never falls back to its consumed original token.
4. Transport sends the operation. On 401 it requests recovery once; network/server write errors propagate without replay.
5. The entity/schema adapter removes the REST envelope and normalizes the result.

A query iterates server pages lazily; `find` collects that iterator. `findOne` caps it to one record. Server next links supply only a page number; their host/path never receives site authorization.

## Extension rules

- Add entity operations to their owning service, not the client constructor or transport.
- Keep REST spelling and wire envelopes in the REST layer. Business methods return Python-style entities.
- Extend EntitySchema/field interfaces for studio types; do not weaken all fields to `any` or a string index signature.
- Do not retry a single-use refresh grant, recreate atomic batches as separate writes, or automatically replay ambiguous writes.
- Add protocol fixture tests for behavior, compilation assertions for type contracts, and package-consumer checks for public declarations.

Library build configuration replaces the unused Vite browser demo. There is no browser entry page. Logging is an optional interface supplied by applications, with no process-environment lookup or logging dependency inside the library.

## Full-stack boundary

Application-specific HTTP/oRPC routers and React/Vue recipes live in `examples/fullstack`, outside the core entry point. Optional integration packages are dev dependencies used to verify examples. Browser runtime imports do not reach the server SDK; integration build tests enforce that graph boundary. The `/types` export maps only TypeScript declarations and has no runtime condition.

Fluent queries delegate terminal operations to EntityService. Their state is structurally immutable and not a result cache. ClientProvider owns one lazily-created SDK instance and never chooses a global/user cache key.
