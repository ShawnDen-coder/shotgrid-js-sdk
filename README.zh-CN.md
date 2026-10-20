[English](README.md) · [简体中文](README.zh-CN.md)

# shotgrid-js-sdk

面向 Autodesk Flow Production Tracking（ShotGrid / Shotgun）的 TypeScript SDK，提供类型安全的链式查询、OAuth 令牌管理和接近 Python SDK 习惯的实体方法，适用于服务端工具和全栈 TypeScript 应用。

## 服务端：初始化一次，在路由间复用

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

每个 provider 在第一次调用时创建一个客户端，复用进行中的认证请求以及轮换的令牌对。请在一个公共模块中导出 provider，不要在每个处理函数或组件中重复创建。仅当站点、身份及权限范围相同时复用。[实例生命周期与多用户指引](docs/client-lifecycle.zh-CN.md)。

## 前端：调用应用自己的 API

脚本密钥留在服务端。经过用户认证的应用路由检查项目访问权限，再返回数量受限的列表。仓库提供[普通 HTTP 示例](examples/fullstack/server/http.ts)。

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

需要端到端推导参数和返回类型时，可以参考 [oRPC 示例](docs/fullstack.zh-CN.md)：包含输入校验、Fetch 处理器、类型化浏览器客户端，以及基于 TanStack Query 的 React hooks 和 Vue composables。这些是供应用采用的范本，不是 SDK 的必选依赖。SSR 可以直接调用同一个路由，无需向自身发送 HTTP 请求。

## 安装

```sh
npm install shotgrid-js-sdk
# or
pnpm add shotgrid-js-sdk
```

本分支引入了新 API，尚未作为兼容版本发布。ESM 和 CommonJS 产物均提供 TypeScript 声明，服务端支持基线为 Node.js 22+。

## 按习惯选择查询方式

```ts
// Fluent: immutable, lazy builders with selected-field and operand inference
const base = getShotGrid().entity('Asset').query()
  .where('project', 'is', { type: 'Project', id: 123 })

const hero = await base.where('code', 'is', 'Hero').select('code', 'project').first()
const active = await base.where('sg_status_list', 'is', 'ip').select('code').all()

// Python-style calls remain available
const same = await getShotGrid().findOne('Asset', [['code', 'is', 'Hero']], ['code', 'project'])
```

`first()` / `findOne()` 返回实体或 `null`，`all()` / `find()` 返回扁平实体数组。只有执行终结方法才会发送 HTTP 请求。查询构建器可以派生分支，但不缓存结果。大型数据集使用 `iterate()`，界面数据缓存交给应用查询库。

此外还提供带类型的 CRUD、批处理、汇总和 schema 读取。`sg.rest` 保留原始 REST 数据结构。工作室自定义字段可以通过扩展实体注册表声明。

- [使用、认证与链式 API](docs/usage.zh-CN.md)
- [实例生命周期、性能与租户隔离](docs/client-lifecycle.zh-CN.md)
- [HTTP、oRPC、React、Vue 与 SSR 集成](docs/fullstack.zh-CN.md)
- [Python 兼容性与迁移](docs/python-compatibility.zh-CN.md)
- [依赖与运行时校验](docs/dependencies.zh-CN.md)
- [类型化工作流示例](examples/python-compatible.ts)

## 功能范围与日志

核心运行时不依赖 oRPC、React、Vue、查询缓存或日志库。日志默认关闭，启用时也不使用 Node 专属日志库或读取环境变量。内置认证日志不记录原始错误和凭据；日志实现抛出异常不会影响请求结果。

错误保留 `cause` 以便调试，但将其设为不可枚举，减少意外序列化 Axios 配置的机会。这并不意味着可以把整个错误发给浏览器：请像示例一样返回应用定义的消息和选定字段。

当前高层 API 尚未覆盖完整 Python SDK、文件上传下载、文本搜索兼容层、过滤预设、schema 写入及 schema 转 TypeScript 生成。日期保留 API 字符串。测试使用协议范本，不连接真实 ShotGrid 站点。

## 开发

[贡献指南](CONTRIBUTING.zh-CN.md)介绍 Biome、提交前检查、类型断言、浏览器构建和发布包检查。[模块架构](docs/architecture.zh-CN.md)说明内部职责划分。

参考：[Python SDK](https://developers.shotgridsoftware.com/python-api/reference.html)、[REST API](https://developers.shotgridsoftware.com/rest-api/)。
