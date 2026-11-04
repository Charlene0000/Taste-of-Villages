'use strict'

/**
 * 后端配置（自研）
 *
 * 全部配置来自环境变量（.env），代码中不含任何真实凭据。
 * 与前端的 common/app-config 保持同样的设计哲学：
 *   - 密钥只从环境读取
 *   - 未配置的服务一律走本地降级路径
 */

const path = require('path')
const dotenv = require('dotenv')

// 加载 .env（server/ 目录下）
dotenv.config({ path: path.join(__dirname, '..', '.env') })

/** 把 'true' / '1' / 'yes' 视为真 */
function envBool (value, defaultValue = false) {
	if (value === undefined || value === null || value === '') return defaultValue
	const s = String(value).trim().toLowerCase()
	return s === 'true' || s === '1' || s === 'yes' || s === 'on'
}

/** 把逗号分隔的字符串转成数组 */
function envList (value, defaultValue = []) {
	if (!value) return defaultValue
	return String(value).split(',').map(s => s.trim()).filter(Boolean)
}

const config = {
	port: parseInt(process.env.PORT, 10) || 3000,

	// JWT
	jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-please-change',
	jwtExpiresIn: parseInt(process.env.JWT_EXPIRES_IN, 10) || 604800,

	// 开发模式：send-code 直接返回 devCode
	devMode: envBool(process.env.DEV_MODE, false),

	// 跨域
	corsOrigins: envList(process.env.CORS_ORIGIN, ['*']),

	// 数据库
	databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',

	// 上传目录
	uploadDir: path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),

	// 可选外部服务（默认全部关闭）
	services: {
		deepseek: {
			enabled: envBool(process.env.DEEPSEEK_ENABLED, false),
			apiKey: process.env.DEEPSEEK_API_KEY || 'your-deepseek-key-placeholder',
			apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions'
		},
		xfyun: {
			enabled: envBool(process.env.XFYUN_ENABLED, false),
			appId: process.env.XFYUN_APP_ID || 'your-xfyun-appid-placeholder',
			apiSecret: process.env.XFYUN_API_SECRET || 'your-xfyun-api-secret-placeholder',
			apiKey: process.env.XFYUN_API_KEY || 'your-xfyun-api-key-placeholder'
		}
	}
}

/**
 * 判断某个服务是否真正可用
 * 校验 enabled 标志 + 凭据已脱离占位符形态，任一不满足即为不可用
 */
function isServiceEnabled (name) {
	const svc = config.services[name]
	if (!svc || svc.enabled !== true) return false
	return Object.keys(svc)
		.filter(k => k !== 'enabled' && k !== 'apiUrl')
		.every(k => {
			const v = svc[k]
			return typeof v === 'string' && v.length > 0 && v.indexOf('-placeholder') === -1
		})
}

module.exports = {
	config,
	envBool,
	envList,
	isServiceEnabled
}
