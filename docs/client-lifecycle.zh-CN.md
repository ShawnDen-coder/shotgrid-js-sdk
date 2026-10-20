[English](client-lifecycle.md) · [简体中文](client-lifecycle.zh-CN.md)

# 实例生命周期与性能

创建客户端只会构造 Axios 和服务对象，不会连接 ShotGrid。反复创建实例的主要代价是丢失令牌缓存及认证请求协调能力。重复的数据查询是另一类成本，需要通过分页和应用查询缓存处理。

## 每个共享身份使用一个 provider

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

使用同一身份的路由、服务和后台任务都应导入这个 provider。工厂在首次调用时执行。查询构建器和绑定实体的包装对象很轻量，无需各自创建客户端。如果希望认证失败阻止应用启动，可以在启动时主动调用 `await getShotGrid().connect()`。

```ts
// Several routes use the same instance and token manager
const assets = await getShotGrid().query('Asset').select('code').limit(50).all()
const projects = await getShotGrid().find('Project', [], ['name'], { limit: 50 })
```

此工具不提供进程全局凭据注册表、隐藏的租户缓存或令牌持久化。分别创建的两个 provider 各自拥有客户端。请把 provider 放在一个公共模块中，或通过应用容器注入同一个客户端/provider。

## 选择合适的作用域

| 场景 | 作用域 |
| --- | --- |
| 固定站点与脚本身份 | 服务端公共模块或应用级 provider |
| 多工作室、站点或脚本 | 每个明确配置的身份各自拥有 provider |
| 用户会话、sudo 身份或权限不同 | 请求/会话级客户端，或由应用管理且有容量上限的用户缓存 |
| SSR 请求 | 仅在脚本身份确实共享时复用 SDK；用户授权上下文和 QueryClient 按请求创建 |
| 浏览器界面 | 每个登录范围拥有应用 RPC 客户端和查询缓存；不在每个组件中创建脚本 SDK |
| 后台任务进程 | 进程持有固定身份的 provider |

缓存键需要考虑站点、身份、模拟用户/sudo 范围，以及权限和会话配置，不应包含访问令牌或脚本密钥。进程全局 SDK 的令牌回调不能捕获“当前请求用户”：第一次获取的令牌可能被后续用户复用。

应用自己的会话缓存应限制容量、设置过期时间，并在退出或权限改变时驱逐。多个独立客户端/进程不能同时持有并刷新同一个单次使用的 refresh token。请指定唯一的刷新负责人，或使用外部集中式 token provider。

## SSR、热更新与 serverless

模块中的 provider 仅在该模块和运行时实例内复用。不同 worker、serverless 冷启动、重复打包和开发热更新都可能产生新实例。SDK 无法安全地将它们变成跨进程单例；需要时由应用提供分布式令牌/会话管理。

将 provider 放入框架的服务端专用模块，例如加入框架提供的 server-only 导入保护。前端可以导入路由或 DTO 的**类型**，不能在运行时导入读取服务端环境凭据的模块。

SSR 可以直接调用 oRPC 服务端客户端，保留授权中间件而无需请求应用自身。上下文按请求创建。服务端 QueryClient 和前端查询缓存不能跨不同身份的 SSR 请求共享。

## 结果缓存与请求数量

`createClientProvider` 复用认证状态，不缓存查询结果。每次 `all()`、`first()`、`find()` 或写入都会执行新操作。同一 SDK 实例会协调并发认证/刷新，但不会自动记忆或合并独立数据请求。

界面数据使用 TanStack Query 或等效应用缓存。示例的查询键带站点/租户/用户前缀，并包含过程输入（项目、页码、数量）。相同的进行中查询可以共享请求，过期时间决定后续是否重新获取。身份变化时清理或替换缓存。查询键只划分缓存，不承担服务端授权。

交互路由应限制数量并选择必要字段。兼容 Python 的 `find()` 默认读取全部匹配记录，通常不适合作为 HTTP 接口默认行为。界面 hooks 不应重试结果不确定的写入；mutation 需要单独设计缓存失效和幂等性。
