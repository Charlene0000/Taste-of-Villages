'use strict'

/**
 * 认证路由 —— 发送验证码 / 登录注册
 *
 * 完整延续 Sprint 1 的安全设计：
 *   ① 手机号严格校验      ② CSPRNG 验证码
 *   ③ 60 秒 + 单日 10 次频控   ④ 连错 5 次锁定
 *
 * 与原 uniCloud 版 auth-gateway 的差别只在传输层：
 *   云函数 callFunction → HTTP POST
 *   返回结构保持 { code, errCode, errMsg } 的形状，
 *   便于前端 request.js 统一处理。
 */

const express = require('express')
const bcrypt = require('bcryptjs')
const { getPrisma } = require('../db')
const { config } = require('../config')
const { sign } = require('../middleware/auth')
const security = require('../utils/security')

const router = express.Router()

/**
 * POST /api/auth/send-code
 * 发送短信验证码
 */
router.post('/send-code', async (req, res) => {
	try {
		const { mobile, scene = 'login' } = req.body || {}

		// ① 手机号严格校验（数组/数字/null 一律拒绝）
		const check = security.validateMobile(mobile)
		if (!check.ok) {
			return res.status(400).json({
				code: 400,
				errCode: check.errCode,
				errMsg: check.errMsg
			})
		}

		const prisma = getPrisma()
		const now = new Date()

		// ③ 发送频率限制：60 秒一次 + 单日上限
		const rate = await security.checkRateLimit(prisma, check.mobile, scene, now)
		if (!rate.allowed) {
			return res.status(429).json({
				code: 429,
				errCode: rate.errCode,
				errMsg: rate.errMsg,
				retryAfter: rate.retryAfter || 0
			})
		}

		// ② CSPRNG 生成验证码
		const code = security.generateVerifyCode(6)

		// 保存验证码 + 频控计数
		await security.saveCode(
			prisma,
			check.mobile,
			scene,
			code,
			now,
			req.ip || ''
		)

		// 开发模式：不真实发短信，直接返回 devCode
		if (config.devMode) {
			console.log(`[auth] devCode(mobile=${check.mobile}, scene=${scene}) = ${code}`)
			return res.json({
				code: 200,
				message: '验证码已生成（开发模式）',
				devCode: code,
				expiresIn: security.CODE_EXPIRES_IN
			})
		}

		// 生产模式：此处接入真实短信服务商
		// 未接入时明确报错，不返回 devCode，避免泄露
		return res.status(503).json({
			code: 503,
			errCode: 'auth-sms-not-configured',
			errMsg: '短信服务未配置，请在 server/.env 中配置短信服务商'
		})
	} catch (e) {
		console.error('[auth] send-code 异常:', e)
		return res.status(500).json({
			code: 500,
			errCode: 'auth-internal-error',
			errMsg: '服务器内部错误'
		})
	}
})

/**
 * POST /api/auth/login
 * 验证码登录 / 注册（用户不存在时自动创建）
 */
