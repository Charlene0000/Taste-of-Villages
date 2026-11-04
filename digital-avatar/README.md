# 数字人交互层

> 纯自研 Canvas 2D 方案。**不引入 Live2D、不引入二进制模型文件、不依赖任何收费渲染服务。**
> 形象全部由代码绘制，代码在仓库内可读、可改、可讲。

## 目录结构

```
digital-avatar/
├── renderer/
│   └── canvas-avatar.js    Canvas 2D 形象：头部/眼睛/眉毛/嘴巴/腮红/身体
├── bridge/
│   └── lipsync.js          文本 → 口型参数序列（纯规则，纯函数）
├── controller/
│   └── avatar-controller.js speak / stop / setExpression + 打断语义
├── adapters/
│   └── tts-adapter.js      默认 noop（只做口型不出声）+ 可选 uni 音频适配器
└── tests/
    ├── run-tests.js        零依赖测试运行器
    ├── lipsync.test.js     口型序列纯函数测试
    └── controller.test.js  播报控制与打断语义测试
```

## 快速上手

```js
import { CanvasAvatar } from '@/digital-avatar/renderer/canvas-avatar'
import { AvatarController } from '@/digital-avatar/controller/avatar-controller'
import { noop as noopTts } from '@/digital-avatar/adapters/tts-adapter'

const ctx = uni.createCanvasContext('avatarCanvas', this)
const avatar = new CanvasAvatar({ ctx, width: 340, height: 340 })
const controller = new AvatarController({ avatar, tts: noopTts })

controller.speak('你好世界')   // 开始播报
controller.stop()              // 立即打断
controller.setExpression('happy')
```

---

## 一、LipSyncBridge：文本 → 口型参数序列

### 机制

纯规则映射，**不依赖音频**：

1. 文本按 Unicode 码点切分（正确处理代理对）
2. 逐字符估算发音时长
   | 类别 | 基准时长 | 说明 |
   |---|---|---|
   | 汉字 | 200ms | ≈ 1 音节 |
   | 英文字母 | 120ms | ≈ 0.5 音节 |
   | 数字 | 150ms | 逐位读 |
   | 空格 | 60ms | — |
   | 逗号类 | 120ms | 停顿 |
   | 句号类 | 260ms | 停顿 |
   | 换行 | 300ms | 停顿 |
3. 逐字符映射口型开合值 ∈ [0,1]
   - 闭口音（m/n/b/p）→ 0.05
   - 开口音（a/o/e）→ 0.85
   - 汉字 → 按字符码散列在 0.28 / 0.55 / 0.85 间取值（避免全程同一幅度显得机械）
   - 标点 → 0.05（完全闭合）
4. 输出 `[{t, value}]`，t 为累计时间（ms），value ∈ [0,1]

### 采样

播放时按时间轴插值采样：

```js
const value = lipsync.sampleAt(frames, elapsed)  // 相邻两帧之间线性插值
```

插值让口型过渡平滑，而非阶跃跳动。

### 精度边界（诚实声明）

本映射是**近似**的，不是音素级对齐：

- 不做真实拼音转换，用字符类别近似代替
- 引入完整拼音库可提升精度，但会增加数百 KB 依赖，
  与「clone 即可运行、零外部依赖」的约束冲突，故**不引入**
- 实际观感：口型开合节奏与文本朗读节奏基本吻合，但无法与专业 lip-sync 逐帧对齐

`analyzeAudio()` 是预留接口（音频 RMS → 开口度），默认不启用也不实现 ——
它需要 Web Audio 的 AnalyserNode，且 uni-app 的 App 端与 H5 端 API 不一致，
跨端适配成本高于收益。接口契约已定义：只需返回与 `build()` 相同结构的数组，
AvatarController 不关心序列来源。

---

## 二、AvatarController：播报控制

### 三个方法

| 方法 | 说明 |
|---|---|
| `speak(text, options)` | 开始播报。`options.expression` 可指定表情 |
| `stop()` | 立即打断并复位口型 |
| `setExpression(name)` | 切换表情：`neutral` / `happy` / `thinking` / `surprised` |

### 打断语义：**覆盖式**（默认）

连续调用 `speak()` 时，**新调用打断旧调用，不排队**。

**理由**：数字人是对话反馈。用户再次说话，意味着他不想听上一句。
排队会导致「我问三句，它慢慢答三句」的滞后感，反而更糟。

**代价与应对**：若业务确实需要排队（如依次播报多条通知），
可传 `options.queue = true` 开启排队模式，此时 `speak()` 会入队等待。

| 模式 | 参数 | 行为 |
|---|---|---|
| 覆盖式（默认） | `queue: false` | 新 speak 打断旧的，队列长度恒为 0 |
| 排队式 | `queue: true` | 新 speak 入队，当前播完后依次播 |

### 播放循环

`requestAnimationFrame` 驱动，每帧：
1. 按 `elapsed` 采样口型值 → `avatar.setMouthOpenY(v)`
2. `avatar.update(dt)` 推进呼吸相位
3. `avatar.render()` 绘制

到达序列末尾自动闭口、停止循环、触发 `onStateChange(false)`。

---

## 三、TTS 适配器

默认导出 **noop**：文本照常被处理成口型序列，但**不发声**。

原因：讯飞 TTS 是收费服务，作为默认路径会违反「零配置、零费用」的约束。

### 启用真实语音（可选）

```js
import { createUniAudioAdapter } from '@/digital-avatar/adapters/tts-adapter'

const controller = new AvatarController({
  avatar,
  tts: createUniAudioAdapter({ vcn: 'x4_yezi' })
})
```

该适配器调用 `ai-agent` 云函数的 `tts` action：

- 云端返回 `audio` → 播放
- 云端返回 `audio: null`（讯飞未配置）→ **不出声，仅口型动画继续**

这正是设计好的降级路径 —— 无论云端是否配置了语音服务，
前端行为都是可预期的。

---

## 四、Agent 联动

`agent/tools/avatar-speak.js` 是 Agent 与数字人之间的桥梁：

```js
import registry from '@/agent/tools/index'
import avatarSpeak from '@/agent/tools/avatar-speak'

// 显式注册（仅前端）
registry.register(avatarSpeak.createTool(() => controller))
```

Agent 的 executor 调用该工具时，会触发 `controller.speak(text)`，
数字人随即开口。

**该工具仅在前端可用，云函数中不注册**，原因：

- AvatarController 依赖 `requestAnimationFrame` 与 Canvas 上下文，
  这是渲染层能力，云端不存在
- 数字人是对当前用户的即时反馈，本就不应在服务端执行

---

## 五、测试

```bash
npm run test:avatar
```

覆盖 15 项：序列长度匹配、value 值域、t 单调递增、空输入、
标点闭合、插值边界、字符分类、预留接口行为、播报启动/停止/打断、
覆盖式不产生双动画、队列模式、表情切换、TTS 异常不影响动画等。
