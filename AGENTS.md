# AGENTS.md

> 本文件供 AI 编码助手（如 Claude Code / Cursor / Copilot）快速建立项目上下文。
> 人类开发者请优先阅读 [`README.md`](./README.md)。

## 项目一句话

跨境共生小程序 —— 基于 uni-app (Vue 2) + uniCloud (阿里云) 的乡村美食打卡应用，
在既有业务之上自研 **Agent 编排层** 与 **数字人交互层**。

**作者：CharLene** · **License：MIT**

---

## 目录约定

```
pages/                    业务页面（新增页面放这里，并在 pages.json 注册）
components/               复用组件
agent/                    ★ 自研 Agent 编排层（Sprint 2）
  core/     planner · executor · memory · fallback
  tools/    工具注册表与具体工具
  adapters/ rule-adapter（默认）· llm-adapter（可选）
  tests/    单元测试
digital-avatar/           ★ 自研数字人交互层（Sprint 3）
  renderer/ canvas-avatar
  bridge/   lipsync
  controller/ avatar-controller
  adapters/ tts-adapter
utils/                    前端工具（含 session.js，会话健康检查）
uniCloud-aliyun/
  cloudfunctions/         云函数（common/ 为公共模块）
  database/               schema 与种子数据分离
uni_modules/              DCloud 官方模块（勿改，除非必须）
docs/                     审计报告 / 技术债报告 / 架构 / 敏捷过程
scripts/                  本地校验脚本
```

---

## 硬性规则

### 1. 密钥绝不写进源码

所有第三方凭据从 `uniCloud-aliyun/cloudfunctions/common/app-config` 读取：

```js
const appConfig = require('../common/app-config')   // 云端用 'app-config'
const CONFIG = appConfig.getConfig()
const key = CONFIG.deepseek.apiKey || 'your-deepseek-key-placeholder'
```

源码里只允许出现 `your-*-placeholder` 形式的占位符。
新增外部服务时，同步更新 `config.example.json` 与 `uni-config-center` 的 `app-config/config.json`。

### 2. 零配置可运行是硬指标

**默认路径不得产生任何外部 API 调用与费用。**
收费服务一律通过 `appConfig.isServiceEnabled('xxx')` 判定，
未启用时走本地降级路径。新增功能时必须提供无 Key 也能演示的分支。

### 3. 增强优先于重建

18 个业务页面、5 个组件、21 个云函数都是既有资产。
改代码前先确认真的不能复用 —— 详见 `docs/现有能力审计报告.md` 的资产清单。

### 4. 官方模块不改

`uni_modules/` 下是 DCloud 官方模块。除非必须修 bug，不要修改；
`uniCloud-aliyun/cloudfunctions/uni-captcha/` 是官方模块的部署副本，保持与 `uni_modules/` 一致
（不要加作者署名）。

### 5. 数据库不写真实数据

`uniCloud-aliyun/database/*.json` 只能放脱敏种子数据，
禁止包含真实手机号、openid、token、IP、图片 URL。

### 6. JSON 校验必跑

改完任何 `.json` 后必须执行：

```bash
npm test
```

校验器支持三种格式：标准 JSON、JSONL（uniCloud 数据文件，每行独立 JSON）、
含行注释的 schema。

---

## 常用命令

```bash
npm test                       # JSON 语法校验（91 个文件）
node scripts/check-json.js    # 同上，可指定直接运行
```

> 单元测试入口（jest / node --test）在 Sprint 2 有了 `agent/tests/` 后配置。

---

## 云函数开发注意

- 云函数 `package.json` 的 `name` 必须与目录名一致
- 每个自研云函数 `package.json` 需带 `author: "CharLene"` 与 `license: "MIT"`
- 公共模块放 `uniCloud-aliyun/cloudfunctions/common/`，云函数内用双路径 require 兼容本地与云端：

```js
function loadAppConfig() {
  for (const id of ['app-config', '../common/app-config']) {
    try { return require(id) } catch (e) {}
  }
  throw new Error('无法加载 app-config')
}
```

---

## 迭代流程

当前 Sprint 与待办见 [`docs/敏捷开发过程.md`](./docs/敏捷开发过程.md)。
每个 Sprint 结束需更新 README 的对应章节，并在 commit message 中体现 Sprint 编号。

---

## 不要做的事

- ❌ 把真实密钥写进任何被 git 跟踪的文件
- ❌ 把真实用户数据放进 `database/`
- ❌ 修改 `uni_modules/` 下的官方模块
- ❌ 删除 `docs/` 下的审计与债务报告（它们是简历的一部分）
- ❌ 在 README 里声称完成了未实际执行的操作（如"已打包出 APK"）
  —— 平台限制无法验证的环节，写进 Known Issues 并给出替代路径
