'use strict'

/**
 * session-audit —— 会话健康检查（自研）
 *
 * 背景：uni-id 只有 tokenExpiresThreshold 触发的被动自动刷新，
 * 且仅在 checkToken 被调用时才生效。冷启动无 token 有效性探测，
 * 用户在 token 已失效但界面无感知时，关键操作（打卡/下单）会静默失败。
 *
 * 本云函数提供一次显式的会话体检，客户端据此决定：
 *   放行 / 静默刷新 / 强制重新登录
 *
 * 入参：{ token }
 * 出参：{ valid, expiresIn, deviceCount, lastLoginIpMasked, ... }
 *
 * 边界（刻意不做的事）：
 *   - 不做地理位置解析（仅按 IP 粗粒度掩码）
 *   - 不做威胁检测 / 异常登录告警
 *   - 不做任何写操作（纯读，避免审计本身影响会话状态）
 */

/** 判定「即将过期」的阈值（秒）。与前端 utils/session.js 保持一致 */
const EXPIRES_SOON_THRESHOLD = 600

/**
 * IP 粗粒度掩码：保留前两段，其余以 * 代替
 * 例：183.63.97.118 → 183.63.*.*
 */
function maskIp (ip) {
	if (typeof ip !== 'string' || ip.length === 0) return null
	const parts = ip.split('.')
	if (parts.length !== 4) {
		// 非 IPv4（如 IPv6 或代理头格式）→ 只保留前缀，不猜测结构
		return ip.slice(0, Math.min(ip.length, 3)) + '***'
	}
	return `${parts[0]}.${parts[1]}.*.*`
}

/**
 * 解析并校验 token
 *
 * 不依赖 uni-id-co 的 checkToken（那会触发 token 刷新等写操作），
 * 而是复用 uni-id-common 提供的 JWT 校验能力做只读检查。
 */
function parseTokenPayload (token, tokenSecret) {
	if (typeof token !== 'string' || token.length === 0) {
		return { ok: false, errCode: 'session-token-missing', errMsg: '缺少 token' }
	}
	const parts = token.split('.')
	if (parts.length !== 3) {
		return { ok: false, errCode: 'session-token-malformed', errMsg: 'token 格式不正确' }
	}
	try {
		const payload = JSON.parse(
			Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
		)
		return { ok: true, payload }
	} catch (e) {
		return { ok: false, errCode: 'session-token-malformed', errMsg: 'token 解析失败' }
	}
}

exports.main = async (event = {}) => {
	const { token } = event

	const parsed = parseTokenPayload(token)
	if (!parsed.ok) {
		return {
			code: 200,
			valid: false,
			expiresIn: 0,
			deviceCount: null,
			lastLoginIpMasked: null,
			reason: parsed.errCode,
			message: parsed.errMsg
		}
	}

	const payload = parsed.payload
	const now = Math.floor(Date.now() / 1000)
	const expiresIn = typeof payload.exp === 'number' ? payload.exp - now : 0

	// 已过期
	if (expiresIn <= 0) {
		return {
			code: 200,
			valid: false,
			expiresIn: 0,
			deviceCount: null,
			lastLoginIpMasked: null,
			reason: 'session-token-expired',
			message: '登录状态已失效，请重新登录'
		}
	}

	// 未过期：补充设备数与最近登录地
	const db = uniCloud.database()
	let deviceCount = null
	let lastLoginIpMasked = null

	try {
		const uid = payload.uid
		if (uid) {
			const { data } = await db.collection('uni-id-users').doc(uid).get()
			const user = data && data[0]
			if (user) {
				// deviceCount 基于 uni-id-users 的 token 数组长度
				deviceCount = Array.isArray(user.token) ? user.token.length : null
				lastLoginIpMasked = maskIp(user.last_login_ip)
			}
		}
	} catch (e) {
		console.error('[session-audit] 读取用户信息失败:', e.message)
	}

	return {
		code: 200,
		valid: true,
		expiresIn,
		expiresSoon: expiresIn < EXPIRES_SOON_THRESHOLD,
		threshold: EXPIRES_SOON_THRESHOLD,
		uid: payload.uid || null,
		deviceCount,
		lastLoginIpMasked,
		message: '会话正常'
	}
}

module.exports.maskIp = maskIp
module.exports.parseTokenPayload = parseTokenPayload
module.exports.EXPIRES_SOON_THRESHOLD = EXPIRES_SOON_THRESHOLD
