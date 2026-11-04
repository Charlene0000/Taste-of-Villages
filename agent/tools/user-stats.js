'use strict'

/**
 * 工具：查询当前用户的登录统计
 *
 * 数据来源：uni-id-users 中当前用户的 login_count / register_date。
 * 在浏览器/H5 演示环境下没有真实用户上下文，返回脱敏的占位数据，
 * 但**始终返回结构化结果**，不抛异常。
 */

module.exports = {
	name: 'user-stats',
	description: '查询当前用户的登录次数、注册天数与最近登录时间',
	parameters: {
		type: 'object',
		properties: {
			includeDevices: {
				type: 'boolean',
				description: '是否附带当前登录设备数'
			}
		},
		required: []
	},
		handler: async (args, context = {}) => {
			const user = context.user || null

			if (!user) {
				// 无用户上下文（如未登录的演示环境）
				return {
					ok: true,
					loggedIn: false,
					loginCount: 0,
					registerDays: 0,
					lastLoginAt: null,
					deviceCount: null,
					message: '当前未获取到用户信息，请先登录后再查询'
				}
			}

			// Sprint 5.2：兼容两套字段名
			//   uniCloud（uni-id-users）：login_count / register_date / last_login_at
			//   Prisma（users 表）：      loginCount / registerDate / lastLoginAt
			// 之前只读前者，服务端从 Prisma 查出来的用户全是 undefined，
			// 于是「我登录了几次」返回的永远是 0。
			const loginCount = typeof user.loginCount === 'number'
				? user.loginCount
				: (typeof user.login_count === 'number' ? user.login_count : 0)
			const registerDate = user.registerDate || user.register_date || null
			const lastLoginAt = user.lastLoginAt || user.last_login_at || user.last_login_date || null

			let registerDays = 0
			if (registerDate) {
				registerDays = Math.max(0, Math.floor((Date.now() - new Date(registerDate).getTime()) / (1000 * 60 * 60 * 24)))
			}

			// Sprint 5.2：补上「我是谁」需要的身份信息
			const nickname = user.nickname || null
			const mobile = user.mobile || null
			const maskedMobile = mobile
				? (mobile.length === 11 ? mobile.slice(0, 3) + '****' + mobile.slice(7) : mobile)
				: null

			const parts = []
			if (nickname) parts.push(`你是「${nickname}」`)
			if (maskedMobile) parts.push(`手机号 ${maskedMobile}`)
			if (!parts.length) parts.push('你是一个已登录的旅人')

			const result = {
				ok: true,
				loggedIn: true,
				nickname,
				mobile: maskedMobile,
				loginCount,
				registerDays,
				lastLoginAt,
				identity: parts.join('，'),
				message: `${parts.join('，')}。你一共登录了 ${loginCount} 次，注册至今 ${registerDays} 天`
			}

			if (args && args.includeDevices) {
				result.deviceCount = Array.isArray(user.token) ? user.token.length : null
			}

			return result
		}
}
