[English](CONTRIBUTING.md) · [简体中文](CONTRIBUTING.zh-CN.md)

# 贡献指南

项目将 TypeScript 构建为 ESM、CommonJS 和合并后的类型声明。使用 Node.js 22 与 CI 保持一致。`packageManager` 固定 pnpm 版本；`pnpm-workspace.yaml` 明确允许构建工具所需的 esbuild 安装脚本。

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm docs:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:package
```

- `docs:check` 检查中英文标题和代码块结构、表格行数、语言切换及本地链接。文档变更请同步维护两种语言。
- `typecheck` 检查源码、示例、运行时测试类型，以及 `tests/types.test-d.ts` 中预期失败的类型断言。
- `test` 使用 Axios adapter 协议范本，不需要真实站点或凭据。
- `test:package` 执行 ESM/CommonJS 冒烟测试，并编译依赖构建后声明文件的消费端。先执行 build。
- `fmt` 用 Biome 格式化支持的文件。`lint` 检查格式、导入顺序和推荐规则，`lint:fix` 应用安全修复。

修改兼容行为时，更新 [Python 行为约定](docs/python-compatibility.zh-CN.md)，并为可观察差异补充协议范本。协议测试不代表真实服务器上的一致性验证。请勿在测试中放入私有站点地址、凭据或生产数据。

新增代码前请阅读[模块架构](docs/architecture.zh-CN.md)。环境示例使用服务端 `SHOTGRID_*` 变量，不要把脚本密钥写入浏览器打包示例。

## 提交前检查

`pnpm install` 的 prepare 脚本会在仓库检出目录安装 Lefthook，CI 和仅生产依赖安装会跳过。依赖自身的 postinstall 被禁用，由本项目脚本明确控制安装。可运行 `pnpm hooks:install` 手动重装。

pre-commit 用 Biome 检查暂存文件，并检查全部源码、示例和测试的类型。它只检查，不改写、重新暂存或 stash 部分暂存文件。CI 也检查整个目录，避免未暂存文件掩盖问题。此处 Biome 不格式化 Markdown/YAML，这些文件需要直接维护。VS Code 配置使用 Biome 与 tsx。

## 集成与发布包检查

oRPC、Zod、React/Vue 和 TanStack Query 是验证示例所用的可选开发依赖，精确固定版本，不应进入核心运行时导入或 peer dependencies。浏览器集成测试构建核心库和前端范本，拒绝 Node 内置模块垫片及含服务端凭据的模块。RPC 测试使用内存中的真实 Fetch 请求和直接 SSR 调用，不监听端口，也不需要真实凭据。Hooks/composables 进行类型检查，未进行挂载界面的测试。

`tests/package/tsconfig.json` 故意不配置源码别名，用于检查实际发布的声明文件及仅类型子路径。源码和示例使用自引用别名，使示例始终使用公共包导入，而无需先构建。
