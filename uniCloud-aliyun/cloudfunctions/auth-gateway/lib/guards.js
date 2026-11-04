'use strict'

/**
 * auth-gateway 安全闸（自研）
 *
 * 职责：在请求到达 uni-id-co 之前，完成四项安全加固。
 * 本模块不重写 uni-id 的业务逻辑，只做「拦截 / 加固 / 放行」。
 *
 * ① 手机号严格类型校验 —— 拒绝数组、数字、null 等异常输入
 * ② CSPRNG 验证码生成   —— 用 crypto.randomInt，不使用 Math.random
 * ③ 发送频率限制       —— 同手机号 60 秒一次、单日上限 10 次
 * ④ 错误次数锁定       —— 同一验证码连错 5 次后作废，必须重新获取
 */

const crypto = require('crypto')

const RATE_LIMIT_COLLECTION = 'auth-sms-rate-limit'
const VERIFY_CODE_COLLECTION = 'opendb-verify-codes'

/** 发送间隔：60 秒 */
const SEND_INTERVAL_MS = 60 * 1000
/** 单日发送上限 */
const DAILY_LIMIT = 10
/** 单个验证码最大错误次数 */
const MAX_ATTEMPTS = 5
/** 验证码有效期（秒），与 uni-id 的 login-by-sms 场景保持一致 */
const CODE_EXPIRES_IN = 240

const MOBILE_PATTERN = /^1[3-9]\d{9}$/

/**
 * ① 手机号严格校验
 *
 * 关键点：必须先判 typeof，再判正则。
 * uni-id 侧的 setMobileVerifyCode 会对入参直接调用 .trim()，
 * 传入数组会抛 TypeError（未捕获异常）。这里提前拦掉。
 *
 * @returns {{ ok: boolean, mobile?: string, errCode?: string, errMsg?: string }}
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
	if (Array.isArray(v)) return 'array'
	return typeof v
}

/**
 * ② CSPRNG 生成 6 位数字验证码
 *
 * 使用 crypto.randomInt(0, 10) 逐位生成。
 * 相比 Math.random()：后者是 PRNG，在 V8 的 xorshift128+ 实现下，
 * 采集足够多的输出样本后可反推内部状态，导致验证码可预测。
 *
 * @param {number} length 长度
 * @returns {string}
 */
function generateVerifyCode (length = 6) {
	let code = ''
	for (let i = 0; i < length; i++) {
		code += crypto.randomInt(0, 10)
	}
	return code
}

/** 取当天日期字符串，作为单日计数的分桶键 */
function todayKey (now = Date.now()) {
	const d = new Date(now)
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}

/**
 * ③ 发送频率限制检查
 *
 * 计数存放在独立集合 auth-sms-rate-limit，按 mobile+scene 聚合，
 * 记录 lastSendAt（上次发送时间）与 dayCount（当日已发送次数）。
 *
 * @param {object} db uniCloud.database()
 * @param {string} mobile 手机号
 * @param {string} scene 场景
 * @param {number} now 当前时间戳
 */
async function checkRateLimit (db, mobile, scene, now = Date.now()) {
	const collection = db.collection(RATE_LIMIT_COLLECTION)
	const docId = `${scene}_${mobile}`
	const { data } = await collection.doc(docId).get()
	const record = data && data[0]

	if (!record) {
		return { allowed: true, docId, remainingToday: DAILY_LIMIT - 1 }
	}

	const today = todayKey(now)
	const lastSendAt = record.lastSendAt || 0
	const elapsed = now - lastSendAt

	// 60 秒内不允许重复发送
	if (elapsed < SEND_INTERVAL_MS) {
		const waitSeconds = Math.ceil((SEND_INTERVAL_MS - elapsed) / 1000)
		return {
			allowed: false,
			docId,
			errCode: 'auth-sms-too-frequent',
			errMsg: `发送过于频繁，请 ${waitSeconds} 秒后重试`,
			retryAfter: waitSeconds
		}
	}

	// 单日上限
	const dayCount = record.day === today ? (record.dayCount || 0) : 0
	if (dayCount >= DAILY_LIMIT) {
		return {
			allowed: false,
			docId,
			errCode: 'auth-sms-daily-limit',
			errMsg: `今日验证码发送次数已达上限（${DAILY_LIMIT} 次），请明日再试`
		}
	}

	return { allowed: true, docId, remainingToday: DAILY_LIMIT - dayCount - 1 }
}

