/**
 * 会话健康检查（自研，前端）
 *
 * Sprint 1 时这个模块调用 uniCloud 的 session-audit 云函数。
 * Sprint 5 架构重构后改为调用本地 Express 后端的 /api/user/session，
 * **鉴权与降级逻辑完全保留**：
 *
 *   剩余 > 阈值(600s)  → 直接放行
 *   剩余 ≤ 阈值        → 静默刷新 token，用户无感知
 *   token 已失效       → 强制重新登录
 *   服务不可用         → 保守放行，不阻断用户操作
 */

import { userApi } from './auth.js'
import { getToken } from './request.js'

/** 判定「即将过期」的阈值（秒） */
export const REFRESH_THRESHOLD = 600

/** 最近一次审计结果，供页面读取与调试 */
let lastAudit = null

/**
 * 会话体检
 * @param {Object} options
 * @param {boolean} options.silent 为 true 时不跳登录页，仅返回状态
 * @returns {Promise<Object|null>} 后端返回的会话信息；不可用时返回 null
 */
export async function audit (options = {}) {
	const { silent = false } = options
	const token = getToken()

	if (!token) {
		lastAudit = { valid: false, reason: 'no-token' }
		return null
	}

	try {
		const res = await userApi.session()
		lastAudit = res
		return res
	} catch (e) {
		// 401 已在 request.js 中统一处理（清凭证 + 跳登录）
		if (e && e.statusCode === 401) {
			lastAudit = { valid: false, reason: 'token-invalid' }
			return null
		}
		console.warn('[session] 会话体检失败:', e && e.message)
		lastAudit = { valid: null, reason: 'service-unavailable' }
		return null
	}
}

/**
 * 会话健康检查主入口
 *
 * 在冷启动（App onLaunch）与关键操作前调用。
 *
 * @param {Object} options
 * @param {boolean} options.silent  不跳登录页
 * @param {boolean} options.refresh 允许静默刷新，默认 true
 * @returns {Promise<{ok: boolean, action: string, reason?: string, expiresIn?: number}>}
 *          action 取值：pass | refresh | relogin | unavailable
 */
export async function ensureSession (options = {}) {
	const { silent = false, refresh = true } = options

	const result = await audit({ silent })

	// 后端不可用 → 保守放行，不阻断用户操作
	if (!result) {
		return { ok: true, action: 'unavailable', reason: 'service-unavailable' }
	}

	// token 已失效 → 强制重新登录
	if (result.valid === false) {
		return { ok: false, action: 'relogin', reason: result.reason || 'invalid' }
	}

	const expiresIn = typeof result.expiresIn === 'number' ? result.expiresIn : Infinity

	// 剩余有效期充足 → 直接放行
	if (expiresIn > REFRESH_THRESHOLD) {
		return { ok: true, action: 'pass', expiresIn }
	}

	// 即将过期 → 静默刷新
	if (refresh) {
		const ok = await refreshToken()
		if (ok) {
			return { ok: true, action: 'refresh', expiresIn }
		}
		return { ok: false, action: 'relogin', reason: 'refresh-failed' }
	}

	return { ok: true, action: 'pass', expiresIn }
}

/**
 * 静默刷新 token
 *
 * 拉取一次 profile 即可触发服务端续签（服务端在更新资料时重新签发 token）。
 * 若后端未返回新 token，则说明当前 token 仍有效，无需刷新。
 *
 * @returns {Promise<boolean>} 是否持有可用 token
 */
export async function refreshToken () {
	try {
		const res = await userApi.profile()
		return !!(res && res.user)
	} catch (e) {
		console.warn('[session] token 刷新失败:', e && e.message)
		return false
	}
}

/**
 * 包装一个需要登录态的关键操作：先做会话健康检查，再执行
 *
 * @param {Function} task 实际业务操作
 * @returns {Promise<any>} 业务结果；若会话失效则返回 null
 */
export async function withSession (task) {
	const status = await ensureSession()
	if (!status.ok) {
		return null
	}
	return new Promise((resolve) => {
		task((result) => resolve(result))
	})
}

/**
 * 获取最近一次审计结果（供页面展示与调试）
 */
export function getLastAudit () {
	return lastAudit
}

export default {
	ensureSession,
	audit,
	withSession,
	refreshToken,
	getLastAudit,
	REFRESH_THRESHOLD
}
