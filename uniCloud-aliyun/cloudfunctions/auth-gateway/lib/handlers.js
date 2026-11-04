'use strict'

/**
 * auth-gateway 业务处理（自研）
 *
 * 与 index.js 分离，让 index.js 保持为「只做编排与转发」的薄层。
 */

const guards = require('./guards')

/**
 * 加载项目配置（密钥与开关统一由 app-config 提供）
 */
function loadAppConfig () {
	const candidates = ['app-config', '../common/app-config']
	for (const id of candidates) {
		try {
			return require(id).getConfig()
		} catch (e) {
			// 尝试下一个候选路径
		}
	}
	return {}
}

const CONFIG = loadAppConfig()

/**
 * 开发期模拟模式开关（数据化，不硬编码）
 *
 * 开启后：验证码不真实下发，而是写入云函数日志并在响应中返回 devCode，
 * 便于无短信服务商的开发环境自测。
 * 生产环境由 app-config 的 dev.simulateSms 控制，默认 false（关闭）。
 */
const DEV_MODE = !!(CONFIG.dev && CONFIG.dev.simulateSms)

/**
 * 转发到 uni-id-co 云对象。
 *
 * uni-id-co 的 _before 会执行 checkClientInfo，要求 uniPlatform 与 appId 必填，
 * 因此这里必须透传 clientInfo，否则转发会被客户端信息校验拦下。
 */
async function forwardToUniIdCo (action, params, context) {
	const uniIdCo = uniCloud.importObject('uni-id-co', {
		customUI: true
	})
	const clientInfo = (context && context.clientInfo) || {}
	return uniIdCo[action](Object.assign({}, params, {
		uniPlatform: clientInfo.uniPlatform || clientInfo.osName || 'mp-weixin',
		appId: clientInfo.appId || ''
	}))
}

/** 统一的结构化错误响应 */
function fail (errCode, errMsg, extra = {}) {
	return Object.assign({ code: 400, errCode, errMsg }, extra)
}

/**
 * 发送短信验证码：严格校验 → 频控检查 → CSPRNG 生成 → 落库 → 下发
 */
async function handleSendSmsCode (event, context) {
	const { mobile, scene = 'login-by-sms' } = event || {}

	// ① 手机号严格校验（拦截数组/数字/null）
	const check = guards.validateMobile(mobile)
	if (!check.ok) return fail(check.errCode, check.errMsg)

	const db = uniCloud.database()
	const now = Date.now()

	// ③ 发送频率限制：60 秒一次 + 单日上限
	const rate = await guards.checkRateLimit(db, check.mobile, scene, now)
	if (!rate.allowed) {
		return fail(rate.errCode, rate.errMsg, { retryAfter: rate.retryAfter || 0 })
	}

	// ② CSPRNG 生成验证码（不使用 Math.random）
	const code = guards.generateVerifyCode(6)
	await guards.saveVerifyCode(db, check.mobile, scene, code, now)
	await guards.recordSend(db, check.mobile, scene, now)

	if (DEV_MODE) {
		// 开发期模拟：验证码写入云函数日志并回传，便于自测
		console.log(`[auth-gateway][dev] 验证码(mobile=${check.mobile}, scene=${scene}) = ${code}`)
		return {
			code: 200,
			message: '验证码已生成（开发模拟模式）',
			devCode: code,
			expiresIn: guards.CODE_EXPIRES_IN
		}
	}

	try {
		const result = await forwardToUniIdCo('sendSmsCode', {
			mobile: check.mobile,
			scene
		}, context)
		return { code: 200, message: '验证码已发送', result, expiresIn: guards.CODE_EXPIRES_IN }
	} catch (e) {
		console.error('[auth-gateway] 短信下发失败:', e)
		return fail('auth-sms-send-failed', '验证码发送失败，请稍后重试')
	}
}

/**
 * 短信验证码登录：严格校验 → 错误次数锁定检查 → 转发 uni-id-co 签发 token
 */
async function handleLoginBySms (event, context) {
	const { mobile, code, captcha } = event || {}

	// ① 手机号严格校验
	const check = guards.validateMobile(mobile)
	if (!check.ok) return fail(check.errCode, check.errMsg)

	const db = uniCloud.database()
	const now = Date.now()

	// ④ 错误次数锁定：连错 5 次后该验证码作废
	const verify = await guards.verifyCode(db, check.mobile, 'login-by-sms', code, now)
	if (!verify.ok) {
		return fail(verify.errCode, verify.errMsg, {
			remainingAttempts: verify.remainingAttempts || 0,
			attempts: verify.attempts || 0
		})
	}

	try {
		const result = await forwardToUniIdCo('loginBySms', {
			mobile: check.mobile,
			code,
			captcha
		}, context)
		return { code: 200, message: '登录成功', result }
	} catch (e) {
		console.error('[auth-gateway] 登录失败:', e)
		return fail('auth-login-failed', e && e.errMsg ? e.errMsg : '登录失败，请稍后重试', {
			errCode: e && e.errCode ? e.errCode : undefined
		})
	}
}

module.exports = {
	handleSendSmsCode,
	handleLoginBySms,
	fail
}
