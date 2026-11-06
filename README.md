# 舌尖上的村落 · Taste of the Village

> 基于 uni-app 与 Node.js 的全栈乡村文旅应用

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A518.0-green.svg)](https://nodejs.org/)
[![Vue](https://img.shields.io/badge/Vue-2.7-42b883.svg)](https://v2.vuejs.org/)
[![Tests](https://img.shields.io/badge/tests-200%20passed-success.svg)](#测试)

面向乡村文旅场景的一站式移动应用，集「村庄探索 — 美食打卡 — 积分兑换 — AI 导览」于一体。
一套代码编译到微信小程序 / H5 / Android App；前端 uni-app (Vue 2)，后端 Express + Prisma + SQLite。
**零付费云依赖，clone 即可完整跑通。**

---

## 目录

- [开源说明](#开源说明)
- [项目背景](#项目背景)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [常用命令](#常用命令)
- [配置](#配置)
- [API 文档](#api-文档)
- [测试](#测试)
- [开发流程](#开发流程)
- [部署](#部署)
- [已知问题与限制](#已知问题与限制)
- [路线图](#路线图)
- [许可证](#许可证)
- [贡献](#贡献)

---

## 开源说明

本项目源于 **2025 年 7 月 – 2026 年 9 月**的 **华师 × 三七互娱 校企合作项目**。
因赛事结束后合作企业对版权的要求及团队后续缺乏维护经费，当前开源版本已做大幅脱敏与重构，与参赛 / 商业版本存在实质差异：

| 能力 | 参赛 / 商业版本 | 本开源版本 | 说明 |
|---|---|---|---|
| 大语言模型 | DeepSeek LLM 真实调用 | **本地规则引擎**（Agent 编排层保留完整） | Agent 架构完整，仅模型调用被替换为规则适配器 |
| 图像识别 | 百度智能云图像识别 | **本地确定性哈希品鉴引擎** | 按文件名 / 大小生成稳定的评分与点评 |
| 语音合成 | 讯飞 TTS 真实调用 | **TTS 适配器接口 + noop 默认实现** | 口型动画链路完整，音频输出默认静音 |
| 对象存储 | 腾讯云 COS | **本地文件系统**（`server/uploads/`） | 上传、静态托管、绝对 URL 拼接均已自研实现 |

**架构完整且可扩展**，填入商业 API Key 即可恢复完整功能，无需重构：

- **Agent 适配器契约已定义**（`classify` / `plan` 两个方法）：在 `server/.env` 填入 `DEEPSEEK_ENABLED=true` 与 `DEEPSEEK_API_KEY`，服务端 `isServiceEnabled('deepseek')` 判定通过后立即走真实 LLM 分支。
- **TTS 适配器接口已定义**（`speak` / `stop`）：默认 noop 实现只做口型不发声，传入自定义适配器即可接入任意 TTS 服务。
- **业务逻辑与外部服务解耦**：品鉴、存储、语音均以服务层接口隔离，替换实现不需要触碰路由层与前端。

> 需要如实说明：讯飞 TTS 目前还缺服务端 `/api/tts` 实现，补齐这一层即可让数字人开口说话；百度识图同理 —— 本地引擎已就位，替换为真实调用即可。

**关于图片资源**：静态图片（49 个文件，约 38 MB）仍引用原合作企业的 COS 公网地址，本仓库未内置这些素材。若该地址失效，可将 `static/` 目录替换为本地资源（路径规则保持一致）。

---

## 项目背景

「舌尖上的村落」是 **华南师范大学 × 三七互娱** 的校企合作项目，面向乡村文旅场景构建移动应用。项目于 **2025 年 7 月启动**，**2026 年 9 月**完成开发与交付。团队在开发过程中发现并重构了三处「表面可用、底层机制缺失」的实现：

1. **登录态不可靠** —— 验证码用 `Math.random()` 生成（可预测）、无发送频控、无错误次数限制
2. **「AI 功能」名不副实** —— 原 AI 模块本质是「知识库检索 + 单轮问答」，无工具调用、无规划、无降级链
3. **数字人只是两张 GIF** —— 口型是开 / 关两态而非参数化开合，无队列、无打断语义

### 团队与荣誉

担任 **5 人团队负责人**，负责整体架构设计、技术选型、任务拆分与代码评审。

| 荣誉 | 说明 |
|---|---|
| **全国易班技术创新大赛 二等奖** | 国家级赛事获奖 |
| **软件著作权登记证书** | 本项目相关软件著作权登记 |

### 技术亮点

| 亮点 | 核心机制 | 结果 |
|---|---|---|
| **前后端分离架构迁移** | 聚合路由 `/api/business/:name` + 协议适配层 `utils/normalizer.js` | 21 业务 + 6 用户 + 4 Agent 接口全部跑通；44 处 `uniCloud.callFunction` 零残留 |
| **数据缓存与长列表优化** | 自研 TTL + 标签失效 + 并发去重 + LRU 缓存层；可选分页（向前兼容）；前端增量渲染 mixin | 缓存与分页单测 19 项 + 后端接口 11 项 + 前端 mixin 13 项全绿；相册首屏只渲染 12 张 |
| **跨端适配** | `uni.*` 统一抽象 + 能力探测显式降级（地图无 Key → 列表视图；Canvas 双模式） | 21 页面、6 组件一套代码覆盖三端；跨端差异收敛在 `utils/` 与 `digital-avatar/` |
| **轻量 Agent 编排层** | 两阶段规划（意图分类 → 工具序列）+ 置信度阈值 0.3 降级 + 结构化错误 + trace | 53 项单测全绿；未知意图 100% 走降级路径；排查问题可定位意图错 / 参数错 / 工具异常 |
| **Canvas 2D 数字人** | LipSyncBridge（纯函数口型序列）+ AvatarController（打断语义）+ Agent 联动 | 15 项单测全绿；`stop()` 立即复位；连续 `speak()` 仅保留一条 rAF 链 |
| **后端迁移安全不退化** | 6 项安全设计逐条翻译为显式契约 + 契约测试 | 61 项接口与安全测试全绿；7 种异常手机号入参零未捕获异常 |

---

## 功能特性

### 业务功能

| 模块 | 功能 |
|---|---|
| 首页 | 村庄介绍、美食推荐、打卡入口 |
| 商城 | 特产商品浏览、下单购买、积分抵扣 |
| 美食详情 | 菜品详情、图片墙、制作步骤 |
| 探索 | 地图选点（无 Key 自动降级为列表）、村落信息展示 |
| 万物长廊 | 村庄风物展示 |
| 旅途手账 | 打卡记录时间轴 |
| 村落勋章 | 积分与成就体系 |
| 打卡 | 定位打卡、拍照上传、做菜打卡、答题打卡 |
| 我的 | 点赞、相册（分页增量加载）、打卡记录、账户资料、关于 |
| 每日签到 | 签到积分、连续签到统计 |

### 账户与安全

| 功能 | 说明 |
|---|---|
| 手机号验证码登录 | `POST /api/auth/send-code` + `/api/auth/login`，用户不存在自动注册 |
| JWT 鉴权 | `jsonwebtoken` HS256，7 天有效期，中间件统一拦截 |
| CSPRNG 验证码 | `crypto.randomInt`，替代 `Math.random` |
| 发送频率限制 | 同号 60 秒一次 + 单日 10 次上限 |
| 错误次数锁定 | 连错 5 次验证码作废，需重新获取 |
| 手机号严格类型校验 | 拒绝数组 / 数字 / null 等异常入参 |
| bcrypt 密码哈希 | 密码登录路径 |
| 会话健康检查 | `GET /api/user/session`，返回有效期 / 即将过期 / 设备数 / 登录地 |
| 静默续期 | 剩余 < 600s 自动刷新，用户无感知 |
| 路由守卫 | 自研 `utils/router-guard.js`，5 个受保护页面 |

### Agent 编排层

| 功能 | 说明 |
|---|---|
| 两阶段规划 | 意图分类 → 工具序列规划 |
| 多工具串行 | 复合提问自动拆解为多个工具调用 |
| 工具注册表 | 四要素声明 + JSON Schema 校验（`user-stats` / `server-time` / `echo` / `avatar-speak`） |
| 降级链 | 低置信度返回能力清单，不猜测工具 |
| 可观测 | 每次调用生成 trace，环形缓冲保留 20 条 |
| 短期记忆 | 滑动窗口，可选持久化 |
| 规则适配器 | 默认路径，零外部依赖 |
| LLM 适配器 | 可选启用，需配置 Key |

### 数字人交互层

| 功能 | 说明 |
|---|---|
| Canvas 2D 形象 | 纯代码绘制，无 Live2D、无模型文件 |
| 口型同步 | 文本 → 口型参数序列，实时驱动 |
| 4 种表情 | 中性 / 开心 / 思考 / 惊讶 |
| 打断语义 | `stop()` 立即复位，覆盖式不排队 |
| TTS 适配器 | 默认 noop（只做口型），可选真实语音 |
| Agent 联动 | `avatar-speak` 工具，Agent 可触发口播 |

### 性能与工程化

| 功能 | 说明 |
|---|---|
| 数据缓存层 | 自研 TTL + 标签失效 + 并发去重 + LRU，`/api/health` 暴露命中率 |
| 长列表分页 | 用户态列表支持 `page` / `pageSize`，未传参时返回全量（向前兼容） |
| 前端增量渲染 | `utils/list-loader.js` mixin，触底加载 + 并发保护 |
| 零付费云依赖 | 不需要注册任何云账号，本地完整跑通 |
| 零配置可运行 | clone → npm install → prisma db push → npm run dev |
| 密钥治理 | 全部经 `server/.env`，源码零凭据 |
| 自动化测试 | 前后端共 200 项 |
| 静态检查防线 | 4 类检查器守护（JSON / 残留引用 / Vue 语法 / 模板标签） |

---

## 技术栈

### 前端

| 层次 | 技术选型 | 说明 |
|---|---|---|
| 跨端框架 | **uni-app (Vue 2)** | HBuilderX 工程，一套代码编译到微信小程序 / H5 / App(Android) |
| 状态与视图 | Vue 2 Options API | 与既有 21 个业务页面保持一致，不做框架迁移 |
| 网络层 | **自研 `utils/request.js`** | `uni.request` → Promise，自动携带 JWT，401 自动清凭证跳登录 |
| 协议适配 | **自研 `utils/normalizer.js`** | Prisma 原始行 → 原云函数数据形状，隔离后端演进 |
| 路由与守卫 | `pages.json` + **自研 `utils/router-guard.js`** | `authRouter.needLogin` 声明受保护页面 |
| 长列表 | **自研 `utils/list-loader.js`** | Vue mixin，分页 + 触底增量加载 + 并发保护 |
| 能力降级 | **自研 `utils/map-capability.js`** | 无地图 Key 时降级为列表视图 |
| UI 组件 | DCloud 官方 uni_modules ×8 | `uni-forms` / `uni-easyinput` / `uni-popup` / `uni-icons` 等纯 UI 模块 |

### 后端

| 层次 | 技术选型 | 说明 |
|---|---|---|
| 运行时 | Node.js ≥ 18 | 零外部服务依赖 |
| Web 框架 | **Express 4** | RESTful API，路由按业务域拆分 |
| 数据库 | **SQLite + Prisma ORM** | 零配置零成本，文件即数据库；换 PostgreSQL 只需改一行 datasource |
| 缓存 | **自研 `server/src/utils/cache.js`** | TTL + 标签失效 + 并发去重 + LRU + 命中率可观测 |
| 分页 | **自研 `server/src/utils/pagination.js`** | 向前兼容的可选分页，`skip/take + count` |
| 鉴权 | **JWT**（`jsonwebtoken`）+ **bcryptjs** | 中间件统一校验，401 语义清晰 |
| 验证码 | **`crypto.randomInt`（CSPRNG）** | 替换原 `Math.random()` |
| 跨域 | cors | 允许通过环境变量限制来源 |
| 文件上传 | multer | 本地磁盘存储 + 静态托管 |
| 环境配置 | dotenv | 密钥只从环境读取，源码零密钥 |

### AI / 交互层

| 层次 | 技术选型 | 说明 |
|---|---|---|
| Agent 编排 | **自研 `agent/`** | Planner（两阶段规划）+ Executor（串行执行）+ Fallback（降级）+ Trace（可观测）+ Memory |
| 意图适配 | rule-adapter（默认）/ llm-adapter（可选） | 契约一致、可互换；LLM 适配器仅用于意图分类 |
| 工具注册 | `agent/tools/` ×4 | `user-stats` / `server-time` / `echo` / `avatar-speak` |
| 数字人渲染 | **自研 Canvas 2D** | 纯 Canvas 绘制，无二进制模型、无 Live2D、无渲染服务 |
| 口型同步 | **自研 LipSyncBridge** | 文本 → 口型序列，线性插值采样 |
| 语音合成 | tts-adapter（noop 默认） | 接口已定义，填入实现即可发声 |

---

## 项目结构

```
源代码/
├── pages/                    # 21 个业务页面（uni-app）
│   ├── index/                #   首页 · 封面
│   ├── home/                 #   村庄探索（地图 + 降级列表）
│   ├── food/                 #   美食详情
│   ├── shop/                 #   商城 + 积分兑换
│   ├── choosedaka/           #   打卡（答题/定位/拍照/制作）
│   ├── explore/              #   探索
│   ├── gallery/              #   食光相册
│   ├── journal/              #   旅途手账
│   ├── achievements/         #   村落勋章
│   ├── userinfo/             #   个人中心 + 子页
│   ├── agent-demo/           #   Agent 编排演示
│   ├── avatar-demo/          #   数字人演示
│   └── login/                #   登录
├── components/               # 6 个自研组件
│   ├── nav-bar/              #   自研返回栏
│   ├── custom-tab-bar/       #   自定义 TabBar
│   ├── ai-chat-mask/         #   AI 对话浮层
│   ├── daily-signin/         #   每日签到
│   ├── Checklist.vue         #   清单
│   └── ProgressBar.vue       #   进度条
├── utils/                    # 前端核心层
│   ├── request.js            #   网络层（Promise + JWT + 401）
│   ├── auth.js               #   API 封装 + 归一化包装
│   ├── normalizer.js         #   协议适配层
│   ├── router-guard.js       #   登录守卫
│   ├── list-loader.js        #   长列表增量加载 mixin
│   ├── map-capability.js     #   地图能力探测与降级
│   ├── session.js            #   会话管理
│   └── url.js                #   相对 URL → 绝对 URL
├── agent/                    # 自研 Agent 编排层
│   ├── core/                 #   planner / executor / fallback / memory / trace
│   ├── adapters/             #   rule-adapter / llm-adapter
│   └── tools/                #   工具注册表（4 个工具）
├── digital-avatar/           # 自研数字人交互层
│   ├── renderer/             #   Canvas 2D 渲染器
│   ├── bridge/               #   LipSync 口型桥接
│   ├── controller/           #   AvatarController（打断语义）
│   └── adapters/             #   tts-adapter
├── server/                   # Express 后端
│   ├── src/
│   │   ├── routes/           #   auth / user / business / agent
│   │   ├── services/         #   agent 编排 / food-review 品鉴引擎
│   │   ├── utils/            #   security / cache / pagination
│   │   ├── middleware/       #   JWT 鉴权
│   │   ├── db.js             #   Prisma 单例
│   │   ├── config.js         #   环境配置（密钥只从环境读）
│   │   ├── app.js            #   Express 装配
│   │   └── server.js         #   启动入口
│   ├── prisma/schema.prisma  #   数据模型
│   ├── scripts/seed.js       #   种子数据导入（幂等）
│   └── tests/                #   后端测试
├── docs/                     # 架构 / 上线手册 / 敏捷过程 / 审计报告
├── scripts/                  # 静态检查与迁移脚本
└── .github/workflows/        # CI（推送 tag 自动构建 APK）
```

### 数据模型

| 表 | 用途 |
|---|---|
| `users` | 用户（手机号登录、积分、评分、签到状态） |
| `verify_codes` | 验证码（含 attempts / 频控 / 过期字段） |
| `villages` | 村庄基础数据（缓存） |
| `foods` | 美食基础数据（缓存） |
| `shop_goods` | 商城商品（缓存） |
| `quiz_questions` | 题库（缓存） |
| `check_in_places` | 用户打卡记录（分页） |
| `user_photos` | 用户照片（分页） |
| `user_orders` | 兑换订单（分页） |
| `chat_history` | Agent 会话历史 |

---

## 快速开始

### 环境要求

| 依赖 | 版本 | 用途 |
|---|---|---|
| Node.js | ≥ 18 | 运行后端服务 |
| HBuilderX | ≥ 3.8.5 | 运行与打包 uni-app 前端 |
| npm | ≥ 9 | 依赖管理 |

> **不需要**任何云账号、数据库实例、Redis、消息队列或 API Key。

### 第 1 步 · 启动后端

```bash
cd server
npm install
npx prisma db push
node scripts/seed.js
npm run dev
```

启动成功会看到：

```
  ╭─────────────────────────────────────────────╮
  │  舌尖上的村落 · 后端服务已启动              │
  ╰─────────────────────────────────────────────╯

  地址      http://localhost:3000
  健康检查  http://localhost:3000/api/health
  开发模式  开启（send-code 返回 devCode）
```

验证后端是否就绪：

```bash
curl http://localhost:3000/api/health
```

```json
{
  "code": 200,
  "message": "服务运行中",
  "uptime": 12.3,
  "devMode": true,
  "cache": { "hits": 0, "misses": 0, "hitRate": 0, "entries": 0 }
}
```

### 第 2 步 · 运行前端

1. 用 **HBuilderX** 打开仓库根目录
2. 菜单 **运行 → 运行到浏览器**（H5）或 **运行到小程序模拟器 → 微信开发者工具**
3. 首次运行需在 `manifest.json` 中填入自己的微信小程序 AppID

> ⚠️ **真机调试必看**：`utils/request.js` 中的 `BASE_URL` 默认是 `http://localhost:3000`。在手机上 `localhost` 指向手机自身，必须改为电脑的局域网 IP，例如 `http://192.168.1.100:3000`。H5 端还需注意浏览器 Geolocation 的 HTTPS 要求。

### 第 3 步 · 登录

开发模式下（`server/.env` 中 `DEV_MODE=true`），`POST /api/auth/send-code` 会在响应里直接返回 `devCode`，无需真实短信即可完成登录流程。

```bash
# 1. 获取验证码（响应中带 devCode）
curl -X POST http://localhost:3000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"mobile":"13800138000"}'

# 2. 用验证码登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mobile":"13800138000","code":"123456"}'
```

> **生产部署前务必将 `server/.env` 的 `DEV_MODE` 改为 `false`**，否则验证码会直接出现在接口响应里。

---

## 常用命令

```bash
# ===== 后端 =====
cd server
npm run dev          # 启动开发服务
npm test             # 全部后端测试（自动拉起服务：19 项单测 + 61 项接口测试）
npm run test:api     # 仅接口与安全测试（要求服务已启动）
npm run test:unit    # 仅缓存与分页单元测试（无需数据库）
npm run db:push      # 同步数据库 schema
npm run db:studio    # 打开 Prisma Studio 可视化查看数据

# ===== 前端 =====
npm test                 # 静态检查（JSON 语法 / 残留引用 / Vue 语法 / 模板标签 / 页面注册）
npm run test:agent       # Agent 编排层单测（53 项）
npm run test:avatar      # 数字人交互层单测（15 项）
npm run test:normalizer  # 协议适配层单测（23 项）
npm run test:list        # 长列表 mixin 单测（13 项）
npm run test:contract    # API 契约测试（16 项，需后端已启动）
npm run test:all         # 以上全部
```

---

## 配置

所有配置通过 `server/.env` 读取（**源码中不含任何真实凭据**）。完整模板见 `server/.env.example`。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 服务端口 |
| `DATABASE_URL` | `file:./dev.db` | SQLite 路径 |
| `JWT_SECRET` | 占位符 | **生产必须替换**，否则 JWT 可被伪造 |
| `JWT_EXPIRES_IN` | `604800` | Token 有效期（秒，默认 7 天） |
| `DEV_MODE` | `false` | **生产必须为 `false`**，否则验证码出现在响应里 |
| `CORS_ORIGIN` | `*` | 允许的跨域来源（逗号分隔） |
| `UPLOAD_DIR` | `uploads` | 上传目录 |
| `DEEPSEEK_ENABLED` | `false` | 置 `true` 并填入 Key 即启用真实 LLM |
| `DEEPSEEK_API_KEY` | 占位符 | DeepSeek API Key |
| `XFYUN_ENABLED` | `false` | 讯飞 TTS 开关（需补齐服务端实现） |
| `XFYUN_APP_ID` / `XFYUN_API_SECRET` / `XFYUN_API_KEY` | 占位符 | 讯飞凭据 |

> **零配置可跑是本项目的硬指标**：默认路径不产生任何外部 API 调用与费用。

---

## API 文档

### 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/send-code` | 发送验证码（60s 频控 / 单日 10 次） |
| POST | `/api/auth/login` | 验证码登录 / 自动注册 |
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/logout` | 登出 |

### 用户

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/user/profile` | 用户资料（需鉴权） |
| PUT | `/api/user/profile` | 更新资料（服务端字段不可篡改） |
| GET | `/api/user/session` | 会话健康检查（剩余有效期 / 是否即将过期） |

### 业务（聚合路由）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/api/business/:name` | 21 个业务接口，按 `name` 分发 |
| POST | `/api/business/upload` | 文件上传（本地磁盘） |

**读接口**：`get_villages_list` · `get_village_info` · `get_food_info` · `get_shop_goods` · `get_quiz_questions` · `get_user_orders` · `getCheckInRecords` · `getUserCheckedSpots` · `getUserPhotos`

**写接口**：`checkIn` · `dailySignIn` · `quizCheckIn` · `gameCheckIn` · `saveUserPhotos` · `deleteUserPhoto` · `updateUserPhoto` · `purchaseItem` · `userInit` · `analyzeFoodPhoto`

**分页用法**（用户态列表）：

```bash
# 不传参 → 返回全量（向后兼容）
GET /api/business/getUserPhotos

# 传参 → 分页切片 + 元信息
GET /api/business/getUserPhotos?page=1&pageSize=20
```

```json
{
  "code": 200,
  "data": [ /* ... */ ],
  "page": { "page": 1, "pageSize": 20, "total": 137, "hasMore": true }
}
```

### Agent

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/agent/chat` | 对话（知识库 → 编排 → 可选 LLM → 降级） |
| POST | `/api/agent/run` | 仅执行编排（调试用） |
| GET | `/api/agent/history` | 会话历史 |
| DELETE | `/api/agent/history` | 清空历史 |

---

## 测试

项目把**测试与静态检查当作交付的一部分**，而不是事后补的。

| 套件 | 数量 | 覆盖内容 |
|---|---|---|
| 后端接口与安全测试 | **61** | 验证码安全、JWT 鉴权、Agent 编排、业务接口、缓存、分页 |
| 缓存与分页单元测试 | **19** | TTL 过期、标签失效、并发去重、LRU 淘汰、分页边界 |
| Agent 编排层单测 | **53** | 意图分类、多工具串行、未知意图降级、参数校验失败 |
| 数字人交互层单测 | **15** | 口型序列、插值边界、打断语义、渲染降级 |
| 协议适配层单测 | **23** | 各业务数据的字段形状还原 |
| API 契约测试 | **16** | 前后端数据形状一致性 |
| 长列表 mixin 单测 | **13** | 首页覆盖、后续追加、并发保护、命名空间隔离 |
| 静态检查 | 4 类 | JSON 语法、前端残留引用、Vue 脚本语法、模板标签闭合、页面注册一致性 |

### 四道静态防线

| 检查器 | 拦截的问题 | 触发背景 |
|---|---|---|
| `scripts/check-frontend-refs.js` | 前端残留 `uniCloud` 调用 / `store.userInfo` | Sprint 5 批量替换后遗漏引用点，导致页面白屏 |
| `scripts/check-vue-syntax.js` | `.vue` 脚本块语法错误 | 批量编辑引入的语法破损 |
| `scripts/check-template-tags.js` | 模板标签未闭合、根元素不唯一、属性区截断 | Sprint 5.2 编辑操作截断了 `location.vue` 的模板 |
| `scripts/check-json.js` | JSON 语法错误 | 配置文件的批量修改 |

---

## 开发流程

项目采用 **Sprint 0 → 5 的敏捷迭代**，每个 Sprint 都有可运行增量，git 历史完整呈现迭代过程。

| Sprint | 主题 | 关键产出 | 提交 |
|---|---|---|---|
| **Sprint 0** | 技术债清理 | 隐私数据替换、密钥收敛至 `.env`、死代码删除、仓库工程化 | `6951dc2` |
| **Sprint 1** | 登录增强 | 验证码四项安全修复（CSPRNG / 频控 / 错误锁定 / 严格校验）、会话体检 | `1011b24` |
| **Sprint 2** | Agent 编排层 | `agent/` 完整目录（planner / executor / memory / fallback / trace / 工具注册表 / 双适配器）；53 项单测 | `d51eaa0` |
| **Sprint 3** | 数字人交互层 | `digital-avatar/` 完整目录；15 项单测；`avatar-speak` 打通 Agent 联动 | `e00d7a6` |
| **Sprint 4** | 打包与文档 | APK 配置、GitHub Actions、README、上线手册 | `22532d7` |
| **Sprint 5** | 脱离 uniCloud | `server/` 独立后端工程；44 处调用全部替换；协议适配层；静态扫描器 | `571722a` |
| **Sprint 5.1** | 重构断裂修复 | 12 类运行时断裂修复 + 归一化层 + 残留引用扫描器 | `f118b5b` |
| **Sprint 5.2** | 原生能力与 UI | 地图 / 定位 / 拍照 / 上传 / 返回栏等 12 类前端问题修复 | `e1d5401` |
| **Sprint 5.3** | 模板防线 | 修复模板截断 + 新增模板标签检查器 | `ea2f736` |
| **Sprint 5.4** | 性能优化 | 自研缓存层、长列表分页、前端增量渲染 mixin | 本次提交 |

### 迭代方法上的两点体会

1. **每个 Sprint 结束都跑一次全量测试，且测试必须能失败。** Sprint 2 之前，测试框架存在「0 项却全绿」的假绿问题 —— 断言没被加载也算通过。修复方式不是改断言，而是先注入一个错误验证测试真的会红。`check-template-tags.js` 也是同样的验证思路。
2. **静态检查器是被事故逼出来的，不是预防性写的。** `check-frontend-refs.js` 存在的原因，是 Sprint 5 用脚本批量替换 44 处调用时，脚本改不了「引用点」与「后端返回形状」，留下了 `store.userInfo` 残留（页面白屏）与数据形状断层（字段全 `undefined`）。这类问题编译器发现不了，只能靠针对性的扫描器守住。

---

## 部署

> 完整可执行版本见 [`docs/上线手册.md`](./docs/上线手册.md)（含每步的具体命令与注意事项）。

### 阶段 1 · 代码冻结

```bash
npm run test:all        # 前端全量测试
cd server && npm test   # 后端全量测试
git tag -a v1.0.0 -m "release v1.0.0"
```

### 阶段 2 · 后端部署

```bash
# 1. 生成强随机 JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. 配置 server/.env
#    JWT_SECRET=<上一步生成的值>
#    DEV_MODE=false
#    CORS_ORIGIN=https://your-domain.com

# 3. 安装并启动（建议用 pm2 / systemd 守护）
cd server && npm ci --omit=dev && npm run db:push && node scripts/seed.js && npm start
```

### 阶段 3 · 数据库迁移

SQLite → PostgreSQL 只需修改 `server/prisma/schema.prisma` 的一行 datasource：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 阶段 4 · 前端发布

用 HBuilderX 发行到对应平台；小程序需在微信公众平台配置合法 request 域名。

### 构建 APK

`.github/workflows/build-apk.yml` 已配置完成：推送形如 `v1.0.0` 的 tag 会自动触发构建。

```bash
# 递增版本号（manifest.json 的 versionName / versionCode）
# 然后打 tag 触发 CI
git tag -a v1.0.0 -m "release v1.0.0"
git push origin v1.0.0
```

> ⚠️ **该流水线未在真实环境跑通**（无 DCloud 账号与打包凭据），YAML 结构与触发条件正确，但**不产出实际可安装的 APK**。详见 [已知问题与限制](#已知问题与限制)。

---

## 已知问题与限制

### 未实际验证的操作

| # | 项目 | 状态 | 说明 |
|---|---|---|---|
| 1 | **APK 未实际打包** | ⬜ 未执行 | 无 DCloud 账号与打包凭据，且本地无 HBuilderX CLI。`build-apk.yml` 结构正确、YAML 校验通过，但未在真实环境跑通，不产出 APK |
| 2 | **真机安装未验证** | ⬜ 未执行 | 无 Android 真机环境。「Android 10+ 安装不闪退」是待验证项，不是已验证结论 |
| 3 | **真实短信未发送** | ⬜ 未执行 | 短信服务商未接入。`send-code` 的完整逻辑经 61 项后端测试验证（含频控、锁定），但真实短信链路未跑通 |
| 4 | **前端未在 HBuilderX 中实际运行** | ⬜ 未执行 | 44 处 API 调用已全部替换并通过静态语法校验，但未在 HBuilderX 模拟器 / 真机中点过一遍。真机调试还需把 `BASE_URL` 改为局域网 IP |
| 5 | **Canvas 渲染未在真机 / 模拟器验证** | ⬜ 未执行 | 渲染逻辑有单元测试覆盖（参数裁剪、表情切换、无 ctx 不抛异常），但实际画面效果需在 HBuilderX 中运行确认 |

### 设计上的已知限制

| # | 项目 | 影响 | 计划 |
|---|---|---|---|
| 6 | **口型映射是近似的** | 不是音素级对齐。刻意不引入拼音库（会增数百 KB 依赖），用字符类别近似替代 | 见 [路线图](#路线图) |
| 7 | **`analyzeAudio` 接口未实现** | 音频驱动的口型同步不可用。需 Web Audio AnalyserNode，且 App 端与 H5 端 API 不一致 | 见 [路线图](#路线图) |
| 8 | **`chat_history` 是覆盖写** | 每用户只存最后一条，不是真正的历史记录 | 见 [路线图](#路线图) |
| 9 | **TTS 默认 noop** | 数字人默认不出声，只有口型动画。启用需配置讯飞并补齐服务端 `/api/tts` | 见 [路线图](#路线图) |
| 10 | **Agent 默认规则适配器** | 意图识别基于关键词加权，换一种问法可能识别不到 | 见 [路线图](#路线图)（LLM 适配器） |
| 11 | **业务数据接口按 name 聚合** | `/api/business/:name` 而非每域一个路由文件。优点是前端改动最小、协议替换纯粹；缺点是单文件较长 | 刻意选择 |
| 12 | **数字人形象为简笔风格** | 目标是链路自研可讲，不追求视觉精美 | — |
| 13 | **图片识别降级为本地规则** | 未接百度 AI 时只返回本地模拟的评分与点评 | 见 [路线图](#路线图) |
| 14 | **SQLite 单机存储** | 不适合多实例部署与高并发。生产环境建议换 PostgreSQL（Prisma 改一行 datasource 即可迁移） | 见 [路线图](#路线图) |
| 15 | **文件上传存本地磁盘** | 多实例部署时图片不共享。生产建议换对象存储 | 见 [路线图](#路线图) |
| 16 | **Android 存储权限用 READ/WRITE_EXTERNAL_STORAGE** | Android 13+ 已废弃该模式，需迁移到 `READ_MEDIA_IMAGES` | 打包上架前处理 |
| 17 | **缓存为进程内实现** | 多实例部署时各实例缓存独立，静态数据更新需等 TTL 到期（最长 5 分钟）才在所有实例生效 | 换 Redis 可解 |
| 18 | **静态图片仍走 COS 公网地址** | 49 个图片资源（约 38 MB）仍引用原 CDN 地址。本仓库脱敏时未内置这些素材 —— 体积过大，且属合作企业素材 | 图片不可用时改为本地 `static/` 资源 |

### 环境相关的注意事项

| # | 项目 | 说明 |
|---|---|---|
| 19 | `server/.env` 的 `JWT_SECRET` 现为占位符 | **部署前必须替换**，否则 JWT 可被伪造 |
| 20 | `server/.env` 的 `DEV_MODE` 现为 true | **生产必须改为 false**，否则验证码直接出现在接口响应里 |
| 21 | 真机调试需改 `BASE_URL` | `http://localhost:3000` 在手机上指向手机自身，需改为电脑局域网 IP |
| 22 | 旧 uniCloud 资源仍在云端 | 若之前关联过阿里云空间，那些云函数仍存在，但本项目已不再使用，可自行在控制台清理 |

---

## 路线图

| 方向 | 说明 |
|---|---|
| LLM 适配器完整落地 | 契约已定义（`agent/adapters/llm-adapter.js`），填入 API Key 即可启用 |
| 数字人 TTS 本地化 | `analyzeAudio` 实现 + 拼音库提升口型精度 |
| SQLite → PostgreSQL | Prisma 改一行 datasource |
| 进程内缓存 → Redis | 替换 `cache.js` 的 `get/set/del` 即可，调用方零改动 |
| 文件上传 → 对象存储 | 解决多实例部署的图片共享问题 |
| 聊天历史持久化 | `chat_history` 从覆盖写改为追加式存储 |
| 应用商店上架材料 | 需补齐软著、备案号等 |

---

## 许可证

[MIT](./LICENSE) © 2026 CharLene

---

## 贡献

欢迎 Issue 与 PR。提交前请确保：

```bash
npm test                 # 前端静态检查
cd server && npm test    # 后端全量测试
```

**请勿提交**：任何真实密钥、真实用户数据、`.env` 文件。这些已被 `.gitignore` 覆盖，但提交前请再确认一次。

---

<div align="center">

**舌尖上的村落** · Taste of the Village
<sub>校企合作项目 · 2025.07 – 2026.09 · 架构与工程能力展示</sub>

</div>
