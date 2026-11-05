# 舌尖上的村落 · Taste of the Village

> **基于 uni-app 与 Node.js 的全栈乡村文旅应用**
> 一套代码编译到微信小程序 / H5 / Android App；前端 uni-app (Vue 2)，后端 Express + Prisma + SQLite。
> **零付费云依赖，clone 即可完整跑通。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A518.0-green.svg)](https://nodejs.org/)
[![Vue](https://img.shields.io/badge/Vue-2.7-42b883.svg)](https://v2.vuejs.org/)
[![Tests](https://img.shields.io/badge/tests-200%20passed-success.svg)](#testing--quality-assurance)

---

## ⚠️ 重要声明（开源版本说明）

**请在评估本项目之前先阅读本节。**

本项目源于 **2025 年 7 月 – 2026 年 9 月**的 **华师 × 三七互娱 校企合作项目**。
由于赛事结束后合作企业对版权的要求，以及团队后续没有经费维护，
**当前开源版本已经过大幅度脱敏与重构**，与参赛 / 商业版本存在实质差异：

| 能力 | 参赛 / 商业版本 | 本开源版本 | 说明 |
|---|---|---|---|
| 大语言模型 | DeepSeek LLM 真实调用 | **本地规则引擎**（Agent 编排层保留完整） | Agent 架构完整，仅模型调用被替换为规则适配器 |
| 图像识别 | 百度智能云图像识别 | **本地确定性哈希品鉴引擎** | 按文件名 / 大小生成稳定的评分与点评 |
| 语音合成 | 讯飞 TTS 真实调用 | **TTS 适配器接口 + noop 默认实现** | 口型动画链路完整，音频输出默认静音 |
| 对象存储 | 腾讯云 COS | **本地文件系统**（`server/uploads/`） | 上传、静态托管、绝对 URL 拼接均已自研实现 |

**因此，本开源版本的功能完整度低于参赛版本，仅作技术架构与工程能力的展示。**

### 但架构是完整且可扩展的

这不是一个「为了开源而重写的玩具项目」，而是一套**保留了完整扩展点**的架构：

- **Agent 适配器契约已定义**（`classify` / `plan` 两个方法）——
  规则适配器与 LLM 适配器可互换，编排层不关心底层是规则还是模型。
  在 `server/.env` 填入 `DEEPSEEK_ENABLED=true` 与 `DEEPSEEK_API_KEY`，
  服务端 `isServiceEnabled('deepseek')` 判定通过后**立即走真实 LLM 分支**，无需改动业务代码。
- **TTS 适配器接口已定义**（`speak` / `stop`）——
  默认 noop 实现只做口型不发声；传入自定义适配器即可接入任意 TTS 服务。
- **业务逻辑与外部服务解耦** —— 品鉴、存储、语音均以服务层接口隔离，
  替换实现不需要触碰路由层与前端。

> 一句话概括：**填入商业 API Key 即可恢复完整功能，架构无需重构。**
> 需要如实说明的是，讯飞 TTS 目前还缺服务端 `/api/tts` 的实现，
> 补齐这一层即可让数字人开口说话；百度识图同理 —— 本地引擎已就位，替换为真实调用即可。

### 关于图片资源

静态图片（49 个文件，约 38 MB）仍引用原合作企业的 COS 公网地址。
本仓库**未内置**这些素材 —— 一是体积过大，二是它们属于合作企业版权内容。
若该地址失效，可将 `static/` 目录替换为本地资源（路径规则保持一致）。

---

## 项目背景与荣誉

### 项目背景

**「舌尖上的村落」** 是 **华南师范大学 × 三七互娱** 的校企合作项目，
面向乡村文旅场景，构建集「村庄探索 — 美食打卡 — 积分兑换 — AI 导览」于一体的
一站式移动应用。项目于 **2025 年 7 月启动**，**2026 年 9 月**完成开发与交付。

项目本身是一个完整的商业级应用需求。团队在开发过程中发现并重构了三处
「表面可用、底层机制缺失」的实现 —— 这部分重构工作构成了本仓库最有价值的技术内容
（详见 [Technical Highlights](#technical-highlights)）：

1. **登录态不可靠** —— 验证码用 `Math.random()` 生成（可预测）、无发送频控、无错误次数限制
2. **「AI 功能」名不副实** —— 原 AI 模块本质是「知识库检索 + 单轮问答」，无工具调用、无规划、无降级链
3. **数字人只是两张 GIF** —— 口型是开 / 关两态而非参数化开合，无队列、无打断语义

### 团队与荣誉

担任 **5 人团队负责人**，负责整体架构设计、技术选型、任务拆分与代码评审。

| 荣誉 | 说明 |
|---|---|
| **全国易班技术创新大赛 二等奖** | 国家级赛事获奖 |
| **软件著作权登记证书** | 本项目相关软件著作权登记 |
| 其他 2 项校级 / 团队荣誉 | 详见下方说明 |

> **荣誉说明**：除上表明确列出的两项外，另两项荣誉的具体名称与颁发单位以校方公示为准。
> 本节刻意不做模糊化表述，也**不虚构**未获确认的奖项名称。

---

## Technical Highlights

> 每个亮点用「问题 — 机制 — 结果」三段式展开 —— 这是我在项目中学到的最重要的一件事：
> **能讲清楚「为什么这么做」比「做了什么」更有价值。**

### 亮点 1 · 主导前后端分离架构，设计并打通 RESTful API

**问题**
项目原始后端基于 uniCloud（BaaS）。随着阿里云免费空间停止申请，
原有云函数、云数据库、官方 `uni-id` 模块全部无法继续使用。
如果重写整个后端，回归风险极高；但如果直接把业务代码搬进 Express，
工作量同样巨大且容易出错。

**机制**
采用**聚合路由 + 协议适配**的迁移策略，而非推倒重来：

```
前端页面  ──►  utils/request.js（Promise 化 + 自动 JWT + 401 拦截）
                    │
                    ▼
          GET/POST /api/business/:name        ← 21 个业务接口
          POST      /api/auth/send-code|login|register|logout
          GET/PUT   /api/user/profile|session
          POST      /api/agent/chat|run       ← Agent 编排
                    │
                    ▼
          utils/normalizer.js（协议适配层）
          Prisma 原始行  ──►  原云函数数据形状
```

关键决策有两个：

1. **聚合路由** —— 把 21 个云函数收敛进 `/api/business/:name`，
   让「彻底切断 uniCloud」变成**纯粹的协议替换**，前端业务逻辑与数据结构完全不动
2. **协议适配层**（`utils/normalizer.js`）—— 后端返回 Prisma 原始行，
   前端归一化器负责还原成旧云函数的字段形状。
   没有这一层，前端会因字段名断层（如 `story_paragraphs` 缺失）而整页空白

**结果**
- **21 个业务接口 + 6 个用户 / 认证接口 + 4 个 Agent 接口**全部跑通
- 44 处 `uniCloud.callFunction` 调用零残留，由静态扫描器
  （`scripts/check-frontend-refs.js`）持续守护，零误报
- 前后端彻底解耦：后端可独立部署、独立测试（61 项接口测试），
  前端可独立 mock

---

### 亮点 2 · 引入数据缓存机制，优化长列表渲染以降低网络延迟

**问题**
迁移到 Express + SQLite 后，暴露了两个真实的性能问题：

1. **基础数据重复查库** —— 村庄 / 美食 / 商品 / 题库是种子导入的**读多写极少**数据，
   却每次请求都打一次 SQLite。弱网环境下这直接转化为首屏延迟。
2. **用户态列表无界增长** —— 相册、订单随使用时长无限膨胀。
   早期实现一次性拉全量：响应体随数据量线性膨胀，
   一次性创建大量 DOM 节点，首屏渲染卡顿、真机内存飙升。

**机制**
自研两层优化，均为**纯进程内实现，零外部依赖**
（不引入 Redis —— 那会破坏「clone 即可跑通、零运维」的硬指标）：

**① 数据缓存层**（`server/src/utils/cache.js`）

| 能力 | 实现要点 |
|---|---|
| TTL 自动过期 | 静态数据默认 5 分钟，避免脏数据长期驻留 |
| 标签失效 | 写操作只失效受影响的标签，而非清空整个缓存 |
| 并发去重 | 同一 key 的并发请求**只真正执行一次** loader，防止缓存击穿 |
| LRU 上限 | 条目数超限淘汰最旧项，防止内存无界增长 |
| 可观测 | `/api/health` 暴露命中数 / 未命中数 / 命中率 / 条目数 |

关键设计是**窄接口**（`get / set / del / wrap`）：
未来换 Redis 时只需替换这四个方法的实现，调用方零改动。

缓存范围经过**刻意取舍**：静态基础数据进缓存；**用户态数据不进缓存** ——
它们随用户操作频繁变化，缓存收益低于失效风险，改用分页收敛负载。

**② 长列表分页**（`server/src/utils/pagination.js`）

- 未传 `page` / `pageSize` 时**返回全量**，与优化前行为完全一致 → **向前兼容**
- 传入后走 Prisma `skip` / `take` + `count()`，单次负载从 O(n) 收敛为 O(pageSize)
- `pageSize` 上限 100，防御恶意参数
- 响应体 `data` 字段**仍是数组**，分页元信息单独放在 `page` 字段
  → **旧前端代码零改动即可继续工作**

**③ 前端增量渲染**（`utils/list-loader.js`）

封装为 Vue mixin，方法名按 `listKey` 生成命名空间
（`loadPhotosListPage` / `loadMorePhotosList` / `reloadPhotosList`），
因此同一组件可混入多个实例而互不覆盖：

- **触底加载** —— `onReachBottom` 触发下一页追加
- **并发保护** —— 加载中重复调用直接忽略，杜绝重复请求
- **DOM 节点数与已浏览深度成正比**，而非与总数据量成正比

**结果**
- 缓存与分页单元测试 **19 项全绿**；后端接口测试新增 **11 项**；前端 mixin 测试 **13 项全绿**
- 分页切片**不重不漏**（断言两页拼接后 id 集合无重复且覆盖前两条）
- 相册页首屏只渲染 12 张，滚动时追加
- 缓存命中率通过 `/api/health` 实时可观测，不靠「感觉变快了」

> 这条亮点的价值在于**用可解释的机制解决可测量的问题**，
> 而不是引入一个需要额外部署的中间件。

---

### 亮点 3 · 依托 uni-app 解决复杂跨端环境下的适配问题

**问题**
同一个应用要同时跑在**微信小程序、H5、Android App** 三种运行环境上，
而三者在 API 能力上差异巨大：

| 差异点 | 微信小程序 | H5 | App |
|---|---|---|---|
| 地图组件 | 需 Key、需授权 | 需 Key、需授权 | 需 Key |
| 定位 API | `uni.getLocation` | 浏览器 Geolocation（需 HTTPS） | 原生定位 |
| Canvas 渲染 | `createCanvasContext` 需**显式 `draw()`** | 原生 Canvas 2D | 原生 Canvas 2D |
| 本地存储 | `uni.setStorageSync` | localStorage | 原生存储 |
| 文件上传 | `uni.uploadFile` | `FormData` | `uni.uploadFile` |

任何一个能力在某个端缺失，都会表现为「**在手机上好好的，一到浏览器就白屏**」。

**机制**
统一用 `uni.*` API 抽象差异，并对**能力缺失**做显式降级而非静默失败：

- **地图降级**（`utils/map-capability.js`）—— 无地图 Key 时自动切换为村庄列表视图，
  而不是让地图区域变成一块空白
- **Canvas 双模式**（`digital-avatar/renderer/canvas-avatar.js`）——
  同一套绘制代码兼容 `createCanvasContext`（小程序）与原生 Canvas 2D（Web / App），
  通过 `autoDraw` 开关决定是否显式 `draw()`
- **统一网络层**（`utils/request.js`）—— 三端一致的 Promise 化请求、
  自动携带 JWT、401 自动清理凭证并跳转登录
- **API 能力探测** —— TTS / 图像识别等能力在 `isServiceEnabled()` 判定下走本地降级路径

**结果**
- **21 个业务页面**、**6 个自研组件**，一套代码覆盖三端
- 8 个 DCloud 官方 `uni_modules` 保持**只读**（不改不署名）
- 跨端差异收敛在 `utils/` 与 `digital-avatar/` 两处，页面层不含平台判断分支

---

### 亮点 4 · 自研轻量级 Agent 编排层（Planner + Executor + Tools）

**问题**
规则驱动的 Agent 在未知输入下最容易犯的错，是**硬猜一个工具并返回看似合理的结果**。
用户问「今天天气怎么样」，Agent 却不动声色地返回了服务器时间 —— 答非所问，却没有任何错误提示。
这类「沉默的错误」比直接报错更难排查。

**机制**
自研 `agent/` 编排层，核心是**两阶段规划 + 可预期的降级**：

```
输入 → [Planner] 意图分类 → 工具序列规划 → [Executor] 串行执行 → 答案聚合
              ↓ 置信度 < 0.3
         [Fallback] 返回实时能力清单（不猜、不编造）
```

1. **阶段一 · 意图分类** —— 关键词加权打分，命中累加 + 覆盖率加成，
   归一化得到置信度 ∈ [0,1]
2. **阶段二 · 工具序列规划** —— 意图映射为工具调用序列，
   复合提问自动拆解为多工具并按置信度降序**串行**执行
3. **阈值机制** —— 置信度低于 **0.3** 时 planner 不产出任何工具序列，
   转而返回从工具注册表实时读取的**能力清单**，
   把「我不知道」变成「你可以这样问我」
4. **硬约束** —— 工具参数校验失败**返回结构化错误而非抛异常**；
   LLM 只用于意图分类，最终答案**永远由工具的真实返回值聚合**，
   即使模型判断错了意图，也不会凭空编造事实，trace 会如实记录这个错误

工具注册表含 4 个工具：`user-stats`（用户统计）、`server-time`（服务器时间）、
`echo`（回显）、`avatar-speak`（数字人口播 —— 把数字人封装成 Agent 工具）。

**结果**
- 单元测试 **53 项全绿**，覆盖 4 类规定场景：正常意图、多工具串行、未知意图降级、参数校验失败
- 未知意图 **100% 走降级路径**，不返回任何工具执行结果
  （断言：`type === 'fallback'` 且 `results.length === 0`）
- 每次调用产出 trace（输入 / 规划 / 每步耗时 / 输出），环形缓冲保留最近 20 条
- 排查「回答得不对」时，可直接定位是**意图识别错**、**参数错**、还是**工具抛异常**

---

### 亮点 5 · Canvas 2D 数字人交互层与 Agent 联动

**问题**
现成的数字人方案只负责**渲染**，不负责**调度**。
即便接入成熟方案，仍需回答三个问题：口型怎么算？播报怎么排队？用户打断怎么办？
这三件事没有现成答案，只能自己写 —— 而它们恰恰是数字人体验好坏的关键。

**机制**
自研 `digital-avatar/` 交互层，三个可独立测试的部件：

**① LipSyncBridge**（`bridge/lipsync.js`）—— 纯函数，不依赖音频
按 Unicode 码点切分文本，逐字符估算发音时长（汉字 200ms / 字母 120ms / 标点停顿），
映射为口型开合值 ∈ [0,1]，输出 `[{t, value}]` 序列。
播放时按时间轴**线性插值采样**，让口型过渡平滑而非阶跃跳动。

**② AvatarController**（`controller/avatar-controller.js`）—— 打断语义
`speak` / `stop` / `setExpression` 三方法，`requestAnimationFrame` 驱动播放循环。
覆盖式打断（新的 `speak` 打断旧的），`stop()` 立即取消 rAF 并复位口型。

**③ Agent 联动**（`agent/tools/avatar-speak.js`）
把数字人封装成 Agent 工具，executor 调用即触发口播。

**结果**
- 口型序列单元测试 **15 项全绿**：序列长度匹配、value 值域 [0,1]、t 单调递增、标点闭合、插值边界
- `stop()` 立即复位口型为 0 并取消 rAF（已断言）
- 连续 `speak()` 三次，**仅保留一条 rAF 链**，无双动画（已断言）
- Agent 执行 `avatar-speak` 工具后，数字人随即开口（已断言）
- **精度边界如实声明**：口型映射是近似的，不是音素级对齐。
  不做真实拼音转换是刻意的取舍 —— 完整拼音库会增加数百 KB 依赖，
  与「clone 即可运行、零外部依赖」的约束冲突

---

### 亮点 6 · 换后端不丢一项安全设计

**问题**
Sprint 5 要把后端从 uniCloud 换成自建 Express 服务。
这类「换后端」的重构最容易出的事故，是**顺手把安全机制一起丢掉**：
验证码能无限试、频控没了、token 不校验了 —— 功能都跑得通，但安全性悄悄退化了。
更隐蔽的是：官方 `uni-id` 的那些防护是**隐式**的，
开发者以为「用了 uni-id 就等于有防护」，实际上一旦自研登录，这些防护全部消失。

**机制**
把设计的四道安全闸**逐条翻译**到新后端，并写进契约测试：

| 安全设计 | uniCloud 时代 | Express 时代 | 落地位置 |
|---|---|---|---|
| ① 手机号严格校验 | uni-id 的 `mobile` schema（隐式） | **显式** `typeof === 'string'` + 正则 | `server/src/utils/security.js` |
| ② CSPRNG 验证码 | ❌ 用的是 `Math.random()`（不安全） | ✅ `crypto.randomInt` | 同上 |
| ③ 发送频控 | ❌ 无 | ✅ 60 秒 + 单日 10 次 | 同上（`verify_codes` 表字段） |
| ④ 错误次数锁定 | ❌ 无 | ✅ 5 次作废 | 同上（`attempts` 字段） |
| ⑤ Token 鉴权 | uni-id-co 的 `checkToken`（隐式） | **显式** JWT 中间件 | `server/src/middleware/auth.js` |
| ⑥ 会话健康检查 | 自研 `session-audit` 云函数 | 改为 `GET /api/user/session` | `server/src/routes/user.js` |

关键决策是**把隐式防护变成显式契约**：
每一项都有对应的断言与测试用例，而不是「框架应该会处理」。

**结果**
- 后端 **61 项接口与安全测试全绿**，逐条断言上述 6 项安全设计
- 7 种异常手机号入参（数组 / 数字 / null / undefined / 对象 / 布尔 / 格式错）
  全部返回结构化错误，**零未捕获异常**
- 60 秒内二次发送返回 **429 + `auth-sms-too-frequent` + `retryAfter`**
- 连错 5 次后**即使提交正确验证码也无法登录**（已实测）
- 不带 token / 伪造 token 一律 **401**
- 用户资料接口**无法篡改 `loginCount`** 等服务端维护的字段
- 前端请求层同步提供**兜底**：`utils/request.js` 拦截 401 后
  自动清除本地凭证并跳转登录页

> 这条亮点的价值不在于「做了安全功能」，而在于**证明重构没有引入安全退化** ——
> 而这正是架构迁移类工作中最容易被忽略、也最容易被面试官追问的部分。

---

## Tech Stack

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
| UI 组件 | DCloud 官方 uni_modules ×8 | `uni-forms` / `uni-easyinput` / `uni-popup` / `uni-icons` 等**纯 UI** 模块 |

### 后端

| 层次 | 技术选型 | 说明 |
|---|---|---|
| 运行时 | Node.js ≥ 18 | 零外部服务依赖 |
| Web 框架 | **Express 4** | RESTful API，路由按业务域拆分 |
| 数据库 | **SQLite + Prisma ORM** | 零配置零成本，文件即数据库；换 PostgreSQL 只需改一行 datasource |
| 缓存 | **自研 `server/src/utils/cache.js`** | TTL + 标签失效 + 并发去重 + LRU + 命中率可观测 |
| 分页 | **自研 `server/src/utils/pagination.js`** | 向前兼容的可选分页，`skip/take + count` |
| 鉴权 | **JWT**（`jsonwebtoken`）+ **bcryptjs** | 中间件统一校验，401 语义清晰 |
| 密码哈希 | bcryptjs | 用户密码不可逆存储 |
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

## Getting Started

### 环境要求

| 依赖 | 版本 | 用途 |
|---|---|---|
| Node.js | ≥ 18 | 运行后端服务 |
| HBuilderX | ≥ 3.8.5 | 运行与打包 uni-app 前端 |
| npm | ≥ 9 | 依赖管理 |

> **不需要**任何云账号、数据库实例、Redis、消息队列或 API Key。

---

### 第 1 步 · 启动后端

```bash
# 1. 进入后端目录
cd server

# 2. 安装依赖
npm install

# 3. 初始化 SQLite 数据库（生成 server/prisma/dev.db）
npx prisma db push

# 4. 导入种子数据（5 村庄 / 5 美食 / 7 商品 / 20 题，幂等）
node scripts/seed.js

# 5. 启动服务（默认 3000 端口）
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

**验证后端是否就绪**：

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

> `cache` 字段是缓存层的实时统计，可用于观察命中率随请求增长的变化。

---

### 第 2 步 · 运行前端

1. 用 **HBuilderX** 打开仓库根目录
2. 菜单 **运行 → 运行到浏览器**（H5）或 **运行到小程序模拟器 → 微信开发者工具**
3. 首次运行需在 `manifest.json` 中填入自己的微信小程序 AppID

> ⚠️ **真机调试必看**：`utils/request.js` 中的 `BASE_URL` 默认是
> `http://localhost:3000`。在手机上 `localhost` 指向**手机自身**，
> 必须改为电脑的局域网 IP，例如 `http://192.168.1.100:3000`。
>
> H5 端还需注意浏览器 Geolocation 的 HTTPS 要求。

---

### 第 3 步 · 登录

开发模式下（`server/.env` 中 `DEV_MODE=true`），
`POST /api/auth/send-code` 会在响应里直接返回 `devCode`，
无需真实短信即可完成登录流程。

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

> **生产部署前务必将 `server/.env` 的 `DEV_MODE` 改为 `false`**，
> 否则验证码会直接出现在接口响应里。

---

### 常用命令

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

## Features

按模块列出，标注完成状态。

### 📱 业务功能

| 模块 | 功能 | 状态 |
|---|---|---|
| 首页 | 村庄介绍、美食推荐、打卡入口 | ✅ |
| 商城 | 特产商品浏览、下单购买、积分抵扣 | ✅ |
| 美食详情 | 菜品详情、图片墙、制作步骤 | ✅ |
| 探索 | 地图选点（无 Key 自动降级为列表）、村落信息展示 | ✅ |
| 万物长廊 | 村庄风物展示 | ✅ |
| 旅途手账 | 打卡记录时间轴 | ✅ |
| 村落勋章 | 积分与成就体系 | ✅ |
| 打卡 | 定位打卡、拍照上传、做菜打卡、答题打卡 | ✅ |
| 我的 | 点赞、相册（分页增量加载）、打卡记录、账户资料、关于 | ✅ |
| 每日签到 | 签到积分、连续签到统计 | ✅ |

### 🔐 账户与安全

| 功能 | 说明 | 状态 |
|---|---|---|
| 手机号验证码登录 | `POST /api/auth/send-code` + `/api/auth/login`，用户不存在自动注册 | ✅ |
| 手写登录页 | `pages/login/login`，视觉沿用原项目暖色系 | ✅ |
| 手写用户中心 | `pages/userinfo/userinfo`，含昵称 / 头像编辑与登录统计 | ✅ |
| JWT 鉴权 | `jsonwebtoken` HS256，7 天有效期，中间件统一拦截 | ✅ |
| CSPRNG 验证码 | `crypto.randomInt`，替代 `Math.random` | ✅ |
| 发送频率限制 | 同号 60 秒一次 + 单日 10 次上限 | ✅ |
| 错误次数锁定 | 连错 5 次验证码作废，需重新获取 | ✅ |
| 手机号严格类型校验 | 拒绝数组 / 数字 / null 等异常入参 | ✅ |
| bcrypt 密码哈希 | 密码登录路径 | ✅ |
| 会话健康检查 | `GET /api/user/session`，返回有效期 / 即将过期 / 设备数 / 登录地 | ✅ |
| 静默续期 | 剩余 < 600s 自动刷新，用户无感知 | ✅ |
| 路由守卫 | 自研 `utils/router-guard.js`，5 个受保护页面 | ✅ |
| 登录统计字段 | `loginCount` / `lastLoginAt` / `source` | ✅ |

### 🤖 Agent 编排层

| 功能 | 说明 | 状态 |
|---|---|---|
| 两阶段规划 | 意图分类 → 工具序列规划 | ✅ |
| 多工具串行 | 复合提问自动拆解为多个工具调用 | ✅ |
| 工具注册表 | 四要素声明 + JSON Schema 校验 | ✅ |
| 降级链 | 低置信度返回能力清单，不猜测工具 | ✅ |
| 可观测 | 每次调用生成 trace，环形缓冲保留 20 条 | ✅ |
| 短期记忆 | 滑动窗口，可选持久化 | ✅ |
| 规则适配器 | 默认路径，零外部依赖 | ✅ |
| LLM 适配器 | 可选启用，需配置 Key | ✅（可选） |
| Agent 演示页 | 输入 → 规划 → 执行 → trace 查看 | ✅ |
| **服务端编排** | 后端直接 require `agent/` 核心，编排与数据同处一地 | ✅ |

### 🎭 数字人交互层

| 功能 | 说明 | 状态 |
|---|---|---|
| Canvas 2D 形象 | 纯代码绘制，无 Live2D、无模型文件 | ✅ |
| 口型同步 | 文本 → 口型参数序列，实时驱动 | ✅ |
| 4 种表情 | 中性 / 开心 / 思考 / 惊讶 | ✅ |
| 打断语义 | `stop()` 立即复位，覆盖式不排队 | ✅ |
| TTS 适配器 | 默认 noop（只做口型），可选真实语音 | ✅（可选） |
| Agent 联动 | `avatar-speak` 工具，Agent 可触发口播 | ✅ |
| 数字人演示页 | Canvas + 输入 + 说话 / 停止 / 表情切换 | ✅ |

### ⚡ 性能与工程化

| 功能 | 说明 | 状态 |
|---|---|---|
| **数据缓存层** | 自研 TTL + 标签失效 + 并发去重 + LRU，`/api/health` 暴露命中率 | ✅ |
| **长列表分页** | 用户态列表支持 `page` / `pageSize`，未传参时返回全量（向前兼容） | ✅ |
| **前端增量渲染** | `utils/list-loader.js` mixin，触底加载 + 并发保护 | ✅ |
| **零付费云依赖** | 不需要注册任何云账号，本地完整跑通 | ✅ |
| **零配置可运行** | clone → npm install → prisma db push → npm run dev | ✅ |
| 密钥治理 | 全部经 `server/.env`，源码零凭据 | ✅ |
| 自动化测试 | 前后端共 200 项（见 Testing 章节） | ✅ |
| 静态检查防线 | 4 类检查器守护（JSON / 残留引用 / Vue 语法 / 模板标签） | ✅ |
| CI 工作流 | push tag 自动构建，产出 artifact | ✅（需配置 secrets） |
| 上线文档 | 五阶段流程 + 检查清单 | ✅ |

---

## Testing & Quality Assurance

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

这些检查器是被**真实事故**逼出来的 —— 每一条都对应一次具体的故障：

| 检查器 | 拦截的问题 | 触发背景 |
|---|---|---|
| `scripts/check-frontend-refs.js` | 前端残留 `uniCloud` 调用 / `store.userInfo` | Sprint 5 批量替换后遗漏引用点，导致页面白屏 |
| `scripts/check-vue-syntax.js` | `.vue` 脚本块语法错误 | 批量编辑引入的语法破损 |
| `scripts/check-template-tags.js` | 模板标签未闭合、根元素不唯一、属性区截断 | Sprint 5.2 编辑操作截断了 `location.vue` 的模板 |
| `scripts/check-json.js` | JSON 语法错误 | 配置文件的批量修改 |

> `check-template-tags.js` 本身也是**用注入同型损坏的方式验证过**的：
> 故意破坏一个模板确认它会退出码 1，再恢复正常确认退出码 0。

---

## Architecture

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

## API Documentation

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

**读接口**：`get_villages_list` · `get_village_info` · `get_food_info` · `get_shop_goods` ·
`get_quiz_questions` · `get_user_orders` · `getCheckInRecords` ·
`getUserCheckedSpots` · `getUserPhotos`

**写接口**：`checkIn` · `dailySignIn` · `quizCheckIn` · `gameCheckIn` ·
`saveUserPhotos` · `deleteUserPhoto` · `updateUserPhoto` · `purchaseItem` ·
`userInit` · `analyzeFoodPhoto`

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

## Configuration

所有配置通过 `server/.env` 读取（**源码中不含任何真实凭据**）。
完整模板见 `server/.env.example`。

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

## Known Issues & Limitations

> 如实列出当前已知的问题与限制。**不夸大、不掩饰。**

### 🔴 未实际验证的操作

| # | 项目 | 状态 | 说明 |
|---|---|---|---|
| 1 | **APK 未实际打包** | ⬜ 未执行 | 无 DCloud 账号与打包凭据，且本地无 HBuilderX CLI。`build-apk.yml` 结构正确、YAML 校验通过，但**未在真实环境跑通**，不产出 APK |
| 2 | **真机安装未验证** | ⬜ 未执行 | 无 Android 真机环境。「Android 10+ 安装不闪退」是待验证项，不是已验证结论 |
| 3 | **真实短信未发送** | ⬜ 未执行 | 短信服务商未接入。`send-code` 的完整逻辑经 61 项后端测试验证（含频控、锁定），但**真实短信链路未跑通** |
| 4 | **前端未在 HBuilderX 中实际运行** | ⬜ 未执行 | 44 处 API 调用已全部替换并通过静态语法校验，但**未在 HBuilderX 模拟器 / 真机中点过一遍**。真机调试还需把 `BASE_URL` 改为局域网 IP |
| 5 | **Canvas 渲染未在真机 / 模拟器验证** | ⬜ 未执行 | 渲染逻辑有单元测试覆盖（参数裁剪、表情切换、无 ctx 不抛异常），但实际画面效果需在 HBuilderX 中运行确认 |

### 🟡 设计上的已知限制

| # | 项目 | 影响 | 计划 |
|---|---|---|---|
| 6 | **口型映射是近似的** | 不是音素级对齐。刻意不引入拼音库（会增数百 KB 依赖），用字符类别近似替代 | 见 Future Work |
| 7 | **`analyzeAudio` 接口未实现** | 音频驱动的口型同步不可用。需 Web Audio AnalyserNode，且 App 端与 H5 端 API 不一致 | 见 Future Work |
| 8 | **`chat_history` 是覆盖写** | 每用户只存最后一条，不是真正的历史记录 | 见 Future Work |
| 9 | **TTS 默认 noop** | 数字人默认不出声，只有口型动画。启用需配置讯飞并补齐服务端 `/api/tts` | 见 Future Work |
| 10 | **Agent 默认规则适配器** | 意图识别基于关键词加权，换一种问法可能识别不到 | 见 Future Work（LLM 适配器） |
| 11 | **业务数据接口按 name 聚合** | `/api/business/:name` 而非每域一个路由文件。优点是前端改动最小、协议替换纯粹；缺点是单文件较长 | 刻意选择 |
| 12 | **数字人形象为简笔风格** | 目标是链路自研可讲，不追求视觉精美 | — |
| 13 | **图片识别降级为本地规则** | 未接百度 AI 时只返回本地模拟的评分与点评 | 见 Future Work |
| 14 | **SQLite 单机存储** | 不适合多实例部署与高并发。生产环境建议换 PostgreSQL（Prisma 改一行 datasource 即可迁移） | 见 Future Work |
| 15 | **文件上传存本地磁盘** | 多实例部署时图片不共享。生产建议换对象存储 | 见 Future Work |
| 16 | **Android 存储权限用 READ/WRITE_EXTERNAL_STORAGE** | Android 13+ 已废弃该模式，需迁移到 `READ_MEDIA_IMAGES` | 打包上架前处理 |
| 17 | **缓存为进程内实现** | 多实例部署时各实例缓存独立，静态数据更新需等 TTL 到期（最长 5 分钟）才在所有实例生效 | 换 Redis 可解 |
| 18 | **静态图片仍走 COS 公网地址** | 49 个图片资源（约 38 MB）仍引用原 CDN 地址。本仓库脱敏时未内置这些素材 —— 体积过大，且属合作企业素材 | 图片不可用时改为本地 `static/` 资源 |

### 🟢 环境相关的注意事项

| # | 项目 | 说明 |
|---|---|---|
| 19 | `server/.env` 的 `JWT_SECRET` 现为占位符 | **部署前必须替换**，否则 JWT 可被伪造 |
| 20 | `server/.env` 的 `DEV_MODE` 现为 true | **生产必须改为 false**，否则验证码直接出现在接口响应里 |
| 21 | 真机调试需改 `BASE_URL` | `http://localhost:3000` 在手机上指向手机自身，需改为电脑局域网 IP |
| 22 | 旧 uniCloud 资源仍在云端 | 若之前关联过阿里云空间，那些云函数仍存在，但**本项目已不再使用**，可自行在控制台清理 |

---

## Development Process

项目采用 **Sprint 0 → 5 的敏捷迭代**，每个 Sprint 都有可运行增量，git 历史完整呈现迭代过程。

| Sprint | 主题 | 关键产出 | 提交 |
|---|---|---|---|
| **Sprint 0** | 技术债清理 | 隐私数据替换、密钥收敛至 `.env`、死代码删除、仓库工程化 | `13703d6` |
| **Sprint 1** | 登录增强 | 验证码四项安全修复（CSPRNG / 频控 / 错误锁定 / 严格校验）、会话体检 | `bbe4d01` |
| **Sprint 2** | Agent 编排层 | `agent/` 完整目录（planner / executor / memory / fallback / trace / 工具注册表 / 双适配器）；53 项单测 | `989d89d` |
| **Sprint 3** | 数字人交互层 | `digital-avatar/` 完整目录；15 项单测；`avatar-speak` 打通 Agent 联动 | `08e2ed1` |
| **Sprint 4** | 打包与文档 | APK 配置、GitHub Actions、README、上线手册 | `256aa09` |
| **Sprint 5** | 脱离 uniCloud | `server/` 独立后端工程；44 处调用全部替换；协议适配层；静态扫描器 | `791097b` |
| **Sprint 5.1** | 重构断裂修复 | 12 类运行时断裂修复 + 归一化层 + 残留引用扫描器 | `6cb5650` |
| **Sprint 5.2** | 原生能力与 UI | 地图 / 定位 / 拍照 / 上传 / 返回栏等 12 类前端问题修复 | `8e487ba` |
| **Sprint 5.3** | 模板防线 | 修复模板截断 + 新增模板标签检查器 | `dc8f735` |
| **Sprint 5.4** | 性能优化 | 自研缓存层、长列表分页、前端增量渲染 mixin | 本次提交 |

### 迭代方法上的两点体会

**① 每个 Sprint 结束都跑一次全量测试，且测试必须能失败。**
Sprint 2 之前，测试框架存在「0 项却全绿」的假绿问题 ——
断言没被加载也算通过。修复方式不是改断言，而是**先注入一个错误验证测试真的会红**。
现在 `check-template-tags.js` 也是同样的验证思路。

**② 静态检查器是被事故逼出来的，不是预防性写的。**
`check-frontend-refs.js` 存在的原因，是 Sprint 5 用脚本批量替换 44 处调用时，
脚本改不了「引用点」与「后端返回形状」，留下了 `store.userInfo` 残留（页面白屏）
与数据形状断层（字段全 `undefined`）。
这类问题编译器发现不了，只能靠针对性的扫描器守住。

---

## Build APK

`.github/workflows/build-apk.yml` 已配置完成：推送形如 `v1.0.0` 的 tag 会自动触发构建。

```bash
# 递增版本号（manifest.json 的 versionName / versionCode）
# 然后打 tag 触发 CI
git tag -a v1.0.0 -m "release v1.0.0"
git push origin v1.0.0
```

> ⚠️ **该流水线未在真实环境跑通**（无 DCloud 账号与打包凭据），
> YAML 结构与触发条件正确，但**不产出实际可安装的 APK**。详见 [Known Issues](#known-issues--limitations)。

---

## Production Deployment

> 完整可执行版本见 [`docs/上线手册.md`](./docs/上线手册.md)（含每步的具体命令与注意事项）。

**阶段 1 · 代码冻结**

```bash
npm run test:all        # 前端全量测试
cd server && npm test   # 后端全量测试
git tag -a v1.0.0 -m "release v1.0.0"
```

**阶段 2 · 后端部署**

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

**阶段 3 · 数据库迁移**

SQLite → PostgreSQL 只需修改 `server/prisma/schema.prisma` 的一行 datasource：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**阶段 4 · 前端发布**

用 HBuilderX 发行到对应平台；小程序需在微信公众平台配置合法 request 域名。

---

## Future Work

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

## License

[MIT](./LICENSE) © 2026 CharLene

---

## Contributing

欢迎 Issue 与 PR。提交前请确保：

```bash
npm test                 # 前端静态检查
cd server && npm test    # 后端全量测试
```

**请勿提交**：任何真实密钥、真实用户数据、`.env` 文件。
这些已被 `.gitignore` 覆盖，但提交前请再确认一次。

---

<div align="center">

**舌尖上的村落** · Taste of the Village
<sub>校企合作项目 · 2025.07 – 2026.09 · 架构与工程能力展示</sub>

</div>
