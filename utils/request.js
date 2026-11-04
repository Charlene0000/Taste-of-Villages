/**
 * HTTP 请求封装（自研）
 *
 * 替代原 uniCloud.callFunction / uniCloud.importObject 的统一出口。
 *
 * 设计要点
 * --------
 * 1. Promise 化：把 uni.request 的回调风格包装成 async/await
 * 2. 自动携带凭证：Authorization: Bearer <token>
 * 3. 401 拦截：Token 失效时清理本地存储并跳转登录页
 *    —— 这一条替代了原 session-audit 云函数的职责
 * 4. 统一错误结构：{ code, errCode, errMsg }
 *
 * BASE_URL 说明
 * ------------
 * 默认指向本地后端。开发时可在 .env 或真机调试面板中覆盖。
 * 真机调试时 localhost 指向手机自身，需改为电脑的局域网 IP，
 * 例如 http://192.168.1.100:3000
 */

/** 后端服务地址 */
export const BASE_URL = 'http://localhost:3000'

/** 本地存储键 */
const TOKEN_KEY = 'app_token'
const USER_KEY = 'app_user_info'

/**
 * 读取本地 token
 */
export function getToken () {
	try {
		return uni.getStorageSync(TOKEN_KEY) || ''
	} catch (e) {
		return ''
	}
}

/**
 * 写入本地 token
 */
export function setToken (token) {
	try {
		uni.setStorageSync(TOKEN_KEY, token || '')
	} catch (e) {
		console.warn('[request] 写入 token 失败:', e && e.message)
	}
}

/**
 * 读取本地用户信息
 */
export function getUserInfo () {
	try {
		return uni.getStorageSync(USER_KEY) || null
	} catch (e) {
		return null
	}
}

/**
 * 写入本地用户信息
 */
export function setUserInfo (user) {
	try {
		uni.setStorageSync(USER_KEY, user || null)
	} catch (e) {
		console.warn('[request] 写入用户信息失败:', e && e.message)
	}
}

/**
 * 清除登录态（Token + 用户信息）
 */
export function clearAuth () {
	try {
		uni.removeStorageSync(TOKEN_KEY)
		uni.removeStorageSync(USER_KEY)
	} catch (e) {
		// 忽略
	}
}

/**
 * 是否已登录
 */
export function isLoggedIn () {
	return !!getToken()
}

/** 登录页路径 */
const LOGIN_PAGE = '/pages/login/login'

/**
 * 401 时跳转登录页（带去重保护，避免并发请求重复跳转）
 */
let redirecting = false
function redirectToLogin () {
	if (redirecting) return
	redirecting = true

	clearAuth()

	// 获取当前路由。getCurrentPages 是 uni-app 注入的全局函数，
	// 在非 uni-app 运行时（如单元测试、SSR、某些小程序兼容层）可能不存在 ——
	// 直接调用会抛 ReferenceError，让 401 处理链整个崩掉，
	// 表现是「接口失败但页面也白了」。
	// 这里做防御：拿不到路由就不做「已在登录页」的判断，直接跳。
	let current = ''
	try {
		if (typeof getCurrentPages === 'function') {
			const pages = getCurrentPages()
			current = pages.length ? pages[pages.length - 1].route : ''
		}
	} catch (e) {
		console.warn('[request] 获取当前路由失败:', e && e.message)
	}

	// 已在登录页就不跳，避免循环
	if (current && current.indexOf('login') !== -1) {
		redirecting = false
		return
	}

	uni.navigateTo({
		url: LOGIN_PAGE,
		fail: () => {
			uni.reLaunch({ url: LOGIN_PAGE })
		},
		complete: () => {
			setTimeout(() => { redirecting = false }, 500)
		}
	})
}

/**
 * 核心请求方法
 *
 * @param {Object} options
 * @param {string} options.url     接口路径，如 '/api/auth/login'
 * @param {string} options.method  请求方法，默认 GET
 * @param {Object} options.data    请求体
 * @param {boolean} options.auth   是否需要携带凭证，默认 true
 * @param {boolean} options.silent 401 时是否静默（不跳登录页），默认 false
 * @returns {Promise<Object>} 响应体
 */
