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
