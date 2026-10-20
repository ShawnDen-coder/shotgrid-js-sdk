[English](fullstack.md) · [简体中文](fullstack.zh-CN.md)

# 全栈 TypeScript 集成

推荐流程：浏览器 → 应用 HTTP/oRPC 接口 → 服务端共享 SDK → ShotGrid。SDK 负责 ShotGrid 传输与认证；应用负责用户会话、授权、结果缓存和对外 API。

## 是否需要 RPC？

不必强制引入。传统的认证接口可以配合任何前端，通常也是现有应用改动最少的方式。[server/http.ts](../examples/fullstack/server/http.ts) 和 [browser/http.ts](../examples/fullstack/browser/http.ts) 提供普通 Fetch 示例：校验项目 ID、检查项目访问权限、最多返回 50 条选定字段，并隐藏上游错误。

新建全栈 TS 应用时，oRPC 是值得选择的可选层：路由的输入校验与参数/结果类型可以延伸到客户端。本仓库验证的范本使用 **oRPC 1.15.7** 和 [v1 文档](https://v1.orpc.dev/docs/integrations/tanstack-query)。RPC 改善应用的类型边界，本身不减少 ShotGrid 延迟，也不合并上游请求；实例复用和结果缓存分别处理这些成本。oRPC 主站可能介绍更新的 beta API，请采用适合应用的版本。SDK 核心不依赖 oRPC。

## oRPC 示例文件

| 文件 | 用途 |
| --- | --- |
| [server/client.ts](../examples/fullstack/server/client.ts) | 固定脚本身份的延迟共享 SDK |
| [server/router.ts](../examples/fullstack/server/router.ts) | 带认证、项目授权和输入校验的 `assets.list` |
| [server/handler.ts](../examples/fullstack/server/handler.ts) | 注入应用上下文的 Fetch `/rpc` 处理器 |
| [server/ssr.ts](../examples/fullstack/server/ssr.ts) | 按请求创建的服务端直接调用客户端 |
| [browser/client.ts](../examples/fullstack/browser/client.ts) | 类型化 RPC 客户端及按站点/租户/用户划分的查询工具 |
| [browser/react.ts](../examples/fullstack/browser/react.ts) | React `useAssets` hook 工厂 |
| [browser/vue.ts](../examples/fullstack/browser/vue.ts) | 响应式 Vue `useAssets` composable 工厂 |

将范本复制到应用中并调整业务操作。它们不是 `shotgrid-js-sdk/orpc` 之类的导出，也不是 SDK 打包的框架适配器。

在采用示例的应用中安装可选依赖：

```sh
pnpm add @orpc/server@1.15.7 @orpc/client@1.15.7 @orpc/tanstack-query@1.15.7 zod
# Choose the framework integration used by your app:
pnpm add @tanstack/react-query react
# or
pnpm add @tanstack/vue-query vue
```

## 提供经过校验的业务 API

```ts
import { getShotGrid } from './server/client'
import { createAssetRpcHandler } from './server/handler'
import type { AssetRpcContext } from './server/router'

// The application supplies real session verification and project authorization.
export function createApplicationApi(resolveContext: (request: Request) => Promise<AssetRpcContext>) {
  return createAssetRpcHandler({ getClient: getShotGrid, resolveContext })
}
```

将返回的 Fetch 处理器注册到服务端框架的 `/rpc/*`。通过已有认证层提供已验证会话和 `canReadProject` 授权函数，没有默认全部放行的生产配置。新增写入过程时，应接入框架的 cookie/session、来源检查和 CSRF 防护。

客户端输入只包含项目 ID、页码和有上限的数量，不接受任意 SDK 路径、实体类型、字段、凭据或 sudo 范围。路由选择允许返回的 DTO 字段，将上游失败转换为通用 `BAD_GATEWAY`。公开接口前，应加入适合应用的限流和超时。

## 创建浏览器客户端

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

浏览器客户端使用 `import type` 导入路由类型，编译后会被移除；服务端 SDK、路由实现和凭据不会进入浏览器包。浏览器构建测试验证这一边界。非 RPC 应用可从 `shotgrid-js-sdk/types` 只导入 DTO 类型，此子路径故意不提供运行时导出。

在浏览器应用的会话初始化时创建一次客户端和查询工具。退出、切换站点/租户或权限变化时，重建或清理缓存和工具。站点/租户/用户标签不能代替服务端授权，也不能包含令牌。

## React hooks 与 Vue composables

无需再建立一套 SDK 专属缓存或响应式系统。范本包装 TanStack Query 现有 hooks，保留类型推导、请求去重、取消和缓存生命周期。oRPC 的框架无关查询工具同时适用于 React Query 与 Vue Query，参见 [TanStack Query 集成](https://v1.orpc.dev/docs/integrations/tanstack-query)。

React 初始化：

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

Vue 初始化：

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

Vue 应先注册 VueQueryPlugin；React 的 hooks 应在 QueryClientProvider 下调用。示例关闭自动重试，数据新鲜时间为 30 秒。Mutation 需要显式增加缓存失效和应用错误处理，不应自动重试上游写入。

目前没有 `shotgrid-js-sdk/react` 或 `/vue` 专属入口及其 peer dependencies。只有当多个应用需要共享超出这些小包装的 SDK 特有逻辑时，独立框架 API 才值得发布。当前范本使用 React 19 / Vue 3、TanStack Query 5 进行类型检查；HTTP/RPC/查询缓存流程有集成测试，但未挂载界面测试。

## SSR 直接调用，无需请求自身

```ts
import { createSsrAssetClient } from './server/ssr'

export async function renderAssets(context: AssetRpcContext) {
  const api = createSsrAssetClient({ getClient: getShotGrid }, context)
  return api.assets.list({ projectId: 123 })
}
```

验证会话后，为每个请求创建上下文。只有 ShotGrid 身份固定时才共享 SDK，授权仍逐个调用者执行。预取/脱水使用的 QueryClient 同样应按请求创建。直接调用客户端与 HTTP 路由执行相同的输入校验和权限检查。

## 日志边界

核心库不依赖日志库，也不读取 Node 环境变量。浏览器和服务端默认都不输出日志；传入 logger 后只接收固定认证消息，以及 grant 类型、HTTP 状态、尝试次数等元数据。不记录原始异常文本或令牌响应。Logger 抛错不会掩盖请求结果。

SDK 错误的 cause 仍可用于服务端调试，但设为不可枚举。这只减少意外 JSON 序列化，不能保证 `console.error(error)`、自定义 inspect、`message` 或上游 `detail` 适合公开。应用 API 应返回自己的消息和错误码；oRPC 和 HTTP 示例在响应前丢弃上游错误。
