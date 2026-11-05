# AGENTS.md

> 本文件供 AI 编码助手（如 Claude Code / Cursor / Copilot）快速建立项目上下文。
> 人类开发者请优先阅读 [`README.md`](./README.md)。

## 项目一句话

舌尖上的村落 —— 乡村文旅美食打卡应用。
**前后端分离架构**：前端 uni-app (Vue 2) + 后端 Node.js/Express + 数据库 SQLite/Prisma。
**零付费云依赖，不需要注册任何云账号，本地即可完整跑通。**

**作者：CharLene** · **License：MIT**

---

## 目录约定

```
pages/                    业务页面（新增页面放这里，并在 pages.json 注册）
components/               复用组件
utils/
  request.js              ★ HTTP 封装（uni.request → Promise，自动带 JWT）
  auth.js                 ★ API 语义化封装（authApi/userApi/businessApi/agentApi）
  session.js              ★ 会话健康检查
  router-guard.js         ★ 登录守卫
agent/                    ★ 自研 Agent 编排核心（Sprint 5 起编排在服务端执行）
  core/     planner · executor · memory · fallback · trace
  tools/    注册表 · user-stats · server-time · echo · avatar-speak
  adapters/ rule-adapter（默认）· llm-adapter（可选）
  tests/    单元测试
digital-avatar/           ★ 自研数字人交互层
  renderer/ canvas-avatar · bridge/ lipsync
  controller/ avatar-controller · adapters/ tts-adapter
server/                   ★ 后端工程（Sprint 5 新增）
  src/routes/    auth · user · business · agent
  src/services/  agent.js（知识库 + 规则回答）
  src/middleware/auth.js（JWT）
  src/utils/security.js（四道安全闸）
  prisma/schema.prisma  数据库 schema
  data/knowledge.json    知识库数据
docs/                     审计报告 / 技术债报告 / 架构 / 上线手册 / 敏捷过程
scripts/                  本地校验与迁移脚本
```

---

## 硬性规则

### 1. 密钥绝不写进源码

所有第三方凭据从 `server/.env` 读取（由 `dotenv` 加载），源码只允许出现
`your-*-placeholder` 占位符。

```js
const { config, isServiceEnabled } = require('./config')
const apiKey = config.services.deepseek.apiKey
```

### 2. 零配置可运行是硬指标

**默认路径不得产生任何外部 API 调用与费用，也不需要任何云账号。**
收费服务一律通过 `isServiceEnabled('xxx')` 判定，未启用走本地降级路径。
新增功能时必须提供无 Key 也能演示的分支。

### 3. 增强优先于重建

18 个业务页面、5 个组件、21 个业务接口语义都是既有资产。
改代码前先确认真的不能复用 —— 见 `docs/现有能力审计报告.md` 的资产清单。

### 4. 安全设计一条都不能丢

Sprint 1 设计的六项安全机制，重构后**一条都不能退化**：

| 安全设计 | 落地位置 |
|---|---|
| 手机号严格类型校验 | `server/src/utils/security.js` → `validateMobile` |
| CSPRNG 验证码 | 同上 → `generateVerifyCode`（`crypto.randomInt`） |
| 发送频控（60s + 单日 10 次） | 同上 → `checkRateLimit` |
| 错误次数锁定（5 次作废） | 同上 → `verifyCode` |
| JWT 鉴权 | `server/src/middleware/auth.js` |
| 会话健康检查 | `server/src/routes/user.js` → `/api/user/session` |

> 每一项都有对应的契约测试断言（`server/tests/api.test.js`，61 项）。
> **改动安全相关代码后必须跑 `npm run test:api`。**

### 5. 官方模块不改

`uni_modules/` 下剩余 8 个模块（`uni-badge` / `uni-easyinput` / `uni-forms` /
`uni-icons` / `uni-load-more` / `uni-popup` / `uni-scss` / `uni-transition`）
经核查均为纯 UI 组件、零 uniCloud 依赖。除非必须修 bug，不要修改。

### 6. 数据库不写真实数据

