## 2. 关键数据流

### 2.1 登录与账号持久化（Sprint 1 设计，Sprint 5 重建）

```
用户输入手机号
  → POST /api/auth/send-code
      ├─ 手机号严格校验（typeof + 正则）        ← Sprint 5 显式化
      ├─ 频控检查（同号 60s / 单日上限 10）     ← Sprint 1 设计
      ├─ CSPRNG 生成 6 位验证码                ← Sprint 1 替换 Math.random
      └─ 写入 verify_codes（含 attempts / 频控字段）
  → 用户输入验证码
  → POST /api/auth/login
      ├─ 手机号严格校验                        ← Sprint 5 显式化
      ├─ 错误次数校验（5 次作废）              ← Sprint 1 设计
      ├─ 用户不存在 → 自动创建（注册）
      ├─ 更新 loginCount / lastLoginAt / lastLoginIp
      └─ JWT 签发（jsonwebtoken，HS256，7 天）
  → 前端存储 token（app_token）+ 用户信息（app_user_info）
  → 路由守卫放行
```

### 2.2 会话健康检查（Sprint 1 设计，Sprint 5 重建）

```
冷启动（App.onLaunch）/ 关键操作前
  → utils/session.js.ensureSession()
      → GET /api/user/session（携带 Bearer token）
          ├─ 校验 JWT 签名与有效期
          ├─ 返回：剩余有效期 / 是否即将过期 / 登录设备数 / 最近登录地（IP 掩码）
      → 决策：
          剩余 > 600s    → 放行
          剩余 ≤ 600s    → 静默刷新（重新拉 profile 触发续签）
          token 已失效   → 强制重新登录
          服务不可用     → 保守放行，不阻断操作

另一条兜底路径：
  任何请求返回 401
    → utils/request.js 自动清除 app_token + app_user_info
    → 跳转 /pages/login/login
```

### 2.3 Agent 编排（Sprint 2 设计，Sprint 5 迁至服务端）

```
用户输入
  → POST /api/agent/run
      → server/src/services/agent.js
          → runAgent(input, context)         复用 agent/core/index.js
              ├─ planner.plan(input)
              │    ├─ adapters/rule-adapter（默认，零依赖）
              │    │    意图分类 → 置信度评分 → 工具序列
              │    └─ adapters/llm-adapter（可选，需 Key）
              ├─ 置信度 < 阈值？
              │    └─ 是 → fallback.capabilityList()   ← 不胡编，返回能力清单
              ├─ executor.run(plan, context)
              │    ├─ 工具注册表查表（tools/index.js）
              │    ├─ 参数 Schema 校验（失败返回结构化错误，不抛异常）
              │    └─ 串行执行 + 耗时统计
              └─ trace 写入环形缓冲区（最近 20 条）

> 服务端可直接 require('../../agent/core/planner') ——
> Sprint 2 时因「云函数只打包 cloudfunctions/<name>/」而无法复用，
> 成为独立 Node 服务后该约束消失，前端服务端共用同一套编排核心。
```

### 2.4 数字人联动（Sprint 3）

```
Agent 回答用户
  → executor 调用工具 avatar-speak
      → AvatarController.speak(text)