router.post('/login', async (req, res) => {
	try {
		const { mobile, code, password } = req.body || {}

		// ① 手机号严格校验
		const check = security.validateMobile(mobile)
		if (!check.ok) {
			return res.status(400).json({
				code: 400,
				errCode: check.errCode,
				errMsg: check.errMsg
			})
		}

		const prisma = getPrisma()
		const now = new Date()

		let user = null
		let isNewUser = false

		// 验证码登录路径
		if (code) {
			// ④ 错误次数锁定 + 过期校验
			const verify = await security.verifyCode(prisma, check.mobile, 'login', code, now)
			if (!verify.ok) {
				return res.status(400).json({
					code: 400,
					errCode: verify.errCode,
					errMsg: verify.errMsg,
					remainingAttempts: verify.remainingAttempts || 0
				})
			}

			// 验证码通过，标记为已使用
			await prisma.verifyCode.update({
				where: { id: verify.record.id },
				data: { used: true }
			})

			// 用户不存在则自动创建（注册逻辑）
			user = await prisma.user.findUnique({
				where: { mobile: check.mobile }
			})
			if (!user) {
				user = await prisma.user.create({
					data: {
						mobile: check.mobile,
						nickname: '用户' + check.mobile.slice(-4),
						source: 'sms',
						registerDate: now
					}
				})
				isNewUser = true
			}
		}
		// 密码登录路径
		else if (password) {
			if (typeof password !== 'string' || password.length < 6) {
				return res.status(400).json({
					code: 400,
					errCode: 'auth-invalid-password',
					errMsg: '密码至少 6 位'
				})
			}
			user = await prisma.user.findUnique({
				where: { mobile: check.mobile }
			})
			if (!user || !user.password) {
				return res.status(400).json({
					code: 400,
					errCode: 'auth-account-not-exists',
					errMsg: '账号不存在或尚未设置密码'
				})
			}
			const match = await bcrypt.compare(password, user.password)
			if (!match) {
				return res.status(400).json({
					code: 400,
					errCode: 'auth-password-mismatch',
					errMsg: '手机号或密码不正确'
				})
			}
		} else {
			return res.status(400).json({
				code: 400,
				errCode: 'auth-missing-credential',
				errMsg: '请提供验证码或密码'
			})
		}

		// 更新登录信息（login_count 延续原设计）
		const updated = await prisma.user.update({
			where: { id: user.id },
			data: {
				loginCount: { increment: 1 },
				lastLoginAt: now,
				lastLoginIp: req.ip || ''
			}
		})

		// 签发 JWT
		const token = sign({
			uid: updated.id,
			mobile: updated.mobile,
			nickname: updated.nickname
		})

		return res.json({
			code: 200,
			message: isNewUser ? '注册并登录成功' : '登录成功',
			token,
			expiresIn: config.jwtExpiresIn,
			isNewUser,
			user: {
				id: updated.id,
				mobile: updated.mobile,
				nickname: updated.nickname,
				avatar: updated.avatar,
				loginCount: updated.loginCount,
				registerDate: updated.registerDate,
				lastLoginAt: updated.lastLoginAt,
				source: updated.source,
				points: updated.points,
				score: updated.score
			}
		})
	} catch (e) {
		console.error('[auth] login 异常:', e)
		return res.status(500).json({
			code: 500,
			errCode: 'auth-internal-error',
			errMsg: '服务器内部错误'
		})
	}
})

/**
 * POST /api/auth/register
 * 显式注册（设置密码）
 */
router.post('/register', async (req, res) => {
	try {
		const { mobile, password, nickname } = req.body || {}
		const check = security.validateMobile(mobile)
		if (!check.ok) {
			return res.status(400).json({
				code: 400,
				errCode: check.errCode,
				errMsg: check.errMsg
			})
		}
		if (typeof password !== 'string' || password.length < 6) {
			return res.status(400).json({
				code: 400,
				errCode: 'auth-invalid-password',
				errMsg: '密码至少 6 位'
			})
		}

		const prisma = getPrisma()
		const exist = await prisma.user.findUnique({ where: { mobile: check.mobile } })
		if (exist) {
			return res.status(400).json({
				code: 400,
				errCode: 'auth-account-exists',
				errMsg: '该手机号已注册'
			})
		}

		const hash = await bcrypt.hash(password, 10)
		const user = await prisma.user.create({
			data: {
				mobile: check.mobile,
				password: hash,
				nickname: nickname || ('用户' + check.mobile.slice(-4)),
				source: 'register',
				registerDate: new Date()
			}
		})

		const token = sign({
			uid: user.id,
			mobile: user.mobile,
			nickname: user.nickname
		})

		return res.json({
			code: 200,
			message: '注册成功',
			token,
			expiresIn: config.jwtExpiresIn,
			user: {
				id: user.id,
				mobile: user.mobile,
				nickname: user.nickname,
				avatar: user.avatar,
				loginCount: user.loginCount
			}
		})
	} catch (e) {
		console.error('[auth] register 异常:', e)
		return res.status(500).json({
			code: 500,
			errCode: 'auth-internal-error',
			errMsg: '服务器内部错误'
		})
	}
})

/**
 * POST /api/auth/logout
 * 登出（JWT 无状态，服务端只需返回成功，前端清除本地 token）
 */
router.post('/logout', (req, res) => {
	res.json({ code: 200, message: '已登出' })
})

module.exports = router