`server/prisma/dev.db` 已被 `.gitignore` 排除，永不入库。
`server/.env` 同样排除。仓库中不含任何真实用户数据。

### 7. 改完 JSON 必跑校验

```bash
npm test
```

校验器支持三种格式：标准 JSON、JSONL（每行独立 JSON）、含行注释 schema。

---

## 常用命令

```bash
# 前端与共享模块
npm test                 # 静态检查（JSON / 残留引用 / Vue 语法 / 模板标签 / 页面注册）
npm run test:agent       # Agent 编排层单测（53 项）
npm run test:avatar      # 数字人交互层单测（15 项）
npm run test:normalizer  # 协议适配层单测（23 项）
npm run test:list        # 长列表 mixin 单测（13 项）
npm run test:contract    # API 契约测试（16 项，需后端已启动）
npm run test:all         # 以上全部

# 后端
cd server
npm install              # 首次
npx prisma db push       # 初始化 SQLite（10 张表）
node scripts/seed.js     # 导入种子数据（幂等）
npm run dev              # 启动（3000 端口）
npm test                 # 全部后端测试（自动拉起服务：19 项单测 + 61 项接口测试）
npm run test:unit        # 缓存与分页单元测试（无需数据库）
npm run test:api         # 接口与安全设计测试（61 项，需服务已启动）

# CI 配置校验
node scripts/check-workflow.js
```

---

## 后端开发注意

- 云函数时代的 `event` / `context` 概念已不存在，直接用 Express 的 `req` / `res`
- 认证中间件：`requireAuth`（强制）/ `optionalAuth`（可选）
- 业务接口用**聚合路由** `/api/business/:name`，`name` 与原 uniCloud 云函数同名
- Prisma 客户端用单例：`require('./db').getPrisma()`，不要每次 new
- 新增表：改 `server/prisma/schema.prisma` → `npx prisma db push` → `npx prisma generate`
- **静态数据走缓存**：`server/src/utils/cache.js` 提供 TTL + 标签失效 + 并发去重。
  村庄 / 美食 / 商品 / 题库已接入（标签 `village` / `food` / `shop` / `quiz`）；
  用户态数据**不进缓存**，改用分页
- **用户态列表分页**：`server/src/utils/pagination.js`。
  未传 `page` / `pageSize` 时返回全量（向前兼容），传入后走 `skip/take + count`
- 写操作后若影响静态数据，调用 `cache.invalidate('village')` 等标签失效

---

## 前端开发注意

- **不要用 `uniCloud.*`** —— 已彻底移除 uniCloud 依赖
- 网络请求走 `utils/request.js`（`get` / `post` / `put` / `del` / `upload`）
- 页面里不要写 URL 字符串，用 `utils/auth.js` 的语义化封装
- 受保护页面在 `onLoad` 里加 `if (!checkAuth()) return`
- 真机调试需把 `utils/request.js` 的 `BASE_URL` 改为电脑局域网 IP
- **长列表页面用 `utils/list-loader.js` mixin**，不要一次性拉全量。
  方法名按 `listKey` 生成命名空间（`load<Cap>Page` / `loadMore<Cap>` / `reload<Cap>`），
  同一组件可混入多个实例。配套在后端接口上启用 `page` / `pageSize` 参数

---

## 迭代流程

当前 Sprint 与待办见 [`docs/敏捷开发过程.md`](./docs/敏捷开发过程.md)。
每个 Sprint 结束需更新 README 的对应章节，并在 commit message 中体现 Sprint 编号。

---

## 不要做的事

- ❌ 引入 `uniCloud.*` 调用
- ❌ 把真实密钥写进任何被 git 跟踪的文件
- ❌ 把 `server/.env` 或 `server/prisma/dev.db` 提交进 Git
- ❌ 修改 `uni_modules/` 下的官方模块
- ❌ 删除 `docs/` 下的审计与债务报告（它们是简历的一部分）
- ❌ 在 README 里声称完成了未实际执行的操作（如"已打包出 APK"）
  —— 平台限制无法验证的环节，写进 Known Issues 并给出替代路径
