'use strict'

/**
 * auth-gateway —— 登录相关接口的统一入口（自研薄层）
 *
 * 设计原则：**外层包装，不侵入 uni-id-co**
 *   客户端 → auth-gateway → 四道安全闸 → uni-id-co → 云数据库
 *
 * 本云函数只做四件事 + 转发：
 *   ① 手机号严格类型校验   guards.validateMobile
 *   ② CSPRNG 验证码生成   guards.generateVerifyCode
 *   ③ 发送频率限制         guards.checkRateLimit / recordSend
 *   ④ 错误次数锁定         guards.verifyCode
 *
 * 业务逻辑（注册、签发 token、密码策略等）仍由 uni-id-co 负责，
 * 本文件不复制、不改写其实现。
 *
 * 具体处理见 lib/handlers.js，安全闸实现见 lib/guards.js。
 */

const handlers = require('./lib/handlers')

exports.main = async (event = {}, context = {}) => {
	const { action } = event
	try {
		switch (action) {
			case 'sendSmsCode':
				return await handlers.handleSendSmsCode(event, context)
			case 'loginBySms':
				return await handlers.handleLoginBySms(event, context)
			default:
				return handlers.fail('auth-unknown-action', `未知的动作类型: ${action}`)
		}
	} catch (e) {
		console.error('[auth-gateway] 主流程异常:', e)
		return handlers.fail('auth-internal-error', '服务器内部错误')
	}
}
