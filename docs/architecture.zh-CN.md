[English](architecture.md) · [简体中文](architecture.zh-CN.md)

# 模块架构

公共客户端组合各服务。服务负责行为，适配器处理 REST 差异，HTTP 层负责授权与恢复。通用 Axios 配置不渗入类型化实体 API。

| 模块 | 职责 |
| --- | --- |
| `src/client-provider.ts` | 明确持有每个应用身份对应的延迟客户端 |
| `src/entities/builder.ts` | 不可变链式查询状态及带类型的执行方法 |
| `src/logging.ts` | 可选日志边界，日志失败不影响 SDK 行为 |
| `src/client.ts` | 组装服务并公开 API |
| `src/auth/service.ts` | 令牌端点请求及符合条件的交换重试 |
| `src/auth/grants.ts` | 公共认证配置和 OAuth 表单编码 |
| `src/auth/token-manager.ts` | 内存令牌对、过期判断、单次并发获取和外部 provider |
| `src/auth/tokens.ts`、`errors.ts` | 令牌响应校验/转换和认证错误转换 |
| `src/http/transport.ts` | 授权请求、一次 401 恢复、signal 及继承 Axios 超时 |
| `src/http/rest-client.ts` | 保留响应外层结构的原始 REST 方法与资源工具 |
| `src/http/paths.ts`、`errors.ts` | 安全 API 路径与 HTTP 错误转换 |
| `src/entities/service.ts` | 接近 Python 行为的实体操作与分页 |
| `src/entities/filters.ts`、`query.ts` | 过滤转换与 Python 查询默认值 |
| `src/entities/records.ts` | 扁平记录和数值 ID |
| `src/entities/mutations.ts`、`batch.ts` | 多实体写入与原子批处理映射 |
| `src/entities/names.ts` | API 类型到 REST 路径的命名转换 |
| `src/entities/repository.ts` | 绑定实体的快捷方法，委托 EntityService |
| `src/entities/summary.ts` | 汇总请求适配 |
| `src/schema/service.ts` | Schema 读取与响应结构适配 |
| `src/types/` | 公共配置、实体注册表、字段选择和传输类型 |

`src/auth.ts` 保留早期独立 AuthService 的导入兼容。消费端通过公共包导出使用 `src/index.ts`，内部模块不作为独立包入口。

## 请求流程

1. 类型化方法检查本地参数，转换 Python 风格过滤条件和选项。
2. RestClient 编码端点操作，Transport 向 TokenManager 请求缓存令牌。
3. TokenManager 共享认证或刷新过程。仅 refresh 模式不会退回已消耗的初始令牌。
4. Transport 发送操作；401 最多恢复一次，网络/服务器写入错误直接向上传递，不重放。
5. 实体/schema 适配器去掉 REST 外层结构并规范化结果。

查询按需迭代服务器分页，`find` 收集该迭代器，`findOne` 限制为一条。服务器 next 链接只提供页码，其主机和路径不会接收到站点授权信息。

## 扩展规则

- 实体操作加入所属服务，不放入客户端构造函数或 transport。
- REST 命名及外层结构保留在 REST 层，业务方法返回 Python 风格实体。
- 为工作室类型扩展 EntitySchema/字段接口，不将所有字段放宽为 `any` 或字符串索引签名。
- 不重试单次使用的 refresh grant，不将原子 batch 拆成独立写入，不自动重放结果不确定的写入。
- 为行为添加协议范本，为类型约定添加编译断言，为公共声明添加包消费端检查。

库构建已替换未使用的 Vite 浏览器演示，没有浏览器入口页。日志由应用通过可选接口提供，核心库内没有环境变量读取或日志依赖。

## 全栈边界

应用特定的 HTTP/oRPC 路由和 React/Vue 范本放在 `examples/fullstack`，不进入核心入口。可选集成包作为开发依赖用于验证示例。浏览器运行时导入不能触及服务端 SDK，由集成构建测试约束这一依赖边界。`/types` 导出仅映射 TypeScript 声明，没有运行时条件。

链式查询的执行方法委托 EntityService，状态不可变，不缓存结果。ClientProvider 只持有延迟创建的 SDK 实例，不自动选择全局或用户缓存键。