/**
 * 记录一次发送（频控计数落库）
 */
async function recordSend (db, mobile, scene, now = Date.now()) {
	const collection = db.collection(RATE_LIMIT_COLLECTION)
	const docId = `${scene}_${mobile}`
	const today = todayKey(now)
	const { data } = await collection.doc(docId).get()
	const record = data && data[0]
	const dayCount = record && record.day === today ? (record.dayCount || 0) : 0

	await collection.doc(docId).set({
		mobile,
		scene,
		lastSendAt: now,
		day: today,
		dayCount: dayCount + 1
	})
}

/**
 * 写入验证码记录（自研字段：attempts 错误计数）
 *
 * 复用 uni-id 的 opendb-verify-codes 集合与字段语义：
 *   state: 0 未验证 / 1 已验证 / 2 已作废
 * 这样既能被 uni-id 的 verifyMobileCode 识别，也保留了自研的锁定能力。
 */
async function saveVerifyCode (db, mobile, scene, code, now = Date.now()) {
	const collection = db.collection(VERIFY_CODE_COLLECTION)
	// 同手机号同场景的历史验证码全部作废，避免多个有效码并存
	await collection.where({
		mobile,
		scene,
		state: 0
	}).update({
		state: 2
	})

	await collection.add({
		mobile,
		scene,
		code,
		state: 0,
		attempts: 0,
		create_date: now,
		expired_date: now + CODE_EXPIRES_IN * 1000,
		ip: ''
	})
}

/**
 * ④ 校验验证码并累计错误次数
 *
 * 逻辑：
 *   - 找出该手机号+场景下未验证且未过期的记录
 *   - attempts >= MAX_ATTEMPTS → 该记录已被锁定，直接拒绝
 *   - 码不匹配 → attempts +1；若达到上限则置 state=2（作废）
 *   - 码匹配   → 放行（不消费，由 uni-id 侧消费）
 *
 * @returns {{ ok: boolean, errCode?: string, errMsg?: string }}
 */
async function verifyCode (db, mobile, scene, code, now = Date.now()) {
	if (typeof code !== 'string' || !/^\d{4,8}$/.test(code)) {
		return {
			ok: false,
			errCode: 'auth-invalid-code-format',
			errMsg: '验证码格式不正确'
		}
	}

	const collection = db.collection(VERIFY_CODE_COLLECTION)
	const { data } = await collection.where({
		mobile,
		scene,
		state: 0,
		expired_date: db.command.gt(now)
	}).get()

	const records = data || []
	if (records.length === 0) {
		return {
			ok: false,
			errCode: 'auth-code-invalid-or-expired',
			errMsg: '验证码无效或已过期，请重新获取'
		}
	}

	const record = records[0]
	const attempts = record.attempts || 0

	// 已因错误次数过多被锁定，必须重新获取
	if (attempts >= MAX_ATTEMPTS) {
		await collection.doc(record._id).update({ state: 2 })
		return {
			ok: false,
			errCode: 'auth-code-locked',
			errMsg: `验证码错误次数已达上限（${MAX_ATTEMPTS} 次），请重新获取`
		}
	}

	if (record.code !== code) {
		const newAttempts = attempts + 1
		const shouldInvalidate = newAttempts >= MAX_ATTEMPTS
		await collection.doc(record._id).update({
			attempts: newAttempts,
			state: shouldInvalidate ? 2 : 0
		})
		return {
			ok: false,
			errCode: 'auth-code-mismatch',
			errMsg: shouldInvalidate
				? `验证码错误次数已达上限（${MAX_ATTEMPTS} 次），请重新获取`
				: `验证码错误，还可尝试 ${MAX_ATTEMPTS - newAttempts} 次`,
			remainingAttempts: MAX_ATTEMPTS - newAttempts,
			attempts: newAttempts
		}
	}

	return { ok: true, attempts, record }
}

module.exports = {
	validateMobile,
	generateVerifyCode,
	checkRateLimit,
	recordSend,
	saveVerifyCode,
	verifyCode,
	todayKey,
	RATE_LIMIT_COLLECTION,
	VERIFY_CODE_COLLECTION,
	SEND_INTERVAL_MS,
	DAILY_LIMIT,
	MAX_ATTEMPTS,
	CODE_EXPIRES_IN
}
