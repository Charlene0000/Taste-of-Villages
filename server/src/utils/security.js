'use strict'

/**
 * 安全工具（自研）
 *
 * 完整延续 Sprint 1 在 uni-id 之上补齐的四项安全设计，
 * 并按新的技术栈重新实现：
 *
 *   ① 手机号严格类型校验 —— 拒绝数组 / 数字 / null 等异常输入
 *   ② CSPRNG 验证码生成 —— crypto.randomInt，不使用 Math.random
 *   ③ 发送频率限制       —— 同号 60 秒一次 + 单日上限 10 次
 *   ④ 错误次数锁定       —— 连错 5 次后验证码作废，必须重新获取
 *
 * 与原实现的一致性说明：
 *   - 频控与锁定状态从「独立集合 + 扩展字段」改为「VerifyCode 表的字段」，
 *     因为 SQLite 单文件数据库下用关系表更自然，且事务性更好
 *   - 错误次数上限仍为 5，验证码有效期仍为 240 秒
 */

const crypto = require('crypto')

/** 发送间隔：60 秒 */
const SEND_INTERVAL_MS = 60 * 1000
/** 单日发送上限 */
const DAILY_LIMIT = 10
/** 单个验证码最大错误次数 */
const MAX_ATTEMPTS = 5
/** 验证码有效期（秒） */
const CODE_EXPIRES_IN = 240

const MOBILE_PATTERN = /^1[3-9]\d{9}$/

/**
 * ① 手机号严格校验
 *
 * 关键点：必须先判 typeof，再判正则。
 * 数组 / 数字 / null 全部在入口处被拒绝，不会流到下游。
 *
 * @param {*} mobile
 * @returns {{ok: boolean, mobile?: string, errCode?: string, errMsg?: string}}
 */
function validateMobile (mobile) {
	if (typeof mobile !== 'string') {
		return {
			ok: false,
			errCode: 'auth-invalid-mobile-type',
			errMsg: '手机号必须为字符串类型，收到 ' + describeType(mobile)
		}
	}
	const trimmed = mobile.trim()
	if (!MOBILE_PATTERN.test(trimmed)) {
		return {
			ok: false,
			errCode: 'auth-invalid-mobile',
			errMsg: '手机号格式不正确，应为 11 位中国大陆手机号'
		}
	}
	return { ok: true, mobile: trimmed }
}

function describeType (v) {
	if (v === null) return 'null'
	if (v === undefined) return 'undefined'
	if (Array.isArray(v)) return 'array'
	return typeof v
}

/**
 * ② CSPRNG 生成 6 位数字验证码
 *
 * crypto.randomInt 是密码学安全随机数发生器。
 * 相比 Math.random()（PRNG），后者在 V8 的 xorshift128+ 实现下
 * 可通过足够多的输出样本反推内部状态，导致验证码可预测。
 *
 * @param {number} length
 * @returns {string}
 */
function generateVerifyCode (length = 6) {
	let code = ''
	for (let i = 0; i < length; i++) {
		code += crypto.randomInt(0, 10)
	}
	return code
}

/**
 * 取当天日期字符串，作为单日计数的分桶键
 */
function todayKey (now = new Date()) {
	const y = now.getFullYear()
	const m = String(now.getMonth() + 1).padStart(2, '0')
	const d = String(now.getDate()).padStart(2, '0')
	return `${y}-${m}-${d}`
}

/**
 * ③ 发送频率限制检查
 *
 * @param {Object} prisma Prisma 客户端
 * @param {string} mobile
 * @param {string} scene
 * @param {Date} now
 * @returns {Promise<{allowed: boolean, errCode?: string, errMsg?: string, retryAfter?: number}>}
 */
async function checkRateLimit (prisma, mobile, scene, now = new Date()) {
	// 找出该手机号+场景下最近一条记录（不论是否已用）
	const recent = await prisma.verifyCode.findFirst({
		where: { mobile, scene },
		orderBy: { createdAt: 'desc' }
	})

	if (!recent) {
		return { allowed: true }
	}

	// 60 秒间隔
	const lastSend = recent.lastSendAt || recent.createdAt
	const elapsed = now.getTime() - new Date(lastSend).getTime()
	if (elapsed < SEND_INTERVAL_MS) {
		const waitSeconds = Math.ceil((SEND_INTERVAL_MS - elapsed) / 1000)
		return {
			allowed: false,
			errCode: 'auth-sms-too-frequent',
			errMsg: `发送过于频繁，请 ${waitSeconds} 秒后重试`,
			retryAfter: waitSeconds
		}
	}

	// 单日上限（跨日自动重置）
	const today = todayKey(now)
	const dayCount = recent.day === today ? (recent.dayCount || 0) : 0
	if (dayCount >= DAILY_LIMIT) {
		return {
			allowed: false,
			errCode: 'auth-sms-daily-limit',
			errMsg: `今日验证码发送次数已达上限（${DAILY_LIMIT} 次），请明日再试`
		}
	}

	return { allowed: true }
}

