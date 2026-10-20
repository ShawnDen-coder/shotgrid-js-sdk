[English](CONTRIBUTING.md) · [简体中文](CONTRIBUTING.zh-CN.md)

# Contributing

The project builds TypeScript into ESM, CommonJS, and a bundled declaration file. Use Node.js 22 for the same runtime as CI. The packageManager field pins pnpm; pnpm-workspace.yaml explicitly permits the esbuild install script used by the build tools.

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm docs:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:package
```

- `docs:check` checks English/Chinese section and code-block parity, table sizes, language switches and local links. Update both languages together.
- `typecheck` checks source/examples, runtime test types, and expected TypeScript failures in `tests/types.test-d.ts`.
- `test` uses Axios adapter fixtures; it never requires a real ShotGrid site or live credentials.
- `test:package` runs ESM/CommonJS package smoke tests and compiles a consumer against the built declaration file. Run build first.
- `fmt` formats supported files with Biome. `lint` runs Biome formatting, import organization and recommended lint rules; `lint:fix` applies safe fixes.

When changing compatibility behavior, update [the Python contract](docs/python-compatibility.md) and add a fixture for the observable difference. Protocol fixtures are not live-server parity verification. Keep private site URLs, credentials and returned production data out of fixtures.

See [module architecture](docs/architecture.md) before adding new code. Environment examples use server-side `SHOTGRID_*` variables; do not put script keys into a bundled browser example.

## Pre-commit

`pnpm install` runs a prepare script that installs Lefthook in a repository checkout. CI and production-only installs skip hook setup. The dependency's own postinstall is disabled; our script controls setup explicitly. `pnpm hooks:install` can reinstall hooks manually.

Pre-commit checks staged files with Biome and runs the full source/example/test typecheck. It only checks: it does not rewrite, restage or stash partially staged files. CI also checks the full tree so unstaged files cannot hide failures. Biome does not format Markdown/YAML here; maintain those files directly. VS Code settings select Biome and tsx.

## Integration and package checks

Optional oRPC, Zod, React/Vue and TanStack Query packages are exact-pinned development dependencies for the examples. They must not appear in the core runtime imports or peer dependencies. Browser integration tests build both the core and frontend recipes, rejecting Node builtin shims or credential-bearing server modules. The RPC tests exercise real Fetch requests in memory and a direct SSR client; no listening server or real credentials are needed. Hooks/composables are typechecked recipes, not mounted UI tests.

`tests/package/tsconfig.json` intentionally has no source alias. It checks the actual published declaration files, including the type-only subpath. Source/examples use self-reference aliases so examples keep correct public package imports without requiring a preceding build.
