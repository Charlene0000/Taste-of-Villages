'use strict'

/**
 * 后端服务启动入口
 *
 * 用法：
 *   cd server
 *   npm install
 *   npx prisma db push     # 初始化 SQLite 数据库
 *   npm run dev            # 启动服务（默认 3000 端口）
 */

const app = require('./app')
const { config } = require('./config')
const { disconnect } = require('./db')

const server = app.listen(config.port, () => {
	console.log('')
	console.log('  ╭─────────────────────────────────────────────╮')
	console.log('  │  跨境共生小程序 · 后端服务已启动              │')
	console.log('  ╰─────────────────────────────────────────────╯')
	console.log('')
	console.log(`  地址      http://localhost:${config.port}`)
	console.log(`  健康检查  http://localhost:${config.port}/api/health`)
	console.log(`  开发模式  ${config.devMode ? '开启（send-code 返回 devCode）' : '关闭'}`)
	console.log('')
})

// 优雅退出
async function shutdown (signal) {
	console.log(`\n[server] 收到 ${signal}，正在关闭...`)
	server.close(async () => {
		await disconnect()
		console.log('[server] 已安全关闭')
		process.exit(0)
	})
	// 兜底：5 秒后强制退出
	setTimeout(() => process.exit(1), 5000)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
