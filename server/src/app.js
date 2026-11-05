'use strict'

/**
 * Express 应用装配（自研）
 *
 * 中间件顺序：cors → json → 日志 → 路由 → 404 → 错误处理
 */

const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

const { config } = require('./config')
const cache = require('./utils/cache')

const app = express()

// ---------- CORS ----------
app.use(cors({
	origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization']
}))

// ---------- Body 解析 ----------
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// ---------- 静态资源（上传的文件） ----------
const uploadDir = config.uploadDir
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true })
}
app.use('/uploads', express.static(uploadDir))

// ---------- 请求日志 ----------
app.use((req, res, next) => {
	const startedAt = Date.now()
	res.on('finish', () => {
		const cost = Date.now() - startedAt
		// 只记录非静态资源请求，避免刷屏
		if (!req.path.startsWith('/uploads')) {
			console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${cost}ms)`)
		}
	})
	next()
})

// ---------- 健康检查 ----------
app.get('/api/health', (req, res) => {
	res.json({
		code: 200,
		message: '服务运行中',
		uptime: process.uptime(),
		devMode: config.devMode,
		// 缓存可观测性：命中率 / 条目数 / 失效次数
		cache: cache.getStats()
	})
})

// ---------- 业务路由 ----------
app.use('/api/auth', require('./routes/auth'))
app.use('/api/user', require('./routes/user'))
app.use('/api/business', require('./routes/business'))
app.use('/api/agent', require('./routes/agent'))

// ---------- 404 ----------
app.use((req, res) => {
	res.status(404).json({
		code: 404,
		errCode: 'route-not-found',
		errMsg: '接口不存在: ' + req.method + ' ' + req.path
	})
})

// ---------- 统一错误处理 ----------
app.use((err, req, res, next) => {
	console.error('[server] 未捕获异常:', err)
	res.status(500).json({
		code: 500,
		errCode: 'server-internal-error',
		errMsg: '服务器内部错误'
	})
})

module.exports = app
