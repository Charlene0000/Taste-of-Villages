'use strict'

/**
 * 用户路由 —— 用户信息查询与修改
 *
 * 替代原 session-audit 的部分职责：
 *   - 原 session-audit 是「读」，返回 token 剩余有效期 / 设备数 / 登录地
 *   - 新 /api/user/profile 是「读+写」，返回并更新用户资料
 *
 * 登录态检查职责上移到前端 request.js：
 *   401 时自动清理本地 token 并跳登录页
 */

const express = require('express')
const { getPrisma } = require('../db')
const { requireAuth, sign, decode } = require('../middleware/auth')

const router = express.Router()

/**
 * 把 User 记录转成前端友好的形状
 */
function toProfile (user) {
	return {
		id: user.id,
		mobile: user.mobile,
		nickname: user.nickname,
		avatar: user.avatar,
		email: user.email,
		loginCount: user.loginCount,
		registerDate: user.registerDate,
		lastLoginAt: user.lastLoginAt,
		source: user.source,
		points: user.points,
		score: user.score,
		signinDate: user.signinDate,
		signinDays: user.signinDays
	}
}

/**
 * GET /api/user/profile
 * 获取当前登录用户的资料
 */
router.get('/profile', requireAuth, async (req, res) => {
	try {
		const prisma = getPrisma()
		const user = await prisma.user.findUnique({
			where: { id: req.user.uid }
		})
		if (!user) {
			return res.status(404).json({
				code: 404,
				errCode: 'user-not-found',
				errMsg: '用户不存在'
			})
		}
		return res.json({
			code: 200,
			message: '获取成功',
			user: toProfile(user)
		})
	} catch (e) {
		console.error('[user] profile 异常:', e)
		return res.status(500).json({
			code: 500,
			errCode: 'user-internal-error',
			errMsg: '服务器内部错误'
		})
	}
})

/**
 * PUT /api/user/profile
 * 更新当前登录用户的资料
 */
router.put('/profile', requireAuth, async (req, res) => {
	try {
		const { nickname, avatar, email } = req.body || {}

		// 只允许更新这三个字段，避免越权修改（loginCount / source 等由服务端维护）
		const data = {}
		if (typeof nickname === 'string' && nickname.trim()) {
			data.nickname = nickname.trim().slice(0, 32)
		}
		if (typeof avatar === 'string') {
			data.avatar = avatar.trim().slice(0, 500)
		}
		if (typeof email === 'string' && email.trim()) {
			data.email = email.trim().slice(0, 128)
		}

		if (!Object.keys(data).length) {
			return res.status(400).json({
				code: 400,
				errCode: 'user-nothing-to-update',
				errMsg: '没有需要更新的字段'
			})
		}

		const prisma = getPrisma()
		const user = await prisma.user.update({
			where: { id: req.user.uid },
			data
		})

		// 资料变更后重新签发 token，保证 JWT 里的 nickname 与库中一致
		const token = sign({
			uid: user.id,
			mobile: user.mobile,
			nickname: user.nickname
		})

		return res.json({
			code: 200,
			message: '更新成功',
			token,
			user: toProfile(user)
		})
	} catch (e) {
		console.error('[user] update profile 异常:', e)
		return res.status(500).json({
			code: 500,
			errCode: 'user-internal-error',
			errMsg: '服务器内部错误'
		})
	}
})

/**
 * GET /api/user/session
 * 会话体检 —— 替代原 session-audit
 *
 * 返回 token 的剩余有效期、是否即将过期，以及用户的登录信息。
 * 前端 utils/session.js 用它决定「放行 / 静默续期 / 强制重登」。
 */
router.get('/session', requireAuth, async (req, res) => {
	try {
		const payload = decode(req.token)
		const now = Math.floor(Date.now() / 1000)
		const expiresIn = payload && payload.exp ? payload.exp - now : 0
		const threshold = 600

		const prisma = getPrisma()
		const user = await prisma.user.findUnique({
			where: { id: req.user.uid },
			select: { id: true, loginCount: true, lastLoginAt: true, lastLoginIp: true }
		})

		return res.json({
			code: 200,
			valid: expiresIn > 0,
			expiresIn,
			expiresSoon: expiresIn > 0 && expiresIn < threshold,
			threshold,
			uid: req.user.uid,
			deviceCount: 1,
			lastLoginIpMasked: maskIp(user ? user.lastLoginIp : null),
			message: '会话正常'
		})
	} catch (e) {
		console.error('[user] session 异常:', e)
		return res.status(500).json({
			code: 500,
			errCode: 'user-internal-error',
			errMsg: '服务器内部错误'
		})
	}
})

/**
 * IP 粗粒度掩码：保留前两段
 */
function maskIp (ip) {
	if (typeof ip !== 'string' || !ip.length) return null
	const parts = ip.split('.')
	if (parts.length !== 4) {
		return ip.slice(0, Math.min(ip.length, 3)) + '***'
	}
	return `${parts[0]}.${parts[1]}.*.*`
}

module.exports = router
