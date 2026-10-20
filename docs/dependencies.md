[English](dependencies.md) · [简体中文](dependencies.zh-CN.md)

# Dependencies and runtime validation

## Why Axios is installed automatically

Axios is an implementation dependency of the SDK's HTTP transport. It is now declared in `dependencies`, so normal consumers install only the SDK:

```sh
npm install shotgrid-js-sdk
# or
pnpm add shotgrid-js-sdk
```

The earlier manifest used `peerDependencies` and the README explicitly installed both packages. Peer dependencies describe compatibility with a host package; npm 7+ often installs them automatically, while other versions/configurations can require consumer action. This SDK creates its own Axios instance by default, so an ordinary dependency better expresses ownership. See [npm's dependency documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#peerdependencies).

Axios remains external to the built library: the package manager installs and resolves it as a dependency rather than copying it into the library bundle. “External” does not mean consumers must manually install it. Applications that explicitly import Axios to create a custom `httpClient` should declare their own Axios dependency. Application interceptors do not automatically attach to the SDK's default instance; inject the configured instance explicitly.

## Where Zod fits

[Zod](https://zod.dev/) is already an exact-pinned development dependency used by the optional oRPC router example. Applications adopting that example install Zod themselves, as shown in the [full-stack guide](fullstack.md). Installing the core SDK does not install Zod, oRPC, React or Vue.

| Boundary | Current validation | Responsibility |
| --- | --- | --- |
| Application HTTP/oRPC input | Zod in the oRPC recipe; explicit parsing in the plain HTTP recipe | Reject invalid project/page/limit before calling the SDK |
| Authentication and REST protocol | Focused checks in the SDK | Validate token payloads, IDs, local arguments and required response structure |
| Studio-specific entity fields | TypeScript declaration merging, not complete runtime validation | The application defines any additional runtime schema it needs |
| Public application response | Selected DTO fields and application error mapping | Expose only permitted data; optional output schemas may add runtime checks |

TypeScript types are erased at runtime. A generic response type or declaration merge does not prove that a server response matches that type. Current protocol checks are not complete validation of every entity field. A Zod input schema also does not perform authorization; the example separately checks the session and project permissions.

## Should the core require Zod?

Not at this stage. The core has focused boundary checks, and ShotGrid fields vary by studio and selected query fields. A fixed strict entity schema could reject valid custom fields or drift from the site's actual schema. Adding Zod without schema coverage would add a runtime dependency without providing complete validation.

If runtime validation becomes a public feature, design optional, schema-aware validators generated from or supplied alongside site metadata. Specify unknown-field handling, nullable values, relationship shapes and selected-field projection, and test malformed payloads before promising response safety. Keep that separate from application RPC validation. Reconsider a core dependency when shared validation complexity justifies it; this decision does not prohibit Zod in applications.
