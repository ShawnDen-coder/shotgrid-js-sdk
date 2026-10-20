[English](dependencies.md) · [简体中文](dependencies.zh-CN.md)

# 依赖与运行时校验

## 为什么 Axios 会自动安装

Axios 是 SDK HTTP 传输的实现依赖，现在声明在 `dependencies` 中，普通使用者只需安装 SDK：

```sh
npm install shotgrid-js-sdk
# or
pnpm add shotgrid-js-sdk
```

早期声明使用 `peerDependencies`，README 因而明确安装两个包。Peer dependencies 表达与宿主包的兼容关系；npm 7+ 通常会自动安装，其他版本或配置可能需要使用者处理。SDK 默认自行创建 Axios 实例，因此普通运行时依赖更准确地表达归属。参见 [npm 依赖文档](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#peerdependencies)。

Axios 在库构建中仍为 external：由包管理器安装并解析，而不是复制进库产物。External 不代表用户必须手动安装。应用若显式导入 Axios 创建自定义 `httpClient`，应声明自己的 Axios 依赖。应用上的拦截器不会自动附加到 SDK 默认实例，需要显式注入配置好的实例。

## Zod 应该放在哪里

[Zod](https://zod.dev/) 已是精确固定版本的开发依赖，用于可选 oRPC 路由示例。采用该示例的应用按[全栈指南](fullstack.zh-CN.md)自行安装 Zod。只安装核心 SDK 不会安装 Zod、oRPC、React 或 Vue。

| 边界 | 当前校验 | 职责 |
| --- | --- | --- |
| 应用 HTTP/oRPC 输入 | oRPC 范本使用 Zod，普通 HTTP 范本显式解析 | 调用 SDK 前拒绝无效项目、页码、数量 |
| 认证与 REST 协议 | SDK 内的针对性检查 | 校验令牌响应、ID、本地参数和必要响应结构 |
| 工作室自定义实体字段 | TypeScript 声明合并，不是完整运行时校验 | 应用按需定义额外运行时 schema |
| 应用对外响应 | 选定 DTO 字段和应用错误映射 | 仅公开允许的数据，可额外通过输出 schema 检查 |

TypeScript 类型在运行时会被擦除。泛型响应类型或声明合并不能证明服务器响应符合该类型。当前协议检查并不覆盖每个实体字段。Zod 输入 schema 也不负责授权，示例会单独检查会话和项目权限。

## 核心库是否应该强制依赖 Zod？

现阶段不需要。核心只做必要的边界检查，ShotGrid 字段随工作室及查询所选字段变化。固定且严格的实体 schema 可能拒绝合法自定义字段，或与站点实际 schema 脱节。没有完整 schema 覆盖时引入 Zod，会增加运行时依赖，却不能提供完整校验。

若将运行时校验做成公共能力，应设计可选且理解站点 schema 的校验器，由站点元数据生成或由应用提供。先明确未知字段处理、可空值、关系结构和字段投影规则，并测试异常响应，再承诺响应安全性。它与应用 RPC 输入校验应分开设计。共享校验复杂度足够高时再评估核心依赖；这一选择不限制应用使用 Zod。
