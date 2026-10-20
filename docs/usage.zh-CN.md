[English](usage.md) · [简体中文](usage.zh-CN.md)

# 使用指南

## 连接与认证

```ts
import { ShotGridClient } from 'shotgrid-js-sdk'

const sg = new ShotGridClient({
  baseUrl: 'https://your-site.shotgrid.autodesk.com',
  auth: { type: 'script', scriptName: 'pipeline', scriptKey: 'server-side-secret' },
})

// Optional: requests also authenticate on demand.
await sg.connect()
```

选择一种认证配置：

| `auth.type` | 必填字段 | 可选字段 |
| --- | --- | --- |
| `script` | `scriptName`、`scriptKey` | `sudoAsLogin`、`sessionUuid` |
| `password` | `username`、`password` | `authToken`（双因素认证）、`sudoAsLogin`、`sessionUuid` |
| `session` | `sessionToken` | — |
| `refresh` | `refreshToken` | — |
| `token` | `getAccessToken` 回调 | 回调结果可包含 `expiresAt` |

仍支持早期的 `credentials: { grantType, ... }` 配置。`auth` 和 `credentials` 二选一。独立令牌交换仍可使用导出的 `AuthService`。

已有认证系统时，可通过 token provider 提供令牌，无需把脚本凭据放入客户端：

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

`obtainTokenFromYourBackend` 由应用实现。首次获取、已知即将过期或令牌被拒绝时都会调用回调，回调必须返回有效令牌。每个客户端实例同一时间只进行一次令牌获取。

内置认证在内存中保存轮换的 access/refresh token 对。refresh token 为单次使用，交换不会自动重试。刷新遭到拒绝（400/401）时，除仅刷新模式外，会退回原始凭据；网络或服务器故障直接向上传递。交换失败后丢弃旧令牌对，避免后续复用可能已被消耗的 refresh token。仅刷新模式失败后，需要用新凭据创建新客户端。业务请求遇到 401 最多恢复并重放一次。写入遇到结果不确定的网络故障时不会自动重试。

## 查询与分页

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

默认行为接近 Python SDK：字段为 `['id']`，始终包含 `type`，按 `id` 升序，`filter_operator: 'all'`，查询未删除记录，包含已归档项目，`limit: 0`、`page: 0`。`findOne` 只请求一条记录，无结果返回 `null`。

当 `page: 0` 时，`limit: 0` 收集全部匹配记录，正数 limit 则限制总数。指定正数 page 时必须提供正数 limit，它表示逻辑页大小；内部可能需要多次 REST 请求来组装该页。分页仅使用服务器的下一页标记，不跟随其主机地址，也不丢失原过滤条件。

大型查询可以逐条读取，退出循环即可停止继续取页：

```ts
for await (const asset of sg.entity('Asset').iterate([], ['code'])) {
  console.log(asset.code)
}
```

`FindOptions.signal` 接受 `AbortSignal`。取消查询不会取消其他请求也需要的共享令牌交换。

## 类型与工作室自定义字段

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

内置注册表覆盖 Project、Asset、Shot、Task、Version、Sequence、HumanUser 的常用字段，描述字段被选中时的值类型，不保证所有工作室都有这些字段。服务器始终是最终依据。通过声明合并添加实体和字段；没有被查询选中的字段不会出现在静态结果类型中。

支持以已注册字段为起点的点路径，例如 `entity.Asset.code`。在引入 schema 感知的路径生成前，其投影值为 `unknown`。过滤参数使用 `unknown` 以容纳关系操作符的不同参数结构。类型化写入排除只读元数据。

## 写入、批处理与汇总

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

`create(entity, data, returnFields?)` 请求写入字段和额外指定字段；`update(entity, id, data, modes?)` 请求被修改的字段。结果是带数值 `id` 和 API `type` 的扁平对象，关系字段保留链接对象或数组。SDK 不修改传入的写入数据和过滤数组。

批处理使用 Python 的 `entity_type` / `entity_id` 键，以一个原子 REST batch 发送，并保留输入顺序。空批处理直接返回 `[]`，不发送 HTTP。删除操作的限制见兼容性文档。

## Schema 与原始 REST

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

Schema 读取会去掉响应外层结构；单字段读取返回以字段名为键的对象。原始 REST 工具保留 API 外层结构，接受 REST 端点名称。高层方法将 API 名称（`Asset`、`HumanUser`、`CustomEntity01`）转换为 REST 路径（`assets`、`human_users`、`custom_entity_01s`），`sg.rest` 不进行这种转换。

`sg.rest.request<T>(method, path, options)` 接受 `signal`、`params`、`data` 和 `contentType`。快捷方法包括 `get`、`post`、`put`、`delete`、`search`、`list`、`read`、`create`、`update`、`remove`、`batch`、`schema`。路径相对于配置的 API 版本，查询参数单独传入。绝对 URL 和目录穿越路径会被拒绝。

## 配置与错误

配置包括 `apiVersion`（默认 `v1.1`）、`timeoutMs`（15 秒）、`leewayMs`（30 秒，上限为令牌有效期的一半）、`maxRetries`（符合条件的令牌交换重试 2 次）、`retryBaseDelayMs`（300）、`logger`，以及可注入的 Axios `httpClient`。注入实例需要自行配置 API `baseURL`、超时及其他默认值。

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

HTTP/认证失败使用 `ShotGridClientError`，其 `kind` 为 `'http_error' | 'auth_failed' | 'unexpected'`；独立令牌交换使用 `AuthServiceError`。无效本地参数或格式错误的实体响应抛出 `TypeError`；请求前取消也可能抛出 abort 错误。错误的 `cause` 可能包含 Axios 请求配置，不应序列化到公共日志。可通过 `logger: console` 或自定义实现启用日志。认证日志不记录原始异常消息，日志失败与请求结果隔离。错误原因虽不可枚举，显式查看时仍可能包含敏感信息。

## 链式查询

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

`sg.query(type)` 等同于 `sg.entity(type).query()`。每个构建方法都返回新查询。`select` 替换上一次字段选择；`where` / `filter` 追加 AND 条件；`whereAny` 添加嵌套 OR 组。重复 `orderBy` 追加排序字段。`retiredOnly`、`includeArchivedProjects`、`signal` 设置对应选项。

只有 `all`、`first`、`iterate` 执行请求。指定逻辑页时 `first` 在该页取首条，否则只请求一条。构建器不是 thenable，`await query` 不会隐式执行，也不缓存结果。`.where` 根据注册字段推导相等、比较、成员及时间操作符的参数类型。Python 风格的 `filter` 组保留灵活的 `unknown` 参数；深层字段值仍为 `unknown`。

使用 [createClientProvider](client-lifecycle.zh-CN.md) 在服务端模块间共享 SDK；使用[全栈范本](fullstack.zh-CN.md)连接前端而不暴露凭据。
