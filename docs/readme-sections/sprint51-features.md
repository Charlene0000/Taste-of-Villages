### 🔧 Sprint 5.1 修复补丁（重构车祸的 12 类断裂）

| 断裂 | 症状 | 修复 |
|---|---|---|
| Agent 传参用错字段 | `POST /api/agent/chat 400 缺少提问内容` | `agentApi.chat` 显式支持 `{message}` / `{messages}`，不再把整个对象当 message |
| `checkStatus`/`tts` action 不存在 | AI 弹窗整体禁用、打卡页拍照入口禁用 | 本地恒定启用 + 探活日志；TTS 降级为不出声 |
| 响应路径错误 | 拿到答案但页面不显示 | 兼容 `res.answer` 与 `res.result.choices[0]` |
| `addCongmeiOverlay` 从未定义 | 首页 `TypeError`，地图与弹窗全挂 | 补齐实现 + `safeAddOverlay` 防御，单个图层失败不拖垮首页 |
| `store.userInfo` 残留 | 勋章页/手账页 `ReferenceError` 白屏 | 改为读本地缓存 |
| `userInfo._id` 不存在 | 已登录但用户数据不显示 | `withLegacyId` 补 `_id` 别名 |
| 业务 ID 与主键混淆 | 打卡进度永远 0 | 村庄 `_id` 映射回 `'101'`–`'105'` |
| 题库字段名不同 | 答题页空白 | 归一化补 `title`/`options`/`answerIndex` + 按 slug 过滤 |
| 商品字段名不同 | 商城图片/描述空白 | 归一化补 `_id`/`img_url`/`description` |
| `code === 0` 判定 | 美食详情永远「未找到」 | 兼容 200 与 0 |
| `res.data.newPoints` 不存在 | 兑换后积分变 undefined | 优先服务端余额，否则本地扣减 |
| 守卫在 `onLoad` 判断路由 | 未登录可绕过守卫 | 显式传路由，消除页面栈时序依赖 |
| 种子数据未迁移 | 全新 clone 后所有列表为空 | `server/scripts/seed.js` + `server/data/seed.json` |