/**
 * ③ 保存验证码并记录发送频控
 *
 * 设计说明：验证码与频控计数放在同一条记录上。
 *   - 每次发送创建一条新记录（新验证码），旧记录自然过期
 *   - lastSendAt / day / dayCount 记录在最新一条上，用于频控判定
 *   - 这样避免了「频控记录」与「验证码记录」两张表的关联与同步问题
 *
 * @param {Object} prisma
 * @param {string} mobile
 * @param {string} scene
 * @param {string} code 6 位验证码
 * @param {Date} now
 * @param {string} ip
 */
async function saveCode (prisma, mobile, scene, code, now = new Date(), ip = '') {
	const today = todayKey(now)

	// 统计当日已发送次数（不含本次）
	const todayRecords = await prisma.verifyCode.count({
		where: {
			mobile,
			scene,
			day: today
		}
	})

	return prisma.verifyCode.create({
		data: {
			mobile,
			scene,
			code,
			attempts: 0,
			maxAttempts: MAX_ATTEMPTS,
			expireAt: new Date(now.getTime() + CODE_EXPIRES_IN * 1000),
			used: false,
			lastSendAt: now,
			day: today,
			dayCount: todayRecords + 1,
			ip
		}
	})
}

/**
 * ④ 校验验证码并累计错误次数
 *
 * 逻辑：
 *   - 找出该手机号+场景下未使用且未过期的记录
 *   - attempts >= maxAttempts → 该验证码已被锁定，直接拒绝
 *   - 码不匹配 → attempts + 1；达到上限则标记 used（作废）
 *   - 码匹配   → 放行（由调用方标记 used）
 *
 * @returns {Promise<{ok: boolean, errCode?: string, errMsg?: string, remainingAttempts?: number, record?: Object}>}
 */
async function verifyCode (prisma, mobile, scene, code, now = new Date()) {
	if (typeof code !== 'string' || !/^\d{4,8}$/.test(code)) {
		return {
			ok: false,
			errCode: 'auth-invalid-code-format',
			errMsg: '验证码格式不正确'
		}
	}

	const record = await prisma.verifyCode.findFirst({
		where: {
			mobile,
			scene,
			used: false,
			expireAt: { gt: now }
		},
		orderBy: { createdAt: 'desc' }
	})

	if (!record) {
		return {
			ok: false,
			errCode: 'auth-code-invalid-or-expired',
			errMsg: '验证码无效或已过期，请重新获取'
		}
	}

	// 已因错误次数过多被锁定
	if (record.attempts >= record.maxAttempts) {
		await prisma.verifyCode.update({
			where: { id: record.id },
			data: { used: true }
		})
		return {
			ok: false,
			errCode: 'auth-code-locked',
			errMsg: `验证码错误次数已达上限（${record.maxAttempts} 次），请重新获取`
		}
	}

	if (record.code !== code) {
		const newAttempts = record.attempts + 1
		const shouldInvalidate = newAttempts >= record.maxAttempts
		await prisma.verifyCode.update({
			where: { id: record.id },
			data: {
				attempts: newAttempts,
				used: shouldInvalidate
			}
		})
		return {
			ok: false,
			errCode: 'auth-code-mismatch',
			errMsg: shouldInvalidate
				? `验证码错误次数已达上限（${record.maxAttempts} 次），请重新获取`
				: `验证码错误，还可尝试 ${record.maxAttempts - newAttempts} 次`,
			remainingAttempts: record.maxAttempts - newAttempts,
			attempts: newAttempts
		}
	}

	return { ok: true, record }
}

module.exports = {
	validateMobile,
	generateVerifyCode,
	checkRateLimit,
	saveCode,
	verifyCode,
	todayKey,
	describeType,
	SEND_INTERVAL_MS,
	DAILY_LIMIT,
	MAX_ATTEMPTS,
	CODE_EXPIRES_IN
}
