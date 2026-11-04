# Agent 编排层

> 自研的 Agent 编排模块。默认路径零外部依赖，clone 下来即可运行。

## 目录结构

```
agent/
├── core/
│   ├── index.js        入口：runAgent(input, context, options)
│   ├── planner.js      两阶段规划：意图分类 → 工具序列
│   ├── executor.js     工具调度与结果聚合
│   ├── memory.js       短期对话上下文（内存 + 可选持久化）
│   ├── fallback.js     降级策略（能力清单）
│   └── trace.js        执行轨迹环形缓冲区
├── tools/
│   ├── index.js        工具注册表 + JSON Schema 校验器
│   ├── user-stats.js   查询当前用户登录次数/注册天数
│   ├── server-time.js  返回服务器时间
│   ├── echo.js         回显（调试链路用）
│   └── avatar-speak.js 让数字人开口（Sprint 3，前端专用）
├── adapters/
│   ├── rule-adapter.js 规则匹配适配器（默认，零外部依赖）
│   └── llm-adapter.js  LLM 适配器（可选，需配置 Key）
└── tests/
    ├── run-tests.js        零依赖测试运行器
    ├── planner.test.js
    ├── executor.test.js
    ├── fallback.test.js
    └── run-agent.test.js
```

## 快速上手

```js
import { runAgent, getTraces } from '@/agent/core/index'

const r = await runAgent('我登录了几次现在几点', { user: currentUser })
console.log(r.answer)      // 聚合后的回答
console.log(r.plan.calls)  // 规划出的工具序列
console.log(r.trace)       // 本次调用的完整轨迹
```

## 核心机制

### 一、两阶段规划

**阶段一 · 意图分类** —— 适配器对输入做关键词加权打分，输出候选意图与置信度。

**阶段二 · 工具序列规划** —— 把意图映射为工具调用序列，支持单工具与多工具串行。

复合提问「我登录了几次现在几点」会同时命中 `user-stats` 与 `server-time`，
按置信度降序串行执行。

### 二、降级链

置信度低于阈值（默认 0.3）时，**不猜测任何工具**，转而返回能力清单：

```
我没太理解你的问题。不过我可以做这些事情：
  1. 查询当前用户的登录次数、注册天数、最近登录时间
  2. 获取当前服务器时间（含 ISO 格式与中文可读格式）
  3. 回显传入的文本内容（用于调试工具调用链路）
```

这是本模块最重要的设计约束：**Agent 在未知输入下的行为是可预期的**，
不会返回似是而非的工具结果。

### 三、参数校验

每个工具声明 `parameters`（JSON Schema 风格）。executor 在调用前校验，
**校验失败返回结构化错误，不抛异常**：

```js
{ ok: false, error: { code: 'INVALID_PARAMS', details: [{ field: 'message', message: '...' }] } }
```

### 四、可观测

每次 `runAgent` 生成一条 trace，记录：输入 → 规划结果 → 每个工具的执行耗时 → 最终输出。
写入容量为 20 的环形缓冲区，前端「Agent 演示」页可查看最近 20 条。

排查「AI 回答得不对」时，可以直接看出是意图识别错了、参数错了、还是工具抛了异常。

### 五、记忆

`memory.Memory` 提供滑动窗口的短期上下文，默认保留最近 10 轮。
传入 `storage` 适配器即可持久化：

```js
const memory = new Memory({
  storage: {
    getItem: (k) => uni.getStorageSync(k) || null,
    setItem: (k, v) => uni.setStorageSync(k, v)
  },
  namespace: 'user-123'
})
```

## 接入 LLM 适配器（可选）

默认路径是 `rule-adapter`，**不需要任何 API Key**。

若要接入 LLM 做意图分类：

1. 在 uni-config-center 的 `app-config` 中配置：
   ```json
   { "deepseek": { "_enabled": true, "apiKey": "<你的 key>" } }
   ```
2. 显式启用：
   ```js
   const llm = require('@/agent/adapters/llm-adapter').createAdapter()
   await runAgent('我登录了几次', {}, { adapter: llm })
   ```

> **重要**：LLM 只用于**意图分类**，不用于生成最终答案。
> 最终答案永远由工具的真实返回值聚合而成 —— 这样即使模型判断错了意图，
> 也不会凭空编造事实，trace 会如实记录下这个错误。

## 测试

```bash
npm run test:agent
```

覆盖 4 类规定场景：正常意图、多工具串行、未知意图降级、参数校验失败，
外加 trace 可观测性、记忆机制与「默认路径不加载 llm-adapter」的断言。

## 边界

- 不做向量检索、不做摘要压缩 —— 简单滑动窗口已足够，行为完全可预期
- 工具执行失败不中断整条链，其余工具结果仍会返回并在聚合中说明
- 云函数环境**无法 require 项目根的 agent/**（HBuilderX 上传云函数只打包
  `cloudfunctions/<name>/`），因此编排层运行在**前端**；
  云端的知识库检索与 LLM 推理由 `ai-agent` 云函数提供，通过工具调用接入
