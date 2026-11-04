'use strict'

/**
 * 统一配置读取层（自研）
 *
 * 目标：
 * 1. 源码中不出现任何真实密钥，一律占位符；
 * 2. 优先从 uni-config-center 读取（生产环境在控制台配置，不入库）；
 * 3. 本地开发可零配置运行 —— 未配置时返回占位符，调用方据此走本地降级路径；
 * 4. 双路径加载，兼容本地 Node 与 uniCloud 云端运行时。
 *
 * 加载顺序：
 *   ① uni-config-center 的 app-config plugin（生产 / 推荐）
 *   ② 同目录 config.local.json（本地私有，已被 .gitignore 排除）
 *   ③ 同目录 config.json（仓库内占位符，零配置默认值）
 *   ④ 空对象
 */

const DEFAULT_CONFIG = {
	deepseek: {
		_enabled: false,
		apiKey: 'your-deepseek-key-placeholder',
		apiUrl: 'https://api.deepseek.com/v1/chat/completions',
		model: 'deepseek-chat'
	},
	xfyun: {
		_enabled: false,
		appId: 'your-xfyun-appid-placeholder',
		apiSecret: 'your-xfyun-api-secret-placeholder',
		apiKey: 'your-xfyun-api-key-placeholder'
	},
	baidu: {
		_enabled: false,
		apiKey: 'your-baidu-api-key-placeholder',
		secretKey: 'your-baidu-secret-key-placeholder'
	},
	cos: {
		_enabled: false,
		bucket: 'your-cos-bucket-placeholder',
		region: 'ap-guangzhou',
		secretId: 'your-cos-secret-id-placeholder',
		secretKey: 'your-cos-secret-key-placeholder'
	}
}

function isPlainObject(v) {
	return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** 深合并：child 覆盖 parent，数组整体替换 */
function merge(parent, child) {
	if (!isPlainObject(parent)) return isPlainObject(child) ? child : {}
	if (!isPlainObject(child)) return parent
	const out = Object.assign({}, parent)
	for (const key of Object.keys(child)) {
		if (key.startsWith('_')) continue
		if (isPlainObject(out[key]) && isPlainObject(child[key])) {
			out[key] = merge(out[key], child[key])
		} else if (child[key] !== undefined) {
			out[key] = child[key]
		}
	}
	return out
}

function loadFromConfigCenter() {
	try {
		// uni-config-center 仅在 uniCloud 运行时可被 require
		const createConfig = require('uni-config-center')
		const center = createConfig({
			pluginId: 'app-config'
		})
		if (center && typeof center.config === 'function') {
			const cfg = center.config()
			return Array.isArray(cfg) ? cfg[0] : cfg
		}
	} catch (e) {
		// 本地 Node 环境或未部署配置中心，静默降级
	}
	return null
}

function loadLocalFile() {
	const fs = require('fs')
	const path = require('path')
	const localPath = path.join(__dirname, 'config.local.json')
	try {
		if (fs.existsSync(localPath)) {
			return JSON.parse(fs.readFileSync(localPath, 'utf8'))
		}
	} catch (e) {
		console.warn('[app-config] 读取 config.local.json 失败:', e.message)
	}
	return null
}

function loadPackagedDefault() {
	try {
		return JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'config.json'), 'utf8'))
	} catch (e) {
		return null
	}
}

let cached = null

function getConfig() {
	if (cached) return cached
	const layers = [loadFromConfigCenter(), loadLocalFile(), loadPackagedDefault()]
	cached = layers.reduce((acc, layer) => (layer ? merge(acc, layer) : acc), {})
	return cached
}

/**
 * 判断某个服务是否已真正配置（未配置则调用方必须走本地降级）
 * @param {string} service 服务名，如 'deepseek' / 'xfyun' / 'baidu' / 'cos'
 */
function isServiceEnabled(service) {
	const cfg = getConfig()
	const item = cfg[service]
	if (!item || item._enabled !== true) return false
	// 逐个服务校验必需字段是否还是占位符
	const required = {
		deepseek: ['apiKey'],
		xfyun: ['appId', 'apiSecret', 'apiKey'],
		baidu: ['apiKey', 'secretKey'],
		cos: ['bucket', 'secretId', 'secretKey']
	}[service] || []
	for (const key of required) {
		const v = item[key]
		if (!v || typeof v !== 'string' || v.indexOf('-placeholder') !== -1) return false
	}
	return true
}

module.exports = {
	getConfig,
	isServiceEnabled,
	DEFAULT_CONFIG
}
