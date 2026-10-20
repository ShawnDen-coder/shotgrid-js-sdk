[English](python-compatibility.md) · [简体中文](python-compatibility.zh-CN.md)

# Python 兼容性与迁移

高层 API 在 [REST API](https://developers.shotgridsoftware.com/rest-api/) 支持等效行为的范围内参考[官方 Python SDK](https://developers.shotgridsoftware.com/python-api/reference.html)。这是行为适配层，并未移植 Python 的 JSON-RPC 传输。当前测试使用文档化的 REST 响应范本，尚未在真实服务器上对照 Python 与 REST。

## 方法映射

| Python | TypeScript | 结果 |
| --- | --- | --- |
| `sg.connect()` | `await sg.connect()` | 连接/认证检查 |
| `sg.find(entity, filters, fields, ...)` | `await sg.find(entity, filters, fields, options)` | 扁平实体数组 |
| `sg.find_one(entity, filters, fields, ...)` | `await sg.findOne(entity, filters, fields, options)` | 扁平实体或 `null` |
| `sg.create(entity, data, return_fields)` | `await sg.create(entity, data, returnFields)` | 创建后的扁平实体 |
| `sg.update(entity, id, data, multi_entity_update_modes)` | `await sg.update(entity, id, data, modes)` | 更新后的扁平实体 |
| `sg.delete(entity, id)` | `await sg.delete(entity, id)` | 布尔值，受下文 REST 限制影响 |
| `sg.revive(entity, id)` | `await sg.revive(entity, id)` | REST `meta.did_revive` 布尔值 |
| `sg.batch(requests)` | `await sg.batch(requests)` | 按顺序排列的实体/布尔结果 |
| `sg.summarize(...)` | `await sg.summarize(entity, filters, fields, options)` | `summaries` 与 `groups` |
| `sg.schema_entity_read(...)` | `await sg.schema.entityRead(projectId?)` | 实体 schema 映射 |
| `sg.schema_field_read(...)` | `await sg.schema.fieldRead(entity, field?, projectId?)` | 字段 schema 映射 |

链式 `sg.query(entity)` 是面向 TypeScript 增加的入口，委托相同业务方法执行。Python 兼容性作为行为参考，不要求复制全部签名。方法使用 camelCase；实体字段、过滤组和兼容选项保留 Python 名称，例如 `sg_status_list`、`filter_operator`、`include_archived_projects` 和批处理中的 `multi_entity_update_modes`。

Python：

```py
asset = sg.find_one(
    "Asset",
    [["code", "is", "Hero"]],
    ["code", "project"],
    include_archived_projects=True,
)
```

TypeScript：

```ts
const asset = await sg.findOne('Asset', [['code', 'is', 'Hero']], ['code', 'project'], {
  include_archived_projects: true,
})
```

## 行为约定

- `find` 默认读取全部匹配记录，选择 `['id']`，按 `id` 升序，查询未删除记录，包含归档项目，过滤条件使用 AND。每条记录始终带 `id` / `type`。
- `findOne` 无结果时返回 `null`。它接受过滤条件而不是记录 ID，请使用 `[['id', 'is', id]]`。
- Python 嵌套 `{ filter_operator, filters }` 递归转换为 REST 的 `{ logical_operator, conditions }`。`['created_at', 'in_last', 1, 'DAY']` 等可变参数会打包为 REST 数组参数。
- `find` 合并 REST 分页。正数 `page` 以 `limit` 为逻辑页大小，未提供正数 limit 会被拒绝。`iterate` 提供异步逐条读取。
- 从 REST `attributes` 和 `relationships` 生成扁平记录，ID 转为正的安全整数。普通属性 JSON 不递归改写。
- `create` / `update` 请求服务器返回写入字段；create 还可请求额外字段。多实体 `set` / `add` / `remove` 转为逐字段 REST 更新对象。
- 批处理保留顺序与事务边界，发送前完成校验，不用多个独立写入模拟 batch。

## 有意保留的差异与待补功能

| 领域 | 当前行为 |
| --- | --- |
| 异步 | 网络方法返回 Promise，构造函数不发送请求。 |
| 认证 | 使用 REST token grant 或 token provider，不宣称提供 Python `get_session_token` 的等价功能。 |
| 日期时间 | 保留 API 日期/时间字符串，不做 Python 时区或 `datetime` 转换。 |
| 删除 | REST 返回 204。包装层先查询已删除记录，已删除 ID 返回 `false`，缺失记录仍抛 REST 错误。查询与删除是两个请求，存在并发删除竞争。 |
| 批量删除 | 成功条目转为 `true`，除非服务器明确返回布尔值。没有服务端标记时，无法保证 Python 对已删除记录精确返回 `false`。不增加预先写入或拆分事务。 |
| ID | 高层 ID 为数值；`sg.rest` 保留原始字符串/数值表示。 |
| 类型注册表 | 包含常用字段，自定义实体/字段需声明合并，并非完整站点 schema。 |
| 点路径 | 直接传递，投影值类型为 `unknown`。 |
| 过滤预设 | 暂无 `additional_filter_presets` 的高层适配。 |
| 文件 | 暂无上传、下载、缩略图高层工具，也不从 `image` / `filmstrip_image` 输入自动上传。 |
| 其他 Python 方法 | 文本搜索、schema 写入、完整 schema 读取、活动/关注和工作日程暂未提供兼容工具；存在文档化 REST 端点时可用 `sg.rest` 调用。 |
| 错误 | 使用结构化 TypeScript 错误，不复制 Python 异常继承体系。 |

不要仅凭 404 判断记录不存在，不要静默丢弃不支持的选项，也不要宣称完全兼容 Python。在发布兼容性版本前，下一步需要增加真实站点的一致性验证。

## 从早期 SDK 迁移

本次重构改变高层返回值，并移除了含义不清的顶层原始 HTTP 方法，应作为破坏性 API 版本发布。本分支未提高或发布包版本。

| 早期调用 | 保留 REST 行为的替代方法 |
| --- | --- |
| `client.get/post/put/delete(path, ...)` | `client.rest.get/post/put/delete(path, ...)` |
| `client.search/list/read(...)` | `client.rest.search/list/read(...)` |
| 返回 `.data` 的 `client.create/update(...)` | `client.rest.create/update(...)`，或改用高层扁平结果 |
| `client.remove(...)` | `client.rest.remove(...)`，或高层 `client.delete(entity, id)` |
| 使用 `entity` / `record_id` 的 `client.batch(...)` | `client.rest.batch(...)` |
| `client.schema(...)` | `client.rest.schema(...)` |
| `client.authenticate()` | 仍支持；推荐 `client.connect()` 或 `client.auth.authenticate()` |
| REST 类型 `BatchRequest`、`FilterCondition`、`FilterGroup` | `RestBatchRequest`、`RestFilterCondition`、`RestFilterGroup` |

高层方法传 API 实体类型（`Asset`），原始工具传站点接受的端点名（如 `assets`）。旧 `credentials` 配置仍有效，不再需要 `tslog`。早期浏览器演示配置已替换为服务端环境变量示例。