export function request (options = {}) {
	const {
		url,
		method = 'GET',
		data = {},
		auth = true,
		silent = false,
		header = {}
	} = options

	return new Promise((resolve, reject) => {
		const headers = Object.assign({ 'Content-Type': 'application/json' }, header)

		// 自动携带凭证
		if (auth) {
			const token = getToken()
			if (token) {
				headers.Authorization = `Bearer ${token}`
			}
		}

		uni.request({
			url: BASE_URL + url,
			method,
			data,
			header: headers,
			timeout: 15000,
			success: (res) => {
				const body = res.data || {}

				// 401：Token 失效或未登录
				if (res.statusCode === 401) {
					if (!silent) {
						redirectToLogin()
					}
					const err = new Error(body.errMsg || '登录状态已失效')
					err.errCode = body.errCode || 'unauthorized'
					err.statusCode = 401
					reject(err)
					return
				}

				// 其他错误状态
				if (res.statusCode >= 400) {
					const err = new Error(body.errMsg || `请求失败 (${res.statusCode})`)
					err.errCode = body.errCode || 'http-error'
					err.statusCode = res.statusCode
					err.data = body
					reject(err)
					return
				}

				// 业务层错误：后端用 code 字段表达（如 400/429）
				if (typeof body.code === 'number' && body.code >= 400) {
					const err = new Error(body.errMsg || '请求失败')
					err.errCode = body.errCode || 'business-error'
					err.statusCode = res.statusCode
					err.data = body
					reject(err)
					return
				}

				resolve(body)
			},
			fail: (err) => {
				const e = new Error(err.errMsg || '网络请求失败，请检查后端服务是否已启动')
				e.errCode = 'network-error'
				e.original = err
				reject(e)
			}
		})
	})
}

/**
 * GET 请求
 */
export function get (url, options = {}) {
	return request(Object.assign({}, options, { url, method: 'GET' }))
}

/**
 * POST 请求
 */
export function post (url, data = {}, options = {}) {
	return request(Object.assign({}, options, { url, method: 'POST', data }))
}

/**
 * PUT 请求
 */
export function put (url, data = {}, options = {}) {
	return request(Object.assign({}, options, { url, method: 'PUT', data }))
}

/**
 * DELETE 请求
 */
export function del (url, data = {}, options = {}) {
	return request(Object.assign({}, options, { url, method: 'DELETE', data }))
}

/**
 * 文件上传（替代 uniCloud.uploadFile）
 *
 * @param {string} filePath 本地文件路径
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export function upload (filePath, options = {}) {
	return new Promise((resolve, reject) => {
		const headers = {}
		const token = getToken()
		if (token) headers.Authorization = `Bearer ${token}`

		uni.uploadFile({
			url: BASE_URL + (options.url || '/api/business/upload'),
			filePath,
			name: options.name || 'file',
			header: headers,
			success: (res) => {
				let body = {}
				try {
					body = typeof res.data === 'string' ? JSON.parse(res.data) : (res.data || {})
				} catch (e) {
					body = { code: res.statusCode, errMsg: '响应解析失败' }
				}
				if (res.statusCode >= 400 || (typeof body.code === 'number' && body.code >= 400)) {
					const err = new Error(body.errMsg || '上传失败')
					err.errCode = body.errCode || 'upload-error'
					reject(err)
					return
				}
				resolve(body)
			},
			fail: (err) => {
				const e = new Error(err.errMsg || '上传失败')
				e.errCode = 'upload-network-error'
				reject(e)
			}
		})
	})
}

export default {
	request,
	get,
	post,
	put,
	del,
	upload,
	getToken,
	setToken,
	getUserInfo,
	setUserInfo,
	clearAuth,
	isLoggedIn,
	BASE_URL
}
