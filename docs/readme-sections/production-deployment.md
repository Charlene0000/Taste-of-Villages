## Production Deployment

> 完整可执行版本见 [`docs/上线手册.md`](./docs/上线手册.md)（含每步的具体命令与注意事项）。

### 阶段 1 · 代码冻结与版本标记

- `manifest.json` 的 `versionName` / `versionCode` 递增
- `npm run test:all` 全部通过
- 提交并打 tag：`git tag -a v2.0.0 -m "..." && git push origin v2.0.0`
  （推送 tag 会触发 CI）

### 阶段 2 · 后端部署

Sprint 5 之后**不再有云空间**，后端就是一个普通的 Node 进程：

1. **准备环境变量**
   ```bash
   cd server
   cp .env.example .env
   # 编辑 .env，至少替换 JWT_SECRET 并关闭 DEV_MODE
   ```

2. **安装依赖并初始化数据库**
   ```bash
   npm ci --omit=dev
   npx prisma generate
   npx prisma db push
   ```

3. **用进程管理器启动**
   ```bash
   # PM2 示例
   pm2 start src/server.js --name cross-border-api
   pm2 save && pm2 startup
   ```

4. **反代与 HTTPS**（Nginx / Caddy 任选，把 3000 端口暴露出去）

5. **验证生产环境不返回 `devCode`**
   ```bash
   curl -X POST https://your-domain/api/auth/send-code \
     -H "Content-Type: application/json" \
     -d '{"mobile":"13800138000"}'
   ```
   响应中**不应出现** `devCode` 字段。

**必须配置的生产环境变量**：

| 配置项 | 文件位置 | 状态 |
|---|---|---|
| `JWT_SECRET` | `server/.env` | 🔴 **必须替换**，否则 JWT 可伪造 |
| `DEV_MODE` | `server/.env` | 🔴 **必须为 `false`** |
| `PORT` | `server/.env` | 🟡 按需，默认 3000 |
| `CORS_ORIGIN` | `server/.env` | 🟡 生产建议限定为前端域名 |
| `DATABASE_URL` | `server/.env` | 🟡 多实例部署时换成共享数据库 |
| `UPLOAD_DIR` | `server/.env` | 🟡 生产建议挂载持久卷或改用对象存储 |

生成高强度随机串：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> 🔴 **`server/.env` 已被 `.gitignore` 排除**，绝不能提交。
> 部署时用环境变量注入（`docker run -e` / systemd `EnvironmentFile` / CI Secrets）。

### 阶段 3 · APK 打包与签名

见 [Build APK](#build-apk) 章节。演示用公共测试证书，正式上架需自建 keystore。

> ⚠️ 前端 `utils/request.js` 的 `BASE_URL` 需在打包前改为生产域名
> （或改为读取环境变量，构建时注入）。

### 阶段 4 · 上线前检查清单

**后端配置**
- [ ] 生产响应中无 `devCode`
- [ ] `JWT_SECRET` 已替换为随机串
- [ ] `DEV_MODE` 为 `false`
- [ ] `CORS_ORIGIN` 已限定为前端域名
- [ ] 数据库已初始化（`npx prisma db push`）
- [ ] 上传目录可写且有持久化方案

**安全设计（回归验证）**
- [ ] 验证码 60 秒频控生效（`auth-sms-too-frequent`）
- [ ] 验证码连错 5 次作废（`auth-code-locked`）
- [ ] 手机号数组/数字/null 入参返回结构化错误，不崩溃
- [ ] JWT 鉴权生效（不带 token 返回 401）
- [ ] 用户资料接口无法篡改 `loginCount` 等服务端字段

**功能验证**
- [ ] 登录 → 拿 token → 访问 profile 成功
- [ ] 路由守卫生效（未登录访问打卡页跳登录）
- [ ] 会话健康检查返回 `valid: true`
- [ ] Agent 未知意图走降级，不返回错误工具结果
- [ ] 数字人开口正常，停止立即合嘴

**构建与安装**
- [ ] APK 在 Android 10+ 真机安装不闪退
- [ ] Android 13+ 正确申请定位权限
- [ ] 包名符合反向域名规范，且已确定不再变更
- [ ] 签名证书已离线备份

**文档可复现**
- [ ] README Getting Started 在干净环境（无任何配置）可复现
- [ ] `npm run test:all` 全部通过
- [ ] `cd server && npm run test:api` 全部通过（需后端已启动）
- [ ] `node scripts/check-workflow.js` 通过

### 阶段 5 · 分发与反馈

- APK 上传 **GitHub Releases**，README 顶部放 Releases 链接
- 说明后续应用商店上架需要：企业开发者账号、隐私政策、软件著作权、备案号
- 隐私政策需逐项说明：定位用于打卡签到，相机与相册用于记录打卡照片

### 回滚方案

| 场景 | 操作 |
|---|---|
| 后端版本异常 | `pm2 restart` 切回上一版本代码 |
| 数据库 Schema 变更异常 | 从备份恢复 `dev.db` |
| APK 有严重缺陷 | 保留已发布版本，在 GitHub Releases 标记为 yanked，重新打包 |
| 密钥疑似泄露 | **立即轮换**，再排查原因 —— 不要因为想查明原因而延迟轮换 |

---
