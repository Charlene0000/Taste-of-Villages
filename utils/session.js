/**
 * 会话健康检查层（自研，前端）
 *
 * 设计动机
 * --------
 * uni-id 只有 tokenExpiresThreshold 触发的被动自动刷新，且仅在 checkToken
 * 被调用时生效。实际使用中会出现两类问题：
 *
 *   ① 冷启动场景：App 被系统回收后重新拉起，token 可能已过期，
 *      但界面不感知，用户点「打卡」才发现失败；
 *   ② 关键操作场景：token 在用户停留期间过期，写操作中途失败，
 *      用户已经填了表单却要重来。
 *
 * 机制
 * ----
 * 冷启动与关键操作前调用 session-audit 云函数，按返回的剩余有效期决策：
 *
 *   剩余 > 阈值(600s)  → 直接放行
 *   剩余 ≤ 阈值        → 静默刷新 token，用户无感知
 *   token 已失效       → 强制重新登录
 *
 * 边界条件
 * --------
 *   - session-audit 不可用（网络异常/云函数未部署）→ 保守放行，
 *     不阻断用户操作（可用性优先，安全性由后端兜底）
 *   - 已在登录页 → 不重复跳转，避免循环
 *   - 刷新失败 → 视为登录态失效，走重新登录
 */

const AUDIT_FUNCTION = 'session-audit'
const REFRESH_THRESHOLD = 600
const LOGIN_PAGE = '/uni_modules/uni-id-pages/pages/login/login-withoutpwd'

/** 记录本次会话的审计结果，供页面读取与调试 */
let lastAudit = null

/**
 * 从 storage 中取出当前 token
 * @returns {string} token 字符串，无则为空串
 */
function getToken () {
	try {
		return uni.getStorageSync('uni-id-token') || ''
	} catch (e) {
		return ''
	}
}

/**
 * 调用 session-audit 云函数
 * @param {string} token
 * @returns {Promise<Object|null>} 审计结果；不可用时返回 null
 */
function callAudit (token) {
	return new Promise((resolve) => {
		uniCloud.callFunction({
			name: AUDIT_FUNCTION,
			data: { token }
		}).then((res) => {
			const result = res && res.result
			if (result && typeof result === 'object') {
				resolve(result)
			} else {
				resolve(null)
			}
		}).catch((e) => {
			console.warn('[session] session-audit 调用失败:', e && e.message)
			resolve(null)
		})
	})
}

/**
 * 静默刷新 token
 * @returns {Promise<boolean>} 是否刷新成功
 */
function refreshToken () {
	return new Promise((resolve) => {
		uniCloud.importObject('uni-id-co', {
			customUI: true
		}).refreshToken({
			token: getToken()
		}).then((res) => {
			if (res && res.token && res.tokenExpired) {
				uni.setStorageSync('uni-id-token', res.token)
				uni.setStorageSync('uni_id_token_expired', res.tokenExpired)
				resolve(true)
			} else {
				resolve(false)
			}
		}).catch((e) => {
			console.warn('[session] token 刷新失败:', e && e.message)
			resolve(false)
		})
	})
}

/**
 * 跳转登录页
 */
function redirectToLogin (reason) {
	// 避免重复跳转造成循环
	const pages = getCurrentPages()
	const current = pages.length ? pages[pages.length - 1].route : ''
	if (current && current.indexOf('login') !== -1) {
		return
	}
	console.warn('[session] 需要重新登录:', reason)
	uni.navigateTo({
		url: LOGIN_PAGE,
		fail: () => {
			uni.reLaunch({ url: LOGIN_PAGE })
		}
	})
}

/**
 * 会话健康检查主入口
 *
 * 在冷启动（App onLaunch）与关键操作（写操作）前调用。
 *
 * @param {Object} options
 * @param {boolean} options.silent  为 true 时不跳转登录页，仅返回状态
 * @param {boolean} options.refresh 为 true 时允许静默刷新（默认 true）
 * @returns {Promise<{ ok: boolean, action: string, reason?: string, expiresIn?: number }>}
 *          action 取值：pass | refresh | relogin | unavailable
 */
export async function ensureSession (options = {}) {
	const { silent = false, refresh = true } = options

	const token = getToken()
	if (!token) {
		lastAudit = { valid: false, reason: 'no-token' }
		if (!silent) redirectToLogin('无本地 token')
		return { ok: false, action: 'relogin', reason: 'no-token' }
	}

	const audit = await callAudit(token)

	// 云函数不可用 → 保守放行，不阻断用户操作
	if (!audit) {
		lastAudit = { valid: null, reason: 'audit-unavailable' }
		return { ok: true, action: 'unavailable', reason: 'audit-unavailable' }
	}

	lastAudit = audit

	// token 已失效 → 强制重新登录
	if (audit.valid === false) {
		if (!silent) redirectToLogin(audit.reason || 'token 失效')
		return { ok: false, action: 'relogin', reason: audit.reason || 'invalid' }
	}

	const expiresIn = typeof audit.expiresIn === 'number' ? audit.expiresIn : Infinity

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
		// 刷新失败 → 视为失效
		if (!silent) redirectToLogin('token 刷新失败')
		return { ok: false, action: 'relogin', reason: 'refresh-failed' }
	}

	// 调用方明确禁止刷新（如正在展示登录页）
	return { ok: true, action: 'pass', expiresIn }
}

/**
 * 包装一个需要登录态的关键操作：先做会话健康检查，再执行
 *
 * @param {Function} task 实际业务操作，接收一个 done 回调
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

/**
 * 供页面在 onLoad 中直接挂载使用
 */
export default {
	ensureSession,
	withSession,
	getLastAudit,
	REFRESH_THRESHOLD
}
